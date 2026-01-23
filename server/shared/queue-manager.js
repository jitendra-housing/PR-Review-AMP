/**
 * Queue manager for PR reviews
 * Supports multiple agent types and sequential/parallel processing
 */

class QueueManager {
  constructor() {
    this.queues = {
      amp: [],
      claude: []
    };
    this.processing = {
      amp: false,
      claude: false
    };
    this.handlers = {};
    this.useQueue = process.env.USE_QUEUE !== 'false';
  }

  /**
   * Register a handler for an agent type
   * @param {string} agent - Agent name (amp, claude)
   * @param {Function} handler - Handler function that processes PRs
   */
  registerHandler(agent, handler) {
    this.handlers[agent] = handler;
    console.log(`[QUEUE] Registered handler for ${agent}`);
  }

  /**
   * Add PR to queue
   * @param {string} agent - Agent name
   * @param {string} prUrl - PR URL to review
   * @returns {number} Queue position (null if parallel mode)
   */
  enqueue(agent, prUrl) {
    if (!this.useQueue) {
      // Parallel mode - process immediately
      console.log(`[QUEUE] Parallel mode: Processing ${prUrl} with ${agent} immediately`);
      this.processReview(agent, prUrl);
      return null;
    }

    // Sequential mode - add to queue
    if (!this.queues[agent]) {
      this.queues[agent] = [];
    }

    this.queues[agent].push(prUrl);
    const position = this.queues[agent].length;

    console.log(`[QUEUE] Added to ${agent} queue. Position: ${position}`);

    // Start processing if not already running
    this.processQueue(agent);

    return position;
  }

  /**
   * Process queue for specific agent
   * @param {string} agent - Agent name
   */
  async processQueue(agent) {
    if (this.processing[agent] || this.queues[agent].length === 0) {
      return;
    }

    this.processing[agent] = true;
    const prUrl = this.queues[agent].shift();

    console.log(`\n[QUEUE] ====================================`);
    console.log(`[QUEUE] Processing (${agent}): ${prUrl}`);
    console.log(`[QUEUE] Remaining in ${agent} queue: ${this.queues[agent].length}`);
    console.log(`[QUEUE] ====================================\n`);

    try {
      await this.processReview(agent, prUrl);
      console.log(`[QUEUE] ✓ Completed (${agent}): ${prUrl}`);
    } catch (error) {
      console.error(`[QUEUE] ✗ Failed (${agent}): ${prUrl}`, error.message);
    } finally {
      this.processing[agent] = false;

      // Process next in queue after delay
      if (this.queues[agent].length > 0) {
        console.log(`[QUEUE] Starting next ${agent} review in 5 seconds...`);
        setTimeout(() => this.processQueue(agent), 5000);
      } else {
        console.log(`[QUEUE] ${agent} queue empty, waiting for new PRs`);
      }
    }
  }

  /**
   * Process a single review
   * @param {string} agent - Agent name
   * @param {string} prUrl - PR URL
   */
  async processReview(agent, prUrl) {
    const handler = this.handlers[agent];
    if (!handler) {
      throw new Error(`No handler registered for agent: ${agent}`);
    }

    return handler(prUrl);
  }

  /**
   * Mark review as complete (called by /review-complete callback)
   * @param {string} agent - Agent name
   * @param {string} prUrl - PR URL
   * @param {string} status - Review status
   */
  onReviewComplete(agent, prUrl, status) {
    console.log(`\n[CALLBACK] Review complete notification`);
    console.log(`[CALLBACK] Agent: ${agent}`);
    console.log(`[CALLBACK] PR: ${prUrl}`);
    console.log(`[CALLBACK] Status: ${status}`);

    this.processing[agent] = false;

    // Process next in queue
    if (this.queues[agent] && this.queues[agent].length > 0) {
      console.log(`[CALLBACK] Starting next ${agent} review in 5 seconds...`);
      setTimeout(() => this.processQueue(agent), 5000);
    } else {
      console.log(`[CALLBACK] ${agent} queue empty`);
    }
  }

  /**
   * Get queue status
   * @returns {Object} Queue status for all agents
   */
  getStatus() {
    return {
      useQueue: this.useQueue,
      queues: Object.keys(this.queues).reduce((acc, agent) => {
        acc[agent] = {
          length: this.queues[agent].length,
          processing: this.processing[agent],
          items: this.queues[agent]
        };
        return acc;
      }, {})
    };
  }
}

module.exports = QueueManager;
