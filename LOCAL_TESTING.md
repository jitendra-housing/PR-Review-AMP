# Local Testing Guide

Quick guide to test the webhook locally before deploying.

## Quick Start

### 1. Setup Environment

```bash
# Install dependencies
npm run install-all

# Copy and configure .env
cp functions/.env.example functions/.env
# Edit functions/.env with your credentials
```

### 2. Start Local Server

```bash
# Terminal 1: Start Firebase emulator
npm run serve
```

You should see:
```
✔  functions[us-central1-githubWebhook]: http function initialized (http://localhost:5001/PROJECT/us-central1/githubWebhook).
```

### 3. Test with Mock Payload

```bash
# Terminal 2: Send test webhook
export GITHUB_WEBHOOK_SECRET="your-secret-from-.env"
npm run test-webhook
```

Expected output:
```json
{
  "success": true,
  "message": "Amp review triggered",
  "pr_url": "https://github.com/owner/repo/pull/123"
}
```

### 4. Test with Real GitHub (Optional)

```bash
# Terminal 3: Expose local server
ngrok http 5001
```

Copy the ngrok URL and configure GitHub webhook:
```
https://abc123.ngrok.io/PROJECT/us-central1/githubWebhook
```

Then create a PR and request review from your configured user.

## Debugging

### Check Logs

```bash
# Real-time logs
npm run logs

# Or view in emulator UI
# Open: http://localhost:4000/logs
```

### Test Webhook Signature

```bash
# Verify signature generation
./test-webhook.sh http://localhost:5001/PROJECT/us-central1/githubWebhook
```

### Simulate Different Events

Edit `test-webhook-payload.json` to test different scenarios:

**Different reviewer:**
```json
{
  "requested_reviewer": {
    "login": "different-user"
  }
}
```
Expected: `"Not for Amp reviewer"`

**Different action:**
```json
{
  "action": "opened"
}
```
Expected: `"Action ignored"`

**Different event:**
```bash
# Modify test-webhook.sh
# Change: -H "X-GitHub-Event: pull_request"
# To: -H "X-GitHub-Event: push"
```
Expected: `"Event ignored"`

### Invalid Signature

```bash
# Test with wrong secret
export GITHUB_WEBHOOK_SECRET="wrong-secret"
./test-webhook.sh
```
Expected: `401 Invalid signature`

## Common Issues

### Error: "Cannot find module 'firebase-functions'"

```bash
cd functions
npm install
```

### Error: "GITHUB_WEBHOOK_SECRET not set"

```bash
# Set in functions/.env
echo 'GITHUB_WEBHOOK_SECRET="your-secret"' >> functions/.env
```

### Error: Port 5001 already in use

```bash
# Kill existing process
lsof -ti:5001 | xargs kill -9

# Or use different port
firebase emulators:start --only functions --port 5002
```

### Webhook receives 404

Check your function URL format:
```
http://localhost:5001/[PROJECT-ID]/[REGION]/[FUNCTION-NAME]
                      ^          ^        ^
                      Your       us-      githubWebhook
                      Firebase   central1
                      Project
                      ID
```

## Environment Variables for Testing

Create `functions/.env`:

```bash
# Required
GITHUB_WEBHOOK_SECRET="test-secret-123"
GITHUB_TOKEN="ghp_your_github_token"
AMP_API_KEY="your_amp_api_key"
AMP_GITHUB_USERNAME="amp-reviewer"

# Optional
AMP_API_URL="https://api.ampcode.com/v1/review"
```

## Next Steps

Once local testing works:
1. Review [SETUP.md](SETUP.md) for production deployment
2. Configure production secrets in Firebase
3. Deploy: `npm run deploy`
4. Update GitHub webhook to production URL

## Testing Checklist

- [ ] Firebase emulator starts successfully
- [ ] Mock webhook returns 200 OK
- [ ] Signature validation works
- [ ] Wrong signature returns 401
- [ ] Non-matching reviewer is ignored
- [ ] Amp API call is made (check logs)
- [ ] Real GitHub webhook works (via ngrok)
- [ ] Review comment appears on PR

Once all checks pass, you're ready for production deployment!
