/**
 * Semantic search stub
 * Zilliz implementation removed - will be replaced by CocoIndex
 */
class SemanticSearch {
  constructor() {
    console.log('[SEMANTIC] Semantic search disabled (Zilliz removed)');
  }

  async initialize() {
    console.log('[SEMANTIC] Skipping initialization - semantic search disabled');
    return false;
  }

  async checkRepositoryIndexed(repoPath) {
    return false;
  }

  async searchRelevantCode(query, options = {}) {
    return [];
  }

  async getFileContext(file, repoPath) {
    return { file: file.filename, relatedCode: [] };
  }

  async getFilesContext(files, repoPath) {
    return files.map(file => ({ file: file.filename, relatedCode: [] }));
  }

  async disconnect() {
    // No-op
  }
}

module.exports = SemanticSearch;
