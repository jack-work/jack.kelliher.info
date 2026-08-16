{
  description = "jack.kelliher.info — personal business card site";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    # The house's UI library. It carries the boil effect from figar.org
    # and, more to the point, the guard that proves the effect survived
    # the build — see zanni/docs/boil.md.
    zanni.url = "github:jack-work/zanni";
    zanni.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      zanni,
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
        # www/ plus the zanni components its pages ask for. One call:
        # the injection and the guard live in zanni, not here, so the
        # effect cannot rot separately in every site that wears it. The
        # build fails if index.html loses its marker or its classes.
        packages.default = zanni.lib.mkBoiledSite {
          inherit pkgs;
          pname = "jack-kelliher-info";
          version = "0.5.0";
          src = ./www;
          components = [ "boil" "gesso" "phosphor" "fontpack" "glyphmark" ];
          # The mark is 80px in the file and 120px on the page: 1.5x
          # magnification, against figar.org's 26->38 (1.46x). Pixelated
          # CSS over the full-size JPEG would have done nothing at all.
          files."profile-pixel.png" = zanni.lib.pixelate {
            inherit pkgs;
            src = ./www/profile.jpg;
            size = 80;
            colors = 48;
          };
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
