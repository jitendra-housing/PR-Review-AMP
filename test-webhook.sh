#!/bin/bash

# Test script to simulate GitHub webhook locally
# Usage: ./test-webhook.sh [function-url]

FUNCTION_URL=${1:-"http://localhost:3000/webhook"}
SECRET=${GITHUB_WEBHOOK_SECRET:-"your-test-secret"}
PAYLOAD_FILE="test-webhook-payload.json"

if [ ! -f "$PAYLOAD_FILE" ]; then
  echo "Error: $PAYLOAD_FILE not found"
  exit 1
fi

PAYLOAD=$(cat "$PAYLOAD_FILE")

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

echo "Testing webhook..."
echo "URL: $FUNCTION_URL"
echo "Signature: sha256=$SIGNATURE"
echo ""

curl -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD" \
  -v

echo ""
