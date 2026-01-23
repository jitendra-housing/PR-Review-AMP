const { execSync } = require('child_process');

/**
 * GitHub API client using gh CLI
 */
class GitHubClient {
  constructor() {
    this.ensureAuthenticated();
  }

  /**
   * Ensure GitHub CLI is authenticated
   */
  ensureAuthenticated() {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN not set in environment');
    }

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
  }

  /**
   * Parse PR URL to extract owner, repo, and number
   * @param {string} prUrl - GitHub PR URL
   * @returns {Object} { owner, repo, number }
   */
  parsePRUrl(prUrl) {
    const match = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (!match) {
      throw new Error(`Invalid PR URL: ${prUrl}`);
    }
    return {
      owner: match[1],
      repo: match[2],
      number: parseInt(match[3])
    };
  }

  /**
   * Get PR data using gh CLI
   * @param {string} prUrl - GitHub PR URL
   * @returns {Object} PR data
   */
  getPRData(prUrl) {
    const { owner, repo, number } = this.parsePRUrl(prUrl);

    try {
      const result = execSync(
        `gh pr view ${number} --repo ${owner}/${repo} --json number,title,body,state,author,additions,deletions,changedFiles,headRefName,headRefOid,baseRefName`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      return JSON.parse(result);
    } catch (error) {
      console.error(`[GH] Failed to fetch PR data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get PR files using gh CLI
   * @param {string} prUrl - GitHub PR URL
   * @returns {Array} Array of file objects with diff data
   */
  getFiles(prUrl) {
    const { owner, repo, number } = this.parsePRUrl(prUrl);

    try {
      // Get files with changes
      const filesResult = execSync(
        `gh pr view ${number} --repo ${owner}/${repo} --json files`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      const filesData = JSON.parse(filesResult);

      // Get diff for each file
      const diffResult = execSync(
        `gh pr diff ${number} --repo ${owner}/${repo}`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      // Parse diff to match with files
      const files = filesData.files.map(file => ({
        filename: file.path,
        status: file.additions > 0 && file.deletions > 0 ? 'modified' :
                file.additions > 0 ? 'added' : 'removed',
        additions: file.additions,
        deletions: file.deletions,
        changes: file.additions + file.deletions,
        patch: this.extractFileDiff(diffResult, file.path)
      }));

      return files;
    } catch (error) {
      console.error(`[GH] Failed to fetch PR files: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract diff for a specific file from full diff output
   * @param {string} fullDiff - Complete diff output
   * @param {string} filename - File to extract
   * @returns {string} File-specific diff
   */
  extractFileDiff(fullDiff, filename) {
    const lines = fullDiff.split('\n');
    let inFile = false;
    let fileDiff = [];

    for (const line of lines) {
      if (line.startsWith('diff --git') && line.includes(filename)) {
        inFile = true;
        fileDiff = [line];
      } else if (inFile && line.startsWith('diff --git')) {
        break;
      } else if (inFile) {
        fileDiff.push(line);
      }
    }

    return fileDiff.join('\n');
  }

  /**
   * Post comment to PR using gh CLI
   * @param {string} prUrl - GitHub PR URL
   * @param {string} comment - Comment body (markdown)
   */
  postComment(prUrl, comment) {
    const { owner, repo, number } = this.parsePRUrl(prUrl);

    try {
      // Write comment to temp file to avoid shell escaping issues
      const fs = require('fs');
      const tmpFile = `/tmp/pr-comment-${Date.now()}.md`;
      fs.writeFileSync(tmpFile, comment);

      execSync(
        `gh pr comment ${number} --repo ${owner}/${repo} --body-file ${tmpFile}`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      // Clean up temp file
      fs.unlinkSync(tmpFile);

      console.log(`[GH] ✓ Comment posted to PR #${number}`);
    } catch (error) {
      console.error(`[GH] Failed to post comment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get file content from repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} ref - Git ref (branch, commit, etc.)
   * @returns {string} File content
   */
  getFileContent(owner, repo, path, ref = 'HEAD') {
    try {
      const result = execSync(
        `gh api repos/${owner}/${repo}/contents/${path}?ref=${ref} --jq .content | base64 -d`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
      return result;
    } catch (error) {
      console.error(`[GH] Failed to fetch file content: ${error.message}`);
      throw error;
    }
  }
}

module.exports = GitHubClient;
