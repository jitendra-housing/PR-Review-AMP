# Firebase Cloud Function Setup for Amp PR Review

## Prerequisites

1. Firebase CLI installed: `npm install -g firebase-tools`
2. Firebase project created at https://console.firebase.google.com
3. GitHub repository with admin access
4. Amp account with API access

## Setup Steps

### 1. Firebase Configuration

```bash
# Login to Firebase
firebase login

# Initialize Firebase in this directory (if not done)
firebase init functions

# Update .firebaserc with your project ID
```

### 2. Install Dependencies

```bash
cd functions
npm install
```

### 3. Configure Secrets

Set environment secrets using Firebase CLI:

```bash
firebase functions:secrets:set GITHUB_WEBHOOK_SECRET
firebase functions:secrets:set GITHUB_TOKEN
firebase functions:secrets:set AMP_API_KEY
firebase functions:config:set amp.github_username="amp-reviewer"
```

Or update `functions/index.js` to use Firebase Secret Manager:
```javascript
const { defineSecret } = require('firebase-functions/params');
const githubSecret = defineSecret('GITHUB_WEBHOOK_SECRET');
```

### 4. Deploy

```bash
firebase deploy --only functions
```

Note the deployed function URL (e.g., `https://us-central1-PROJECT_ID.cloudfunctions.net/githubWebhook`)

### 5. Configure GitHub Webhook

1. Go to your GitHub repository → Settings → Webhooks
2. Click "Add webhook"
3. **Payload URL**: Your Firebase function URL
4. **Content type**: `application/json`
5. **Secret**: Same value as `GITHUB_WEBHOOK_SECRET`
6. **Events**: Select "Pull requests" only
7. Click "Add webhook"

### 6. Test

1. Create a test PR in your repository
2. Request review from the user configured in `AMP_GITHUB_USERNAME`
3. Check Firebase logs: `firebase functions:log`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_WEBHOOK_SECRET` | Secret for validating GitHub webhook signatures |
| `GITHUB_TOKEN` | GitHub PAT with `repo` scope for API access |
| `AMP_API_KEY` | Amp API key for authentication |
| `AMP_GITHUB_USERNAME` | GitHub username that triggers Amp review (default: "amp-reviewer") |

## Local Testing

```bash
# Start emulator
cd functions
npm run serve

# Use ngrok to expose local endpoint
ngrok http 5001

# Update GitHub webhook to ngrok URL temporarily
```

## Troubleshooting

- Check logs: `firebase functions:log`
- Verify webhook deliveries in GitHub Settings → Webhooks
- Ensure secrets are set correctly
- Verify Amp CLI is available in Cloud Function environment

## Notes

- If Amp doesn't have a CLI/API, you'll need to adapt the `triggerAmpReview` function
- Consider adding retry logic for failed reviews
- Add Firestore logging for audit trail (optional)
