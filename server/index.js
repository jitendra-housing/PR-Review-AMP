require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { spawn } = require('child_process');

const app = express();

app.use(express.json());

function verifyGitHubSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (e) {
    return false;
  }
}

async function triggerAmpReview(prUrl) {
  const { execSync } = require('child_process');
  const path = require('path');
  
  console.log(`\n[AMP] Starting PR review using pr-review skill`);
  console.log(`[AMP] PR URL: ${prUrl}`);
  
  if (!process.env.GITHUB_TOKEN) {
    const error = 'GITHUB_TOKEN not set in environment';
    console.error('[ERROR]', error);
    throw new Error(error);
  }
  
  console.log('[AMP] Checking GitHub CLI authentication...');
  
  try {
    execSync('gh auth status 2>&1', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log('[GH AUTH] ✓ Already authenticated');
  } catch (error) {
    console.log('[GH AUTH] Not authenticated, logging in...');
    
    try {
      const cleanEnv = { ...process.env };
      delete cleanEnv.GITHUB_TOKEN;
      delete cleanEnv.GH_TOKEN;
      
      execSync(`echo "${process.env.GITHUB_TOKEN}" | gh auth login --with-token 2>&1`, {
        encoding: 'utf8',
        env: cleanEnv,
        stdio: 'pipe'
      });
      console.log('[GH AUTH] ✓ Login successful');
    } catch (loginError) {
      const sanitizedError = loginError.message.replace(process.env.GITHUB_TOKEN, '[REDACTED]');
      console.error('[GH AUTH] ✗ Login failed');
      console.error('Error:', sanitizedError.split('\n')[0]);
      throw new Error('GitHub CLI authentication failed');
    }
  }
  
  const projectRoot = path.resolve(__dirname, '..');
  const isTestMode = process.env.TEST_MODE === 'true';
  const useRag = process.env.USE_RAG !== 'false';
  const skill = useRag ? 'pr-review-rag' : 'pr-review';
  const model = (process.env.MODEL || 'sonnet').toLowerCase();
  const modeFlag = model === 'sonnet' ? 'large' : 'smart';
  const reviewCommand = `use ${skill} skill to review PR ${prUrl}`;
  
  console.log('[AMP] Working directory:', projectRoot);
  console.log(`[AMP] Mode: ${isTestMode ? 'TEST (interactive)' : 'PRODUCTION (background)'}`);
  console.log(`[AMP] Skill: ${skill} (USE_RAG=${useRag})`);
  console.log(`[AMP] Model: ${model} (--mode ${modeFlag})`);
  console.log('[AMP] -----------------------------------\n');
  
  if (isTestMode) {
    console.log('[TEST MODE] Opening Amp session...');
    console.log(`[TEST MODE] Command: ${reviewCommand}`);
    console.log('[TEST MODE] You can interact with Amp directly in this terminal\n');
    
    const amp = spawn('bash', ['-c', `printf "${reviewCommand}\\n" | amp --mode ${modeFlag}`], {
      cwd: projectRoot,
      env: {
        ...process.env,
        GH_TOKEN: process.env.GITHUB_TOKEN
      },
      stdio: 'inherit'
    });
    
    return { success: true, message: 'Interactive session started' };
  } else {
    const amp = spawn('bash', ['-c', `printf "${reviewCommand}\\n" | amp --mode ${modeFlag}`], {
      cwd: projectRoot,
      env: {
        ...process.env,
        GH_TOKEN: process.env.GITHUB_TOKEN
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    amp.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    amp.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
    
    console.log('✓ Review process started\n');
    return { success: true, message: 'Review started' };
  }
}

app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const payload = JSON.stringify(req.body);
  
  console.log(`\n[WEBHOOK] Received: ${event}`);
  
  if (!verifyGitHubSignature(payload, signature, process.env.GITHUB_WEBHOOK_SECRET)) {
    console.log('[WEBHOOK] Invalid signature');
    return res.status(401).send('Invalid signature');
  }
  
  if (event !== 'pull_request') {
    console.log('[WEBHOOK] Ignoring non-PR event');
    return res.status(200).send('Event ignored');
  }
  
  const { action, pull_request, requested_reviewer } = req.body;
  
  if (action !== 'review_requested') {
    console.log(`[WEBHOOK] Ignoring action: ${action}`);
    return res.status(200).send('Action ignored');
  }
  
  const ampReviewerUsername = process.env.AMP_GITHUB_USERNAME;
  
  if (requested_reviewer?.login !== ampReviewerUsername) {
    console.log(`[WEBHOOK] Reviewer ${requested_reviewer?.login} !== ${ampReviewerUsername}`);
    return res.status(200).send('Not for Amp reviewer');
  }
  
  const prUrl = pull_request.html_url;
  console.log(`[WEBHOOK] ✓ Valid request for PR: ${prUrl}`);
  
  triggerAmpReview(prUrl)
    .then(result => {
      console.log('[WEBHOOK] ✓ Review triggered successfully');
    })
    .catch(error => {
      console.error('[WEBHOOK] ✗ Failed to trigger review:', error.message);
    });
  
  res.status(200).json({
    success: true,
    message: 'Review triggered',
    pr_url: prUrl
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 Amp PR Review Webhook Server`);
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🔍 Reviewer username: ${process.env.AMP_GITHUB_USERNAME}`);
  console.log(`\n💡 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health\n`);
});
