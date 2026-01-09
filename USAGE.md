# Quick Usage Guide

## Choosing the Right Skill

### pr-review-rag (PREFERRED - Default)

**Best for:**
- ✅ All reviews (default choice)
- ✅ Reviewing multiple PRs at the same time
- ✅ Fast reviews (10x faster than local clone)
- ✅ Private repos authorized in Amp

**Limitations:**
- Requires GitHub authorization in Amp for private repos
- Subject to GitHub API rate limits

**Set in `.env`:**
```bash
USE_RAG=true  # Default
```

### pr-review (Fallback)

**Best for:**
- Repositories not authorized in Amp
- When you need to work offline
- When GitHub API is unavailable

**Limitations:**
- **⚠️ Cannot run parallel PR reviews** (git checkout conflicts)
- Slower (requires git clone and checkout)
- Higher disk usage

**Set in `.env`:**
```bash
USE_RAG=false
```

### Platform-Specific Guidelines

Both skills use shared guidelines from `.agents/guidelines/`:
- **iOS.md** - housing-app conventions (DI patterns, memory management, naming)
- **Web.md** - housing.brahmand conventions (Linaria, module boundaries, Redux)

Skills auto-detect platform and load relevant guidelines. Update guideline files anytime to improve reviews.

## Local Testing (Your Machine)

### Setup (One-time)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp server/.env.example server/.env
# Edit server/.env with your values:
#   - GITHUB_WEBHOOK_SECRET (any random string)
#   - GITHUB_TOKEN (from GitHub settings)
#   - AMP_GITHUB_USERNAME=jitendra-housing
```

### Start Server

```bash
# Terminal 1: Start webhook server
npm start
```

### Expose to Internet

```bash
# Terminal 2: Start ngrok (get auth token from ngrok.com)
ngrok http 3000
```

Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)

### Configure GitHub Webhook

1. Go to your repo → **Settings** → **Webhooks** → **Add webhook**
2. **Payload URL**: `https://abc123.ngrok.io/webhook`
3. **Content type**: `application/json`
4. **Secret**: Copy from `server/.env` → `GITHUB_WEBHOOK_SECRET`
5. **Events**: Check only "Pull requests"
6. **Active**: ✅
7. Click "Add webhook"

### Test It

1. Create a PR in your repo
2. Request review from `jitendra-housing`
3. Watch your terminal - you'll see:
   ```
   [WEBHOOK] ✓ Valid request for PR: https://github.com/...
   [AMP] Triggering review for: https://github.com/...
   ```
4. Amp will analyze the PR and post a review comment

## Production (Dedicated Server)

### One-time Setup

```bash
# SSH to your server
ssh user@your-server.com

# Clone and install
git clone <repo>
cd PR-Review-AMP
npm install

# Configure
cp server/.env.example server/.env
nano server/.env  # Add production values

# Setup systemd service (see README.md)
# Setup nginx reverse proxy (see README.md)
# Setup SSL with Let's Encrypt (see README.md)
```

### Update GitHub Webhook

Use your server's URL instead of ngrok:
```
https://webhook.yourdomain.com/webhook
```

### Management

```bash
# Start server
sudo systemctl start amp-webhook

# Stop server
sudo systemctl stop amp-webhook

# View logs
sudo journalctl -u amp-webhook -f

# Restart after changes
sudo systemctl restart amp-webhook
```

## How It Works

```
┌─────────────┐
│  Developer  │
│  creates PR │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│  Adds jitendra-housing  │
│   as PR reviewer        │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  GitHub sends webhook   │
│  to your server         │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Server validates       │
│  signature & filters    │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Executes Amp CLI:      │
│  review PR <url>        │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Amp analyzes PR using  │
│  pr-review skill        │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Review comment posted  │
│  to GitHub PR           │
└─────────────────────────┘
```

## Environment Variables

```bash
# Required
GITHUB_WEBHOOK_SECRET=random-secret-string-123
GITHUB_TOKEN=ghp_your_github_personal_access_token
AMP_GITHUB_USERNAME=jitendra-housing

# Optional - Skill Selection
USE_RAG=true              # true=pr-review-rag (default, faster), false=pr-review (fallback)
MODEL=sonnet              # sonnet (faster, cheaper) or opus (smarter, expensive)
TEST_MODE=false           # true=interactive, false=background

# Optional - Server
PORT=3000
```

### Skill Selection Guide

| Scenario | USE_RAG | Why |
|----------|---------|-----|
| Normal reviews | `true` | Fastest, can run parallel PRs |
| Private repo not in Amp | `false` | Need local clone |
| Testing multiple PRs | `true` | RAG allows parallel reviews |
| One PR at a time | Either | Both work fine |

## Troubleshooting

**Server won't start:**
```bash
# Check if port is in use
lsof -i :3000

# Use different port
PORT=3001 npm start
```

**Webhook not received:**
```bash
# Test server is running
curl http://localhost:3000/health

# Check ngrok is forwarding
curl https://your-ngrok-url.ngrok.io/health
```

**Signature validation fails:**
- Ensure webhook secret matches in `.env` and GitHub

**Amp doesn't run:**
```bash
# Test Amp is installed
amp --version

# Test GitHub token
gh auth status
```

## Tips

- Keep ngrok running while testing locally
- Check server logs for detailed error messages
- Test webhook manually with `./test-webhook.sh`
- Use `npm run dev` for auto-reload during development
