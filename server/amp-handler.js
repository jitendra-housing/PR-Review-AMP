const { execSync, spawn } = require('child_process');
const path = require('path');

/**
 * Amp handler for PR reviews
 * Extracted from original index.js implementation
 */
async function handleAmpReview(prUrl) {
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
  const liteMode = process.env.LITE_MODE === 'true';
  const useRag = process.env.USE_RAG !== 'false';
  
  // Lite mode uses pr-review-lite skill (cheapest, no RAG/librarian)
  // Otherwise use RAG or local clone skill
  const skill = liteMode ? 'pr-review-lite' : (useRag ? 'pr-review-rag' : 'pr-review');
  const model = (process.env.MODEL || 'sonnet').toLowerCase();
  const modeFlag = model === 'sonnet' ? 'large' : 'smart';
  const reviewCommand = `use ${skill} skill to review PR ${prUrl}`;

  console.log('[AMP] Working directory:', projectRoot);
  console.log(`[AMP] Mode: ${isTestMode ? 'TEST (interactive)' : 'PRODUCTION (background)'}`);
  console.log(`[AMP] Skill: ${skill} (LITE_MODE=${liteMode}, USE_RAG=${useRag})`);
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

    console.log('✓ Review process started (queue managed by /review-complete callback)\n');
    return { success: true, message: 'Review started' };
  }
}

module.exports = handleAmpReview;
