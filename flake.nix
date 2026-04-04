{
  description = "jack.kelliher.info — personal business card site";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    let
      # NixOS module — import this in your system flake
      nixosModule = { config, lib, pkgs, ... }:
        let
          cfg = config.services.jack-site;
          site = self.packages.${pkgs.system}.default;
        in
        {
          options.services.jack-site = {
            enable = lib.mkEnableOption "jack.kelliher.info static site";

            port = lib.mkOption {
              type = lib.types.port;
              default = 8780;
              description = "Port for the local Caddy file server";
            };

            tunnelTokenFile = lib.mkOption {
              type = lib.types.path;
              description = "Path to file containing the Cloudflare tunnel token (decrypted by sops-nix or similar)";
            };
          };

          config = lib.mkIf cfg.enable {
            systemd.services.jack-site-caddy = {
              description = "jack.kelliher.info — Caddy static file server";
              after = [ "network.target" ];
              wantedBy = [ "multi-user.target" ];
              serviceConfig = {
                ExecStart = "${pkgs.caddy}/bin/caddy run --adapter caddyfile --config ${pkgs.writeText "jack-site-Caddyfile" ''
                  :${toString cfg.port} {
                    root * ${site}
                    file_server
                    header {
                      X-Content-Type-Options nosniff
                      X-Frame-Options DENY
                      Referrer-Policy strict-origin-when-cross-origin
                    }
                    handle /health {
                      respond "OK" 200
                    }
                    log {
                      output stdout
                      format console
                    }
                  }
                ''}";
                Restart = "on-failure";
                RestartSec = 5;
                DynamicUser = true;
                ProtectHome = true;
                PrivateTmp = true;
                NoNewPrivileges = true;
                ProtectSystem = "strict";
              };
            };

            # Dedicated user for cloudflared so sops-nix can grant read access
            users.users.jack-site-tunnel = {
              isSystemUser = true;
              group = "jack-site-tunnel";
            };
            users.groups.jack-site-tunnel = {};

            systemd.services.jack-site-cloudflared = {
              description = "jack.kelliher.info — Cloudflare Tunnel";
              after = [ "network-online.target" "jack-site-caddy.service" ];
              wants = [ "network-online.target" ];
              wantedBy = [ "multi-user.target" ];
              script = ''
                TOKEN=$(cat ${cfg.tunnelTokenFile})
                exec ${pkgs.cloudflared}/bin/cloudflared --no-autoupdate tunnel run --token "$TOKEN"
              '';
              serviceConfig = {
                Type = "simple";
                User = "jack-site-tunnel";
                Group = "jack-site-tunnel";
                Restart = "on-failure";
                RestartSec = 10;
                ProtectHome = true;
                PrivateTmp = true;
                NoNewPrivileges = true;
                ProtectSystem = "strict";
              };
            };
          };
        };
    in
    {
      nixosModules.default = nixosModule;
    }
    //
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        # Static site output — www/ contains pre-built assets (bun build locally)
        packages.default = pkgs.stdenv.mkDerivation {
          pname = "jack-kelliher-info";
          version = "0.2.0";
          src = ./www;
          installPhase = ''
            mkdir -p $out
            cp -r . $out/
          '';
        };

        devShells.default = pkgs.mkShell {
          name = "jack-kelliher-info";
          buildInputs = with pkgs; [
            opentofu
            sops
            age
            ssh-to-age
            caddy
            bun
            jq
            curl
            git
          ];
          shellHook = ''
            echo ""
            echo "🃏 jack.kelliher.info"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "  nix build       Build static site"
            echo "  caddy run       Local dev server"
            echo "  cd terraform/   Manage infra"
            echo ""
          '';
        };
      }
    );
}
