#!/bin/bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

echo "Installing dependencies..."
pnpm install --frozen-lockfile

echo ""
echo "Building packages in layer order..."

# L0 Foundation
echo "── L0 Foundation ──"
pnpm -r --filter '@stra/shared-core' --filter '@stra/shared-node' --filter '@stra/shared-web' --filter '@stra/shared' run build

# L1 Runtime
echo "── L1 Runtime ──"
pnpm -r --filter '@stra/types' --filter '@stra/core' --filter '@stra/plugin' run build

# L2 UI Adapter
echo "── L2 UI Adapter ──"
pnpm -r --filter '@stra/react' run build

# L3 Rendering
echo "── L3 Rendering ──"
pnpm -r --filter '@stra/renderer-core' --filter '@stra/renderer-html' --filter '@stra/dom' run build

# L4 Tooling
echo "── L4 Tooling ──"
pnpm -r --filter '@stra/cli' --filter '@stra/devtools' run build
pnpm -r --filter '@stra/resolver' --filter '@stra/transform' --filter '@stra/module-graph' run build
pnpm -r --filter '@stra/hmr' --filter '@stra/client' run build
pnpm -r --filter '@stra/bundler' run build
pnpm -r --filter '@stra/dev-server' run build

# LS1 Semantic Layer
echo "── LS1 Semantic Layer ──"
pnpm -r --filter '@stra/semantic' --filter '@stra/semantic-diff' --filter '@stra/causality' run build

# LS2 Cache & Optimize
echo "── LS2 Cache & Optimize ──"
pnpm -r --filter '@stra/cache' --filter '@stra/optimizer' run build

# LS3 Dev & AI
echo "── LS3 Dev & AI ──"
pnpm -r --filter '@stra/semantic-devtools' --filter '@stra/ai-compiler' --filter '@stra/time-travel' run build

# LS4 Distribution
echo "── LS4 Distribution ──"
pnpm -r --filter '@stra/distributed-build' run build

echo ""
echo "Build completed successfully!"
