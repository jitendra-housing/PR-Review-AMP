# Amp PR Review Automation

Automated GitHub PR review system using Amp's PR review skill, triggered via GitHub webhooks.

## Architecture

```
GitHub PR → Webhook → Express Server → Amp CLI (pr-review skill) → GitHub Comment
```

When you add the configured GitHub user as a reviewer, this system automatically triggers Amp to perform a comprehensive code review.

## Quick Start (Local Testing)

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:
```bash
GITHUB_WEBHOOK_SECRET=my-secret-123
GITHUB_TOKEN=ghp_your_github_token
AMP_GITHUB_USERNAME=jitendra-housing
PORT=3000
```

### 3. Start Server

```bash
cd server
npm start
```

You should see:
```
🚀 Amp PR Review Webhook Server
📡 Listening on port 3000
🔍 Reviewer username: jitendra-housing
```

### 4. Expose with ngrok

```bash
ngrok http 3000
```

Copy your ngrok URL (e.g., `https://abc123.ngrok.io`)

### 5. Configure GitHub Webhook

Go to your repo → Settings → Webhooks → Add webhook:

- **Payload URL**: `https://abc123.ngrok.io/webhook`
- **Content type**: `application/json`
- **Secret**: Same as `GITHUB_WEBHOOK_SECRET` in `.env`
- **Events**: Select "Pull requests" only
- **Active**: ✅

### 6. Test It

1. Create a PR in your repository
2. Request review from `jitendra-housing`
3. Watch your server logs for:
   ```
   [WEBHOOK] ✓ Valid request for PR: https://github.com/...
   [AMP] Triggering review for: https://github.com/...
   [AMP] Review completed successfully
   ```
4. Check PR for Amp's review comment

## How It Works

1. **PR Event**: User requests `jitendra-housing` as reviewer
2. **GitHub Webhook**: Sends POST to your server
3. **Signature Validation**: Server verifies authentic GitHub request
4. **Filter**: Only processes `review_requested` for configured username
5. **Amp Execution**: Runs `review PR <url>` using pr-review skill
6. **Review Posted**: Amp posts comprehensive review to GitHub PR

## PR Review Skills

This system includes two Amp skills for PR review:

### pr-review-rag (PREFERRED - Default)

**Uses:** GitHub API + RAG (no local clone needed)

**Pros:**
- ✅ 10x faster (no git clone)
- ✅ Uses RAG for deep codebase understanding
- ✅ Can review multiple PRs simultaneously (no repo locking)
- ✅ Always uses latest code from GitHub
- ✅ Lower disk space usage

**Cons:**
- ❌ Requires repository authorization in Amp (for private repos)
- ❌ Depends on GitHub API rate limits

**When to use:** Default choice for all reviews

### pr-review (Fallback)

**Uses:** Local git clone + file analysis

**Pros:**
- ✅ Works without GitHub authorization (clones repo)
- ✅ No API rate limit dependencies
- ✅ Can work offline (after initial clone)

**Cons:**
- ❌ Slower (requires git operations)
- ❌ **Cannot review parallel PRs** (repo checkout conflict)
- ❌ Higher disk space usage (.temp/ directory)
- ❌ Requires git clone for each new repository

**When to use:** When RAG skill fails or repository not authorized

### Platform-Specific Guidelines

Both skills automatically load platform-specific conventions from `.agents/guidelines/`:

| Platform | Files | Guideline | Status |
|----------|-------|-----------|--------|
| iOS | `.swift`, `.m`, `.h`, `.xib` | `iOS.md` | ✅ 433 lines |
| Web/React | `.jsx`, `.tsx`, `.js` | `Web.md` | ✅ 587 lines |
| Android | `.kt`, `.java` | `Android.md` | ⏹️ Not created |

**Guidelines include:**
- Dependency injection patterns (e.g., container.resolve for iOS)
- Styling conventions (e.g., Linaria for Web)
- Module boundary rules (e.g., common/ vs Apps/ for Web)
- Memory management patterns
- Naming conventions
- Security best practices

See `.agents/guidelines/README.md` for details.

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `GITHUB_WEBHOOK_SECRET` | Secret for webhook signature validation | ✅ | - |
| `GITHUB_TOKEN` | GitHub PAT with `repo` scope | ✅ | - |
| `AMP_GITHUB_USERNAME` | GitHub username that triggers reviews | ✅ | - |
| `USE_RAG` | Use pr-review-rag (true) or pr-review (false) | ❌ | `true` |
| `MODEL` | Amp model: `sonnet` or `opus` | ❌ | `sonnet` |
| `TEST_MODE` | Interactive mode for testing | ❌ | `false` |
| `PORT` | Server port | ❌ | `3000` |

## Production Deployment

For production deployment on a dedicated server:
1. Clone repository and install dependencies
2. Configure environment variables
3. Setup as systemd service
4. Configure nginx reverse proxy with SSL
5. Update GitHub webhook URL

See deployment documentation for detailed steps.

## Security Considerations

- ✅ Webhook signature validation (prevents unauthorized requests)
- ✅ GitHub token with minimal scopes (only `repo`)
- ✅ HTTPS required for production (use Let's Encrypt)
- ✅ Secrets in `.env` (never commit to git)
- ✅ Filter by specific GitHub username
- ✅ Filter by specific event type (review_requested)

## Troubleshooting

### Webhook not received

Check server logs:
```bash
# Local
cd server && npm start

# Production
sudo journalctl -u amp-webhook -f
```

Verify ngrok/server is accessible:
```bash
curl http://localhost:3000/health
```

### Signature validation fails

- Ensure `GITHUB_WEBHOOK_SECRET` matches GitHub webhook secret
- Check GitHub webhook "Recent Deliveries" for errors

### Amp review doesn't run

- Verify Amp CLI is installed: `amp --version`
- Check `GITHUB_TOKEN` has correct permissions
- Review server logs for Amp execution errors

### Review not posted to GitHub

- Ensure `GITHUB_TOKEN` has `repo` scope
- Check GitHub API rate limits
- Verify pr-review skill is working: `review PR <url>` manually

## File Structure

```
PR-Review-AMP/
├── .agents/
│   ├── guidelines/               # Shared platform-specific guidelines
│   │   ├── iOS.md               # iOS conventions (housing-app)
│   │   ├── Web.md               # React/JS conventions (housing.brahmand)
│   │   └── README.md            # Guidelines documentation
│   └── skills/
│       ├── check-branch-sync/   # Branch sync checker skill
│       ├── pr-review/           # Local clone skill (fallback)
│       │   └── SKILL.md
│       └── pr-review-rag/       # RAG skill (preferred, default)
│           └── SKILL.md
│
├── server/
│   ├── index.js                 # Express webhook server
│   ├── package.json             # Server dependencies
│   ├── .env.example             # Environment template
│   └── .env                     # Your config (gitignored)
│
├── .temp/                       # Auto-created for local clones
│   ├── housing-app/             # Cloned by pr-review skill
│   └── housing.brahmand/        # Cloned by pr-review skill
│
├── .gitignore
├── package.json                 # Root package.json
├── test-webhook-payload.json    # Test payload
├── test-webhook.sh              # Manual webhook test script
├── README.md                    # This file
└── USAGE.md                     # Quick usage guide
```

## Testing Locally

```bash
# Terminal 1: Start server
cd server
npm start

# Terminal 2: Start ngrok
ngrok http 3000

# Terminal 3: Send test webhook
export GITHUB_WEBHOOK_SECRET="your-secret"
./test-webhook.sh "http://localhost:3000/webhook"
```

## Development

```bash
# Install dev dependencies
cd server
npm install

# Run with auto-reload
npm run dev
```

## License

MIT
