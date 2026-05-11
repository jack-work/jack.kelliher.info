{
  description = "jack.kelliher.info — personal business card site";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      ...
    }:
    let
      nixosModule =
        {
          config,
          lib,
          pkgs,
          ...
        }:
        let
          cfg = config.services.jack-site;
        in
        {
          options.services.jack-site = {
            enable = lib.mkEnableOption "jack.kelliher.info static site";

            hostnames = lib.mkOption {
              type = lib.types.listOf lib.types.str;
              default = [
                "jack.kelliher.info"
                "john.kelliher.info"
              ];
              description = "Hostnames to serve this site on";
            };
          };

          config = lib.mkIf cfg.enable {
            services.kelliher-web.sites.jack-site = {
              hostnames = cfg.hostnames;
              root = self.packages.${pkgs.system}.default;
              extraConfig = ''
                header {
                  X-Content-Type-Options nosniff
                  X-Frame-Options DENY
                  Referrer-Policy strict-origin-when-cross-origin
                }
                handle /health {
                  respond "OK" 200
                }
              '';
            };
          };
        };
    in
    {
      nixosModules.default = nixosModule;
    }
    // flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.default = pkgs.stdenv.mkDerivation {
          pname = "jack-kelliher-info";
          version = "0.4.0";
          src = ./www;
          installPhase = ''
            mkdir -p $out
            cp -r . $out/
          '';
        };

        devShells.default = pkgs.mkShell {
          name = "jack-kelliher-info";
          buildInputs = with pkgs; [
            bun
            caddy
          ];
        };
      }
    );
}
