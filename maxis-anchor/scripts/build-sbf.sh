#!/usr/bin/env bash
# Reproducible on-chain artifact: requires Solana CLI with cargo-build-sbf (e.g. `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
chmod +x scripts/prep-program-keypair.sh
./scripts/prep-program-keypair.sh
if ! command -v cargo-build-sbf >/dev/null 2>&1; then
  echo "cargo-build-sbf not in PATH. Install Solana/Agave stable: https://docs.anza.xyz/cli/install" >&2
  exit 1
fi
cargo-build-sbf --manifest-path programs/maxis/Cargo.toml --sbf-out-dir target/deploy
echo "Built: $ROOT/target/deploy/maxis.so"
