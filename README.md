# Amp PR Review Automation

Automated GitHub PR review system using Amp's PR review skill, triggered via GitHub webhooks.

## Architecture

```
GitHub PR → Webhook → Express Server (Your Machine/Dedicated Server) → Amp CLI → GitHub Comment
```

When you add a configured GitHub user as a reviewer on any PR, this system automatically triggers Amp to perform a comprehensive code review.

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

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_WEBHOOK_SECRET` | Secret for webhook signature validation | ✅ |
| `GITHUB_TOKEN` | GitHub PAT with `repo` scope | ✅ |
| `AMP_GITHUB_USERNAME` | GitHub username that triggers reviews | ✅ |
| `PORT` | Server port (default: 3000) | ❌ |

## Deployment to Dedicated Server

### Prerequisites

- Ubuntu/Debian server with public IP
- Node.js 18+ installed
- Amp CLI installed
- Domain/subdomain (optional but recommended)

### Setup Steps

1. **Clone repository:**
   ```bash
   git clone <your-repo>
   cd PR-Review-AMP
   ```

2. **Install dependencies:**
   ```bash
   cd server
   npm install --production
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   nano .env  # Edit with your values
   ```

4. **Setup as system service (systemd):**
   
   Create `/etc/systemd/system/amp-webhook.service`:
   ```ini
   [Unit]
   Description=Amp PR Review Webhook Server
   After=network.target

   [Service]
   Type=simple
   User=YOUR_USER
   WorkingDirectory=/path/to/PR-Review-AMP/server
   ExecStart=/usr/bin/node index.js
   Restart=always
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

5. **Start service:**
   ```bash
   sudo systemctl enable amp-webhook
   sudo systemctl start amp-webhook
   sudo systemctl status amp-webhook
   ```

6. **Setup reverse proxy (nginx):**
   
   Create `/etc/nginx/sites-available/amp-webhook`:
   ```nginx
   server {
       listen 80;
       server_name webhook.yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   Enable and restart nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/amp-webhook /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

7. **Setup SSL (Let's Encrypt):**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d webhook.yourdomain.com
   ```

8. **Update GitHub webhook:**
   - URL: `https://webhook.yourdomain.com/webhook`

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
.
├── server/
│   ├── index.js              # Express webhook server
│   ├── package.json          # Dependencies
│   └── .env.example          # Environment template
├── .agents/skills/pr-review/ # Amp PR review skill
├── test-webhook-payload.json # Test payload
├── test-webhook.sh          # Local test script
├── SETUP.md                 # Detailed setup guide
├── LOCAL_TESTING.md         # Local testing guide
└── README.md                # This file
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
