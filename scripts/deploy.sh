#!/bin/bash
set -e

echo "🚀 Starting deployment process..."

# Step 1: Setup queues
echo ""
echo "Step 1/3: Setting up Cloudflare Queues..."
bash scripts/setup-queues.sh

# Step 2: Build
echo ""
echo "Step 2/3: Building worker..."
npm run build

# Step 3: Deploy
echo ""
echo "Step 3/3: Deploying to Cloudflare..."
npx wrangler deploy

echo ""
echo "✅ Deployment complete!"
