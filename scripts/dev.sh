#!/bin/bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

echo "Starting STRA playground..."
pnpm dev
