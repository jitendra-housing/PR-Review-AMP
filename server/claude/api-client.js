const Anthropic = require('@anthropic-ai/sdk');

/**
 * Claude API client with retry logic and model mapping
 */
class ClaudeAPIClient {
  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not set in environment');
    }

    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.modelMap = {
      'opus': 'claude-opus-4-5-20251101',
      'sonnet': 'claude-sonnet-4-5-20250929',
      'haiku': 'claude-3-5-haiku-20241022'
    };

    const modelKey = (process.env.MODEL || 'sonnet').toLowerCase();
    this.model = this.modelMap[modelKey] || this.modelMap['sonnet'];

    console.log(`[CLAUDE] Initialized with model: ${this.model} (${modelKey})`);
  }

  /**
   * Send message to Claude with retry logic
   * @param {Array} messages - Array of message objects
   * @param {Array} system - System prompt blocks (with cache_control)
   * @param {number} maxTokens - Maximum tokens for response
   * @param {boolean} stream - Enable streaming
   * @returns {Object|Stream} Response or stream
   */
  async sendMessage(messages, system, maxTokens = 4096, stream = false) {
    const options = {
      model: this.model,
      max_tokens: maxTokens,
      system: system,
      messages: messages
    };

    if (stream) {
      options.stream = true;
    }

    return this.executeWithRetry(async () => {
      if (stream) {
        return this.client.messages.stream(options);
      } else {
        return this.client.messages.create(options);
      }
    });
  }

  /**
   * Execute API call with exponential backoff retry
   * @param {Function} apiCall - API call function
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {*} API response
   */
  async executeWithRetry(apiCall, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;

        // Check if error is retryable (429 rate limit, 529 overloaded)
        const status = error.status || error.statusCode;
        const isRetryable = status === 429 || status === 529;

        if (!isRetryable || attempt === maxRetries) {
          console.error(`[CLAUDE] API error (attempt ${attempt}/${maxRetries}): ${error.message}`);
          throw error;
        }

        // Exponential backoff: 2^attempt seconds
        const delaySeconds = Math.pow(2, attempt);
        console.log(`[CLAUDE] Rate limited (${status}), retrying in ${delaySeconds}s (attempt ${attempt}/${maxRetries})...`);
        await this.sleep(delaySeconds * 1000);
      }
    }

    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get model name
   * @returns {string} Current model name
   */
  getModel() {
    return this.model;
  }

  /**
   * Switch model (useful for fallback scenarios)
   * @param {string} modelKey - Model key (opus, sonnet, haiku)
   */
  switchModel(modelKey) {
    if (this.modelMap[modelKey]) {
      this.model = this.modelMap[modelKey];
      console.log(`[CLAUDE] Switched to model: ${this.model} (${modelKey})`);
    } else {
      console.warn(`[CLAUDE] Unknown model key: ${modelKey}, keeping current model`);
    }
  }

  /**
   * Estimate tokens for text (rough approximation)
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Count usage from response
   * @param {Object} response - Claude API response
   * @returns {Object} Token usage breakdown
   */
  getUsage(response) {
    if (!response.usage) return null;

    return {
      input_tokens: response.usage.input_tokens || 0,
      output_tokens: response.usage.output_tokens || 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens || 0,
      cache_read_input_tokens: response.usage.cache_read_input_tokens || 0
    };
  }

  /**
   * Calculate cost for usage
   * @param {Object} usage - Usage object from getUsage()
   * @returns {number} Cost in USD
   */
  calculateCost(usage) {
    if (!usage) return 0;

    // Pricing per million tokens (as of Jan 2025)
    const pricing = {
      'claude-opus-4-5-20251101': {
        input: 15,
        output: 75,
        cache_write: 18.75,
        cache_read: 1.5
      },
      'claude-sonnet-4-5-20250929': {
        input: 3,
        output: 15,
        cache_write: 3.75,
        cache_read: 0.3
      },
      'claude-3-5-haiku-20241022': {
        input: 0.8,
        output: 4,
        cache_write: 1,
        cache_read: 0.08
      }
    };

    const modelPricing = pricing[this.model] || pricing['claude-sonnet-4-5-20250929'];

    const inputCost = (usage.input_tokens / 1_000_000) * modelPricing.input;
    const outputCost = (usage.output_tokens / 1_000_000) * modelPricing.output;
    const cacheWriteCost = (usage.cache_creation_input_tokens / 1_000_000) * modelPricing.cache_write;
    const cacheReadCost = (usage.cache_read_input_tokens / 1_000_000) * modelPricing.cache_read;

    return inputCost + outputCost + cacheWriteCost + cacheReadCost;
  }
}

module.exports = ClaudeAPIClient;
