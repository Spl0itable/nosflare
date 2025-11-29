#!/bin/bash

echo "🔧 Setting up Cloudflare Queues..."

# Skip if no API token (CI/local dev without credentials)
if [ -z "$CLOUDFLARE_API_TOKEN" ] && [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "⚠️  No Cloudflare credentials found - skipping queue setup"
  echo "   (Queues will be created automatically on first deployment)"
  exit 0
fi

# Get list of existing queues once
echo "📋 Checking existing queues..."
EXISTING_QUEUES=$(npx wrangler queues list 2>/dev/null || echo "")

# Function to create queue if it doesn't exist
create_queue_if_missing() {
  local queue_name=$1

  if echo "$EXISTING_QUEUES" | grep -q "$queue_name"; then
    echo "✓ $queue_name (exists)"
  else
    echo "⚙️  Creating $queue_name..."
    if npx wrangler queues create "$queue_name" 2>&1 | grep -v "ERROR" > /dev/null; then
      echo "✓ $queue_name (created)"
    else
      echo "⚠️  Failed to create $queue_name (may already exist or permission issue)"
    fi
  fi
}

# Create all queues
QUEUES=(
  "event-broadcast-dlq"
  "event-indexing-dlq"
  "r2-archive-dlq"
  "r2-archive-queue"
)

# Broadcast queues (0-49) - hash-based sharding
for i in {0..49}; do
  QUEUES+=("event-broadcast-queue-$i")
done

# Indexing queues - primary (0-49) - hash-based sharding
for i in {0..49}; do
  QUEUES+=("event-indexing-primary-$i")
done

# Indexing queues - ENAM replica (0-49)
for i in {0..49}; do
  QUEUES+=("event-indexing-replica-enam-$i")
done

# Indexing queues - WEUR replica (0-49)
for i in {0..49}; do
  QUEUES+=("event-indexing-replica-weur-$i")
done

# Indexing queues - APAC replica (0-49)
for i in {0..49}; do
  QUEUES+=("event-indexing-replica-apac-$i")
done

# Create all queues one-by-one
echo "📦 Creating queues sequentially..."
for queue in "${QUEUES[@]}"; do
  create_queue_if_missing "$queue"
done

echo "✅ Queue setup complete (254 total: 3 DLQ + 50 broadcast + 200 indexing + 1 R2 archive)"
