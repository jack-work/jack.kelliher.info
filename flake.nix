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
                # Every file in the nix store has mtime=1, so Caddy sends
                # Last-Modified: 1970 and nothing else. With no Cache-Control
                # a browser applies RFC 9111 heuristic freshness — 10% of the
                # document's apparent age — which for a 56-year-old timestamp
                # is over five YEARS. The page is then never revalidated and a
                # deploy is invisible to anyone who has already visited.
                # HTML must always be revalidated; the fingerprinted-ish
                # assets may be cached briefly.
                header /*.html Cache-Control "no-cache, must-revalidate"
                header / Cache-Control "no-cache, must-revalidate"
                header /*.png Cache-Control "public, max-age=300"
                header /*.jpg Cache-Control "public, max-age=300"
                header /*.pdf Cache-Control "public, max-age=300"
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
        # The résumé PDF, rendered from resume/resume.html at build time.
        #
        # The PDF this replaces had no text layer at all: 0 text-drawing
        # operators and 170,612 curve operators, every letter a vector outline.
        # It was uncopyable, unreadable to a screen reader, and invisible to an
        # applicant tracking system. It also carried a browser print header and
        # a footer containing a local Windows path and username. Both faults
        # came from printing by hand through a GUI print dialog.
        #
        # Building it here makes both structurally impossible: the flags live in
        # the derivation rather than in a dialog, and the PDF cannot drift from
        # its source because it is rendered from it every time.
        packages.resume = pkgs.runCommand "resume_kelliher.pdf" {
          nativeBuildInputs = [ pkgs.chromium pkgs.poppler-utils ];
          # A build sandbox has no fonts, and Chromium does not fail when it
          # cannot find one: it lays out zero glyphs and writes a 2 KB PDF that
          # looks like a blank page. Naming them here also PINS them, so the
          # PDF cannot change because a machine's font set did.
          #
          # Liberation only, deliberately. The obvious choice is EB Garamond,
          # which the stylesheet names first, but the packaged EB Garamond
          # ships Regular and Italic and no Bold: every job title and section
          # heading loses its weight, and the hierarchy of the page goes with
          # it. Chromium also embeds it as Type 3 with a custom encoding, which
          # is exactly the sort of thing an applicant tracking system parses
          # badly, and being parseable is the whole point of this rebuild.
          # Liberation Serif is metric-compatible with Times New Roman, ships
          # all four faces, and embeds as CID TrueType.
          FONTCONFIG_FILE = pkgs.makeFontsConf {
            fontDirectories = [ pkgs.liberation_ttf ];
          };
        } ''
          export HOME=$TMPDIR
          cp ${./resume}/resume.html in.html
          chromium --headless --no-sandbox --disable-gpu \
            --no-pdf-header-footer --print-to-pdf=out.pdf "file://$PWD/in.html"

          # The three faults of the old file, asserted rather than hoped for.
          # A résumé failing any of these should not ship.
          pages=$(pdfinfo out.pdf | awk '/^Pages:/ {print $2}')
          if [ "$pages" != "1" ]; then
            echo "resume: $pages pages, expected 1. What spilled onto page 2:"
            pdftotext -f 2 out.pdf - | head -20
            exit 1
          fi

          words=$(pdftotext out.pdf - | wc -w)
          if [ "$words" -lt 300 ]; then
            echo "resume: only $words extractable words; the text layer is missing"; exit 1
          fi

          if pdftotext out.pdf - | grep -qiE 'file:///|C:.Users|Downloads'; then
            echo "resume: browser print furniture found in the text layer"; exit 1
          fi

          cp out.pdf $out
        '';

        # www/ plus the zanni components its pages ask for. One call:
        # the injection and the guard live in zanni, not here, so the
        # effect cannot rot separately in every site that wears it. The
        # build fails if index.html loses its marker or its classes.
        packages.default = zanni.lib.mkBoiledSite {
          inherit pkgs;
          pname = "jack-kelliher-info";
          version = "0.5.0";
          src = ./www;
          components = [ "boil" "gesso" "phosphor" "fontpack" "glyphmark" "heft" ];
          # The mark is 80px in the file and 120px on the page: 1.5x
          # magnification, against figar.org's 26->38 (1.46x). Pixelated
          # CSS over the full-size JPEG would have done nothing at all.
          files."resume_kelliher.pdf" = self.packages.${system}.resume;
          files."profile-pixel.png" = zanni.lib.pixelate {
            inherit pkgs;
            src = ./www/profile.jpg;
            size = 48;            # displayed at 120px: 2.5x, up from 1.5x
            colors = 24;
            saturation = 42;      # drain the photograph's own hues
            tint = "#a2762a";     # and pull what is left toward the page's gold
            tintAmount = 22;
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
