#!/usr/bin/env bash
# Copy committed devnet program authority keypair where Anchor expects it before `anchor build`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/target/deploy"
cp "$ROOT/keys/program-devnet.json" "$ROOT/target/deploy/maxis-keypair.json"
echo "Wrote target/deploy/maxis-keypair.json (program id matches declare_id!)."
