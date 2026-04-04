#!/usr/bin/env bash
set -euo pipefail

# jack.kelliher.info deploy script
# Run on the deploy target after cloning the repo.
# Requires: nix (with flakes), sops, age key at /etc/age/keys.txt

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="/var/lib/jack-site"
CONFIG_DIR="/etc/jack-site"

echo "🃏 Deploying jack.kelliher.info"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Build the static site via nix
echo "→ Building static site..."
nix build "${SCRIPT_DIR}#" --no-link
RESULT=$(nix build "${SCRIPT_DIR}#" --print-out-paths --no-link)
echo "  Built: ${RESULT}"

# 2. Copy site files
echo "→ Installing site files..."
sudo mkdir -p "${SITE_DIR}/www"
sudo rsync -a --delete "${RESULT}/" "${SITE_DIR}/www/"
echo "  Installed to ${SITE_DIR}/www"

# 3. Install config files
echo "→ Installing configuration..."
sudo mkdir -p "${CONFIG_DIR}"
sudo cp "${SCRIPT_DIR}/Caddyfile" "${CONFIG_DIR}/Caddyfile"

# 4. Decrypt tunnel token
echo "→ Decrypting tunnel token..."
TUNNEL_TOKEN=$(sops -d --extract '["tunnel_token"]' "${SCRIPT_DIR}/secrets/tunnel.yaml")
echo "TUNNEL_TOKEN=${TUNNEL_TOKEN}" | sudo tee "${CONFIG_DIR}/tunnel-env" > /dev/null
sudo chmod 600 "${CONFIG_DIR}/tunnel-env"
echo "  Tunnel token installed"

# 5. Resolve binary paths from the nix dev shell
echo "→ Resolving nix binary paths..."
CADDY_BIN=$(nix develop "${SCRIPT_DIR}#" --command which caddy)
CLOUDFLARED_BIN=$(nix develop "${SCRIPT_DIR}#" --command which cloudflared)

# 6. Install systemd units (rewrite ExecStart with absolute nix paths)
echo "→ Installing systemd units..."
sed "s|/usr/bin/env caddy|${CADDY_BIN}|g" "${SCRIPT_DIR}/systemd/jack-site-caddy.service" \
    | sudo tee /etc/systemd/system/jack-site-caddy.service > /dev/null

sed "s|/usr/bin/env cloudflared|${CLOUDFLARED_BIN}|g" "${SCRIPT_DIR}/systemd/jack-site-cloudflared.service" \
    | sudo tee /etc/systemd/system/jack-site-cloudflared.service > /dev/null

# 7. Reload and (re)start services
echo "→ Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable --now jack-site-caddy.service
sudo systemctl enable --now jack-site-cloudflared.service

echo ""
echo "✓ Deployed. Services:"
sudo systemctl status jack-site-caddy.service --no-pager -l || true
echo ""
sudo systemctl status jack-site-cloudflared.service --no-pager -l || true
