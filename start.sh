#!/bin/bash
set -e

# Vision PR Review Server Startup Script with PM2
# Usage: ./start.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
APP_NAME="pr-review"

echo "🚀 Starting Vision PR Review Server"
echo "📂 Working directory: $SCRIPT_DIR"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed!"
    echo "📝 Install Node.js 18+ first"
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed!"
    echo "📦 Installing PM2 globally..."
    npm install -g pm2
    echo "✅ PM2 installed"
    echo ""
fi

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "⚠️  Warning: GitHub CLI (gh) is not installed!"
    echo "📝 Install gh CLI for GitHub API access:"
    echo "   Ubuntu/Debian: sudo apt install gh"
    echo "   macOS: brew install gh"
    echo ""
fi

# Check if Amp CLI is installed
if ! command -v amp &> /dev/null; then
    echo "⚠️  Warning: Amp CLI is not installed!"
    echo "📝 Install Amp CLI from: https://ampcode.com"
    echo ""
fi

# Check if .env exists
if [ ! -f "$SERVER_DIR/.env" ]; then
    echo "❌ Error: $SERVER_DIR/.env file not found!"
    echo "📝 Create .env from .env.example:"
    echo "   cp $SERVER_DIR/.env.example $SERVER_DIR/.env"
    echo "   nano $SERVER_DIR/.env"
    exit 1
fi

# Load environment variables for validation
if [ -f "$SERVER_DIR/.env" ]; then
    export $(grep -v '^#' "$SERVER_DIR/.env" | xargs)
fi

# Validate critical environment variables
MISSING_VARS=()

if [ -z "$GITHUB_WEBHOOK_SECRET" ]; then
    MISSING_VARS+=("GITHUB_WEBHOOK_SECRET")
fi

if [ -z "$GITHUB_TOKEN" ]; then
    MISSING_VARS+=("GITHUB_TOKEN")
fi

if [ -z "$AMP_GITHUB_USERNAME" ]; then
    MISSING_VARS+=("AMP_GITHUB_USERNAME")
fi

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Error: Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "📝 Edit $SERVER_DIR/.env and add these variables"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "$SERVER_DIR/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd "$SERVER_DIR"
    npm install
    cd "$SCRIPT_DIR"
    echo "✅ Dependencies installed"
    echo ""
fi

# Create .temp directory if needed
mkdir -p "$SCRIPT_DIR/.temp"

# Display configuration
echo "✅ Configuration validated"
echo "📋 Settings:"
echo "   - Reviewer: $AMP_GITHUB_USERNAME"
echo "   - Port: ${PORT:-3000}"
echo "   - Skill: $([ "$USE_RAG" = "false" ] && echo "pr-review (local clone)" || echo "pr-review-rag (RAG, faster)")"
echo "   - Model: ${MODEL:-sonnet}"
echo "   - Test Mode: ${TEST_MODE:-false}"
echo ""

# Stop existing process if running
if pm2 list | grep -q "$APP_NAME"; then
    echo "🔄 Stopping existing $APP_NAME process..."
    pm2 stop "$APP_NAME"
    pm2 delete "$APP_NAME"
    echo "✅ Existing process stopped"
    echo ""
fi

# Start with PM2
echo "▶️  Starting $APP_NAME with PM2..."
cd "$SERVER_DIR"
pm2 start index.js \
    --name "$APP_NAME" \
    --time \
    --log-date-format "YYYY-MM-DD HH:mm:ss Z" \
    --merge-logs \
    --max-memory-restart 500M

echo ""
echo "✅ $APP_NAME started successfully!"
echo ""

# Setup auto-start on boot (first time only)
if ! pm2 startup | grep -q "already"; then
    echo "⚙️  Setting up PM2 auto-start on boot..."
    echo ""
    echo "📋 Run the following command to enable auto-start:"
    echo ""
    pm2 startup | grep "sudo"
    echo ""
    echo "After running the command above, run:"
    echo "   pm2 save"
    echo ""
else
    echo "✅ PM2 auto-start already configured"
    echo ""
fi

# Save PM2 process list
echo "💾 Saving PM2 process list..."
pm2 save
echo "✅ Process list saved"
echo ""

# Show status
echo "📊 Current status:"
pm2 list

echo ""
echo "📝 Useful commands:"
echo "   pm2 list              - List all processes"
echo "   pm2 logs $APP_NAME    - View logs"
echo "   pm2 monit             - Monitoring dashboard"
echo "   pm2 restart $APP_NAME - Restart the app"
echo "   pm2 stop $APP_NAME    - Stop the app"
echo "   pm2 delete $APP_NAME  - Remove from PM2"
echo ""
echo "🔍 View logs now:"
echo "   pm2 logs $APP_NAME"
