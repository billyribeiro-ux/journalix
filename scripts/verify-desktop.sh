#!/usr/bin/env bash
# Full desktop gate on this machine: toolchain check, JS install, webview build, Rust checks.
# Run from anywhere: ./scripts/verify-desktop.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

want_rust="$(sed -n 's/^rust = "\(.*\)"/\1/p' mise.toml)"
have_rust="$(rustc --version | awk '{print $2}')"
if [[ "$have_rust" != "$want_rust" ]]; then
	echo "rustc $have_rust is active but mise.toml pins $want_rust. Run: mise install && mise use rust@$want_rust" >&2
	exit 1
fi
echo "==> rustc $have_rust, node $(node --version), pnpm $(pnpm --version)"

echo "==> Installing JavaScript dependencies"
pnpm install --frozen-lockfile

echo "==> Building the webview bundle (tauri.conf.json frontendDist)"
pnpm --filter @journalix/desktop build

cd apps/desktop/src-tauri
echo "==> cargo fmt --check"
cargo fmt --check
echo "==> cargo clippy (warnings are errors)"
cargo clippy --all-targets -- -D warnings
echo "==> cargo test"
cargo test

echo "==> Desktop checks passed"
