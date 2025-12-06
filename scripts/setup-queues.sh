#!/bin/bash

echo "🔧 Setting up Cloudflare Queues..."

# Skip if no API token (CI/local dev without credentials)
if [ -z "$CLOUDFLARE_API_TOKEN" ] && [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "⚠️  No Cloudflare credentials found - skipping queue setup"
  echo "   (Queues will be created automatically on first deployment)"
  exit 0
fi

# Check for --force flag to bypass sentinel check
FORCE_SETUP=false
if [ "$1" = "--force" ] || [ "$SKIP_QUEUE_SENTINEL_CHECK" = "true" ]; then
  FORCE_SETUP=true
  echo "🔄 Force mode enabled - running full queue check..."
fi

# Get list of existing queues using Cloudflare API directly
echo "📋 Fetching existing queues..."
echo "   Account ID: ${CLOUDFLARE_ACCOUNT_ID:0:8}..."

# Parse JSON using node via stdin
EXISTING_QUEUES=$(curl -s "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/queues?per_page=1000" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" | node -e "
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.success === false) {
          console.error('API error:', JSON.stringify(json.errors));
        } else if (json.result && Array.isArray(json.result)) {
          json.result.forEach(q => console.log(q.queue_name));
        }
      } catch (e) {
        console.error('JSON parse error:', e.message);
      }
    });
  " 2>&1)

QUEUE_COUNT=$(echo "$EXISTING_QUEUES" | grep -cv "^API error\|^JSON parse error" || echo "0")
echo "   Found $QUEUE_COUNT existing queues"

# Sentinel queue - the last queue created in the setup process
SENTINEL_QUEUE="event-indexing-replica-apac-49"

# Sentinel check - skip setup if the last queue already exists (unless --force)
if [ "$FORCE_SETUP" = "false" ]; then
  echo "🔍 Checking sentinel queue ($SENTINEL_QUEUE)..."
  if echo "$EXISTING_QUEUES" | grep -qx "$SENTINEL_QUEUE"; then
    echo "✅ Sentinel queue exists - all 254 queues already set up"
    echo "   (Use --force or SKIP_QUEUE_SENTINEL_CHECK=true to run full check)"
    exit 0
  fi
  echo "📋 Sentinel queue not found - running full setup..."
fi

# Function to create queue if it doesn't exist
create_queue_if_missing() {
  local queue_name=$1

  if echo "$EXISTING_QUEUES" | grep -qx "$queue_name"; then
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