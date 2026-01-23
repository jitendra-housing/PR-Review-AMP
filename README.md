# PR Review Workflow

Automated GitHub PR review system supporting both Amp CLI and Claude API, triggered via GitHub webhooks.

## Architecture

### Amp Mode (Default)
```
GitHub PR → Webhook → Express Server → Amp CLI → PR Review Skill → GitHub Comment
```

### Claude Mode (New)
```
GitHub PR → Webhook → Express Server → Claude API → Code Review → GitHub Comment
```

When you add the configured GitHub user as a reviewer, this system automatically triggers a comprehensive code review using either Amp skills or Claude API.

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
5. **Skill Execution**: Runs custom PR review skill on Amp (`use pr-review-rag skill to review PR <url>`)
6. **Review Posted**: Skill posts comprehensive review to GitHub PR

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

## Agent Selection

This system now supports two review agents:

### Claude API (Recommended for Production)

**Pros:**
- ✅ Direct API integration (no CLI needed)
- ✅ Intelligent file classification (AUTO_SKIP, QUICK, DEEP)
- ✅ Batch review for config files (10 files per request)
- ✅ Streaming responses for large files
- ✅ Pattern caching (reuses guidelines for all files)
- ✅ Structured findings with severity levels
- ✅ Token optimization (~$2-3 per PR)
- ✅ Predictable costs and performance

**Cons:**
- ❌ Requires API key and costs money
- ❌ Subject to API rate limits

**Usage:**
```bash
export AGENT=claude
export ANTHROPIC_API_KEY=sk-ant-api03-...
export MODEL=sonnet  # or opus, haiku
export CONTEXT_STRATEGY=SEMANTIC_SEARCH  # or FULL_FILES, DIFF_ONLY
npm start
```

#### Context Strategies for Claude

Claude supports three context strategies to balance review quality and cost:

**SEMANTIC_SEARCH (Recommended - Best Quality)**
- Uses MCP semantic search for RAG-style code retrieval
- Automatically finds related code (imports, dependencies, tests)
- Provides full file content + semantically related snippets
- Cost: ~$3-4 per PR (40% cheaper than FULL_FILES)
- Best for: Complex architectural reviews, production use

**Requirements:**
```bash
export CONTEXT_STRATEGY=SEMANTIC_SEARCH
export MCP_SERVER_ENABLED=true
export SEMANTIC_SEARCH_LIMIT=10
export SEMANTIC_SEARCH_THRESHOLD=0.7
```

**FULL_FILES (Good Balance)**
- Fetches complete file content from GitHub API
- Provides full context for each changed file
- No semantic search, just the files being changed
- Cost: ~$4-5 per PR
- Best for: Standard reviews without MCP setup

**Requirements:**
```bash
export CONTEXT_STRATEGY=FULL_FILES
```

**DIFF_ONLY (Fast but Limited)**
- Only uses patch/diff data (current implementation)
- Fastest and cheapest
- Cost: ~$2 per PR
- Best for: Simple config changes only
- ⚠️ **Not recommended** - misses critical context

**Requirements:**
```bash
export CONTEXT_STRATEGY=DIFF_ONLY
```

**Comparison:**

| Strategy | Review Quality | Cost/PR | Speed | Setup Complexity |
|----------|---------------|---------|-------|------------------|
| SEMANTIC_SEARCH | ⭐⭐⭐⭐⭐ Excellent | $3-4 | 3-4 min | Medium (MCP) |
| FULL_FILES | ⭐⭐⭐⭐ Good | $4-5 | 3 min | Simple |
| DIFF_ONLY | ⭐⭐ Limited | $2 | 2 min | None |

**MCP Setup (for SEMANTIC_SEARCH):**

1. Install claude-context MCP server:
   ```bash
   npm install -g @zilliztech/claude-context
   ```

2. Configure credentials (Zilliz Cloud + OpenAI):
   ```bash
   export ZILLIZ_CLOUD_API_KEY=your-key
   export OPENAI_API_KEY=your-key
   ```

3. Run MCP server:
   ```bash
   claude-context
   ```

4. Index your repositories:
   ```bash
   # Via MCP tools or automatically on first review
   ```

See `CLAUDE_INTEGRATION.md` for detailed MCP setup instructions.

### Amp CLI (Original Implementation)

**Pros:**
- ✅ Free to use (if you have Amp access)
- ✅ Interactive testing mode
- ✅ RAG-based reviews with skill system
- ✅ Established workflow

**Cons:**
- ❌ Requires Amp CLI installation
- ❌ Sequential processing (queue required)
- ❌ Less predictable performance

**Usage:**
```bash
export AGENT=amp
export USE_RAG=true
export MODEL=sonnet  # or opus
npm start
```

## Environment Variables

### Common Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `AGENT` | Agent to use: `amp` or `claude` | ❌ | `amp` |
| `GITHUB_WEBHOOK_SECRET` | Secret for webhook signature validation | ✅ | - |
| `GITHUB_TOKEN` | GitHub PAT with `repo` scope | ✅ | - |
| `GITHUB_USERNAME` | GitHub username that triggers reviews | ✅ | - |
| `MODEL` | Model to use (see below) | ❌ | `sonnet` |
| `USE_QUEUE` | Sequential (true) or parallel (false) | ❌ | `true` |
| `PORT` | Server port | ❌ | `3000` |

### Claude-Specific Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API key | ✅ (if AGENT=claude) | - |
| `CONTEXT_STRATEGY` | Context strategy: `SEMANTIC_SEARCH`, `FULL_FILES`, `DIFF_ONLY` | ❌ | `SEMANTIC_SEARCH` |
| `MCP_SERVER_ENABLED` | Enable MCP semantic search | ❌ | `true` |
| `SEMANTIC_SEARCH_LIMIT` | Max related code snippets per file | ❌ | `10` |
| `SEMANTIC_SEARCH_THRESHOLD` | Relevance score threshold (0-1) | ❌ | `0.7` |
| `FALLBACK_STRATEGY` | Strategy if primary fails: `FULL_FILES`, `DIFF_ONLY` | ❌ | `FULL_FILES` |

### Amp-Specific Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `USE_RAG` | Use pr-review-rag (true) or pr-review (false) | ❌ | `true` |
| `TEST_MODE` | Interactive mode for testing | ❌ | `false` |

### Model Selection

**For Claude (`AGENT=claude`):**
- `sonnet` → Claude Sonnet 4.5 (balanced speed/quality)
- `opus` → Claude Opus 4.5 (deep analysis, slower)
- `haiku` → Claude Haiku 3.5 (quick reviews, cheaper)

**For Amp (`AGENT=amp`):**
- `sonnet` → Sonnet 4.5 with `--mode large`
- `opus` → Opus 4.5 with `--mode smart`

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
│   │   ├── Common.md            # Universal guidelines
│   │   └── README.md            # Guidelines documentation
│   └── skills/
│       ├── check-branch-sync/   # Branch sync checker skill
│       ├── pr-review/           # Local clone skill (fallback)
│       │   └── SKILL.md
│       └── pr-review-rag/       # RAG skill (preferred, default)
│           └── SKILL.md
│
├── server/
│   ├── index.js                 # Express webhook server (agent routing)
│   ├── amp-handler.js           # Amp CLI handler
│   ├── claude-handler.js        # Claude API handler (with context fetching)
│   ├── claude/                  # Claude integration modules
│   │   ├── api-client.js        # Claude API client
│   │   ├── pattern-cache.js     # Guidelines caching
│   │   ├── prompt-builder.js    # Prompt templates (enriched context)
│   │   ├── streaming-handler.js # Stream processing
│   │   ├── mcp-client.js        # MCP server connection
│   │   └── semantic-search.js   # Semantic code search wrapper
│   ├── shared/                  # Shared utilities
│   │   ├── webhook-validator.js # Signature verification
│   │   ├── queue-manager.js     # Review queue
│   │   ├── github-client.js     # GitHub API wrapper
│   │   ├── file-classifier.js   # File categorization
│   │   ├── review-formatter.js  # Markdown formatting
│   │   └── context-fetcher.js   # Multi-strategy context fetcher
│   ├── test-mcp-connection.js   # Test MCP integration
│   ├── test-context-fetcher.js  # Test context strategies
│   ├── test-agents.js           # Test agent selection
│   ├── package.json             # Server dependencies
│   ├── .env.example             # Environment template
│   └── .env                     # Your config (gitignored)
│
├── .temp/                       # Auto-created for local clones (Amp only)
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
