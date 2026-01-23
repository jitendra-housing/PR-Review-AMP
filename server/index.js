require('dotenv').config();
const express = require('express');
const QueueManager = require('./shared/queue-manager');
const { verifyGitHubSignature } = require('./shared/webhook-validator');
const handleAmpReview = require('./amp-handler');
const handleClaudeReview = require('./claude-handler');

const app = express();

app.use(express.json({ limit: '10mb' }));

// Initialize queue manager
const queueManager = new QueueManager();

// Register handlers
queueManager.registerHandler('amp', handleAmpReview);
queueManager.registerHandler('claude', handleClaudeReview);

// Get current agent from environment
const currentAgent = (process.env.AGENT || 'amp').toLowerCase();
console.log(`[SERVER] Agent mode: ${currentAgent}`);

// Middleware: Allow /review-complete only from localhost
function localhostOnly(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

  if (!isLocalhost) {
    console.log(`[SECURITY] Blocked /review-complete from ${ip}`);
    return res.status(403).send('Forbidden');
  }

  next();
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

  const reviewerUsername = process.env.GITHUB_USERNAME;

  if (requested_reviewer?.login !== reviewerUsername) {
    console.log(`[WEBHOOK] Reviewer ${requested_reviewer?.login} !== ${reviewerUsername}`);
    return res.status(200).send('Not for configured reviewer');
  }

  const prUrl = pull_request.html_url;
  console.log(`[WEBHOOK] ✓ Valid request for PR: ${prUrl}`);
  console.log(`[WEBHOOK] Using agent: ${currentAgent}`);

  // Add to queue (queue manager handles parallel/sequential mode)
  const queuePosition = queueManager.enqueue(currentAgent, prUrl);

  res.status(200).json({
    success: true,
    message: queuePosition ? 'PR added to review queue' : 'Review triggered',
    agent: currentAgent,
    queue_position: queuePosition,
    pr_url: prUrl
  });
});

// Review complete callback (localhost only)
app.post('/review-complete', localhostOnly, (req, res) => {
  const { agent, pr_url, pr_number, status } = req.body;
  const reviewAgent = agent || currentAgent;

  queueManager.onReviewComplete(reviewAgent, pr_url, status);

  res.json({ success: true, message: 'Acknowledged' });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    agent: currentAgent,
    model: process.env.MODEL || 'sonnet',
    use_queue: process.env.USE_QUEUE !== 'false',
    timestamp: new Date().toISOString()
  });
});

app.get('/queue-status', (req, res) => {
  res.json(queueManager.getStatus());
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 PR Review Webhook Server`);
  console.log(`📡 Listening on ${HOST}:${PORT}`);
  console.log(`🤖 Agent: ${currentAgent}`);
  console.log(`🎯 Model: ${process.env.MODEL || 'sonnet'}`);
  console.log(`📋 Queue: ${process.env.USE_QUEUE !== 'false' ? 'enabled' : 'disabled'}`);
  console.log(`🔍 Reviewer username: ${process.env.GITHUB_USERNAME}`);
  console.log(`\n💡 Webhook URL: http://<your-ip>:${PORT}/webhook`);
  console.log(`🏥 Health check: http://<your-ip>:${PORT}/health`);
  console.log(`📊 Queue status: http://<your-ip>:${PORT}/queue-status\n`);
});
