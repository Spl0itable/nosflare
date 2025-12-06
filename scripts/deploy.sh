#!/bin/bash
set -e

echo "🚀 Starting deployment process..."

# Parse arguments
QUEUE_SETUP_ARGS=""
for arg in "$@"; do
  case $arg in
    --force-queues)
      QUEUE_SETUP_ARGS="--force"
      ;;
  esac
done

# Step 1: Setup queues
echo ""
echo "Step 1/3: Setting up Cloudflare Queues..."
bash scripts/setup-queues.sh $QUEUE_SETUP_ARGS

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