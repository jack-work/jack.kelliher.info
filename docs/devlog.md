# Devlog

## 2026-04-22 — Infra refactor

Flake restructured to v0.4.0. Caddy and Cloudflare tunnel management extracted
into a shared `kelliher-web` module — `services.jack-site` now declares hostnames
and delegates serving to `services.kelliher-web.sites`. Added `john.kelliher.info`
as a secondary hostname. Dev shell trimmed to just bun + caddy.

## 2026-04-08 — Design refinement

Reworked the business card HTML/CSS with an engraved stationery aesthetic:

- **Double-border frame** — inset `::after` pseudo-element creates a second
  border 7px inside the card edge.
- **Small-caps title** — replaced italic subtitle with `font-variant: small-caps`
  and `letter-spacing: 0.16em`.
- **Ornamental divider** — diamond glyph flanked by thin rules, replacing the
  plain horizontal line.
- **Double-ring photo** — `outline` + `outline-offset` adds a second ring around
  the profile image.
- **Contact hierarchy** — email on its own line (italic), social links grouped
  below in smaller type.
- **Typography polish** — OpenType `kern`/`liga`/`calt` on body, `onum` on blurb,
  custom `::selection` color, proper accent on "Resume".
- **Palette tuned** — background deepened to `#ece7dd`, card set to cream
  `#faf8f4` instead of pure white.

## 2026-04-07 — Drastic simplification

Deleted the 429-line `src/main.ts` (3D card flip, cannonball physics easter egg,
Web Audio sound effects, pretext layout integration). Replaced with pure static
HTML+CSS. Faster load, zero JS, same elegant card design.

## 2026-04-06 — Card rendering fixes

Series of rapid fixes to the interactive card version before simplification:

- Fixed text justification with `text-align-last: justify`.
- Rewrote card rendering to fix centering and 3D transform visibility.
- Removed CSS `width/height: 100%` that overrode JS-set dimensions.
- Set explicit width/height on card element for proper 3D transforms.

## 2026-04-05 — Networking hardened

Added systemd sandboxing to both Caddy and Cloudflared services: `DynamicUser`,
`ProtectHome`, `PrivateTmp`, `ProtectSystem=strict`, capability dropping, and
syscall filtering.
