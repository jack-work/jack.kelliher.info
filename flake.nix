{
  description = "jack.kelliher.info — personal business card site";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        # Static site output — just copies www/ into the nix store.
        # Swap this for a real build step (vite, 11ty, etc.) later.
        packages.default = pkgs.stdenv.mkDerivation {
          pname = "jack-kelliher-info";
          version = "0.1.0";
          src = ./www;
          installPhase = ''
            mkdir -p $out
            cp -r . $out/
          '';
        };

        devShells.default = pkgs.mkShell {
          name = "jack-kelliher-info";

          buildInputs = with pkgs; [
            # Infrastructure
            opentofu
            cloudflared

            # Secrets
            sops
            age
            ssh-to-age

            # Web server (local dev + production)
            caddy

            # Future client app
            nodejs_22
            nodePackages.npm

            # Utilities
            jq
            curl
            git
          ];

          shellHook = ''
            export JACK_SITE_ROOT="$(pwd)"
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
