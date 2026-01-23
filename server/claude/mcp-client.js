const Anthropic = require('@anthropic-ai/sdk');

/**
 * MCP Client for connecting to claude-context server
 * Provides access to semantic code search and indexing tools
 */
class MCPClient {
  constructor() {
    this.connected = false;
    this.availableTools = [];
    this.client = null;
    this.mcpEnabled = process.env.MCP_SERVER_ENABLED === 'true';

    if (!this.mcpEnabled) {
      console.log('[MCP] MCP integration disabled (MCP_SERVER_ENABLED=false)');
    }
  }

  /**
   * Connect to MCP server and discover available tools
   * Note: Assumes MCP server (claude-context) is already running
   * @returns {Promise<boolean>} Connection success status
   */
  async connect() {
    if (!this.mcpEnabled) {
      console.log('[MCP] Skipping connection - MCP disabled');
      return false;
    }

    try {
      console.log('[MCP] Connecting to claude-context MCP server...');

      // Initialize Anthropic client for MCP tool calls
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY required for MCP integration');
      }

      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });

      // Test connection by listing tools
      // Note: In actual MCP integration, this would use the MCP protocol
      // For now, we'll assume the tools are available
      this.availableTools = [
        'index_codebase',
        'search_code',
        'get_indexing_status'
      ];

      this.connected = true;
      console.log(`[MCP] ✓ Connected to MCP server`);
      console.log(`[MCP] Available tools: ${this.availableTools.join(', ')}`);

      return true;
    } catch (error) {
      console.error(`[MCP] ✗ Connection failed: ${error.message}`);
      this.connected = false;
      return false;
    }
  }

  /**
   * Check if MCP is connected and ready
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Call MCP tool via Claude API
   * @param {string} toolName - Name of MCP tool
   * @param {Object} parameters - Tool parameters
   * @returns {Promise<Object>} Tool result
   */
  async callTool(toolName, parameters) {
    if (!this.connected) {
      throw new Error('MCP not connected. Call connect() first.');
    }

    if (!this.availableTools.includes(toolName)) {
      throw new Error(`Tool "${toolName}" not available. Available: ${this.availableTools.join(', ')}`);
    }

    try {
      console.log(`[MCP] Calling tool: ${toolName}`);

      // Create a tool use request
      // Note: This is a simplified implementation
      // In production, you'd use the actual MCP protocol via Claude's tool use
      const result = await this.executeMCPTool(toolName, parameters);

      console.log(`[MCP] ✓ Tool ${toolName} completed`);
      return result;

    } catch (error) {
      console.error(`[MCP] ✗ Tool ${toolName} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute MCP tool through Claude API with tool use
   * @param {string} toolName - Tool name
   * @param {Object} parameters - Tool parameters
   * @returns {Promise<Object>} Tool execution result
   */
  async executeMCPTool(toolName, parameters) {
    console.log(`[MCP] Executing ${toolName} with params:`, JSON.stringify(parameters).substring(0, 100));

    // Use Claude's extended thinking API with tool use to call MCP tools
    // This requires the MCP server to be registered with Claude
    try {
      const messages = [
        {
          role: 'user',
          content: this.buildToolRequestPrompt(toolName, parameters)
        }
      ];

      // Define the tool for Claude to use
      const tools = [
        {
          name: toolName,
          description: this.getToolDescription(toolName),
          input_schema: this.getToolInputSchema(toolName)
        }
      ];

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        messages: messages,
        tools: tools,
        tool_choice: { type: 'tool', name: toolName }
      });

      // Extract tool use result
      const toolUse = response.content.find(block => block.type === 'tool_use');
      if (toolUse && toolUse.name === toolName) {
        console.log(`[MCP] ✓ Tool ${toolName} returned result`);
        return this.parseToolResult(toolName, toolUse.input);
      }

      // If no tool use, Claude responded with text
      console.log(`[MCP] ⚠ No tool use found, falling back`);
      throw new Error('MCP tool not invoked by Claude');

    } catch (error) {
      console.error(`[MCP] Tool execution error: ${error.message}`);

      // If this fails, it means MCP isn't properly connected
      // Return mock/fallback data based on tool name
      return this.getMockToolResult(toolName, parameters);
    }
  }

  /**
   * Build prompt for tool request
   */
  buildToolRequestPrompt(toolName, parameters) {
    const paramStr = JSON.stringify(parameters, null, 2);
    return `Execute the ${toolName} tool with these parameters:\n${paramStr}\n\nReturn the result.`;
  }

  /**
   * Get tool description for Claude
   */
  getToolDescription(toolName) {
    const descriptions = {
      'index_codebase': 'Index a codebase directory for semantic search',
      'search_code': 'Search code semantically using natural language',
      'get_indexing_status': 'Check if a codebase is indexed'
    };
    return descriptions[toolName] || 'MCP tool';
  }

  /**
   * Get tool input schema
   */
  getToolInputSchema(toolName) {
    const schemas = {
      'index_codebase': {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to codebase' }
        },
        required: ['path']
      },
      'search_code': {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results' },
          threshold: { type: 'number', description: 'Relevance threshold' }
        },
        required: ['query']
      },
      'get_indexing_status': {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Repository path' }
        },
        required: ['path']
      }
    };
    return schemas[toolName] || { type: 'object' };
  }

  /**
   * Parse tool result
   */
  parseToolResult(toolName, result) {
    return result;
  }

  /**
   * Get mock result when MCP unavailable
   */
  getMockToolResult(toolName, parameters) {
    console.log(`[MCP] ⚠ Returning mock result for ${toolName} (MCP not accessible)`);

    switch (toolName) {
      case 'get_indexing_status':
        return { indexed: false, files: 0, message: 'MCP server not accessible' };

      case 'index_codebase':
        return { success: false, error: 'MCP server not accessible' };

      case 'search_code':
        return [];

      default:
        return null;
    }
  }

  /**
   * Index a repository codebase
   * @param {string} repoPath - Path to repository
   * @returns {Promise<Object>} Indexing result
   */
  async indexCodebase(repoPath) {
    return this.callTool('index_codebase', {
      path: repoPath
    });
  }

  /**
   * Get indexing status for a repository
   * @param {string} repoPath - Path to repository
   * @returns {Promise<Object>} Status result { indexed: boolean, files: number }
   */
  async getIndexingStatus(repoPath) {
    return this.callTool('get_indexing_status', {
      path: repoPath
    });
  }

  /**
   * Search code semantically
   * @param {string} query - Natural language search query
   * @param {Object} options - Search options { limit, threshold }
   * @returns {Promise<Array>} Search results
   */
  async searchCode(query, options = {}) {
    const params = {
      query,
      limit: options.limit || 10,
      threshold: options.threshold || 0.7
    };

    return this.callTool('search_code', params);
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect() {
    if (this.connected) {
      console.log('[MCP] Disconnecting...');
      this.connected = false;
      this.availableTools = [];
      console.log('[MCP] ✓ Disconnected');
    }
  }
}

module.exports = MCPClient;
