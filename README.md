# jack.kelliher.info

Personal business card site for **jack.kelliher.info** and
**john.kelliher.info**.

This repo ships:

- `packages.default` — the static site (contents of `www/`) as a Nix
  derivation.
- `nixosModules.default` — a thin module that registers the site into
  the shared hosting platform under
  [`kelliher-web`](https://github.com/jack-work/kelliher-web) at
  `services.kelliher-web.sites.jack-site`.

It does **not** run its own Caddy or Cloudflare tunnel — that lives in
`kelliher-web`.

## Local preview

```bash
nix develop      # -> bun + caddy
caddy file-server --root ./www --listen :8080
# then visit http://localhost:8080
```

## Building

```bash
nix build .#default
ls result/       # favicon, index.html, profile.jpg, resume PDF
```

## Using in a system flake

```nix
{
  inputs = {
    kelliher-web.url = "github:jack-work/kelliher-web";
    jack-site.url    = "github:jack-work/jack.kelliher.info";
  };

  outputs = { nixpkgs, kelliher-web, jack-site, ... }: {
    nixosConfigurations.spain = nixpkgs.lib.nixosSystem {
      modules = [
        kelliher-web.nixosModules.default
        jack-site.nixosModules.default
        ({ config, ... }: {
          services.kelliher-web = {
            enable = true;
            tunnelTokenFile = config.sops.secrets.tunnel-token.path;
          };
          services.jack-site.enable = true;
        })
      ];
    };
  };
}
```

## History

This repo formerly contained the whole stack — Caddy, cloudflared,
Terraform, sops secrets, and the site source. As of 2026-04-22 those
concerns moved to
[`kelliher-web`](https://github.com/jack-work/kelliher-web) and this
repo was reduced to a registrar. The pre-split history is preserved as
ancestors of `master`; the last monolithic commit is `23d8665`.

See `docs/devlog.md` for the design notes.
