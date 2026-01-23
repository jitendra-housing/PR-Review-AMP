const crypto = require('crypto');

/**
 * Verify GitHub webhook signature
 * @param {string} payload - The raw request body as string
 * @param {string} signature - The X-Hub-Signature-256 header value
 * @param {string} secret - The webhook secret
 * @returns {boolean} True if signature is valid
 */
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

module.exports = { verifyGitHubSignature };
