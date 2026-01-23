# CocoIndex Python Service

Flask API service for semantic code search using CocoIndex and pgvector.

## Overview

This service provides:
- **Code indexing**: Process repositories and create searchable indexes
- **Semantic search**: Find relevant code using natural language queries
- **Vector storage**: PostgreSQL + pgvector for efficient similarity search
- **HTTP API**: Clean REST endpoints for Node.js integration

## Project Structure

```
python-service/
├── app.py                 # Flask API server (main entry point)
├── cocoindex_flow.py      # CocoIndex flow management
├── config.py              # Configuration settings
├── chunking.py            # Code chunking logic
├── cli.py                 # Command-line interface
├── requirements.txt       # Python dependencies
├── .env                   # Environment configuration
└── README.md             # This file
```

## Installation

### 1. Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

Copy `.env.example` or create `.env`:

```bash
COCOINDEX_DATABASE_URL=postgresql://postgres@localhost:5432/pr_review_coco
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
MAX_CHUNK_SIZE=500
CHUNK_OVERLAP=100
FLASK_PORT=5000
FLASK_HOST=0.0.0.0
DEBUG=false
```

### 4. Setup Database

Ensure PostgreSQL with pgvector is installed and running:

```bash
# Create database
psql -U postgres -c "CREATE DATABASE pr_review_coco;"
psql -U postgres -d pr_review_coco -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 5. Start the Service

```bash
python app.py
```

The service will start on `http://localhost:5000`

## API Endpoints

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "service": "cocoindex",
  "database": "connected",
  "flow": "loaded",
  "indexed_repos": 2,
  "total_chunks": 1543
}
```

### Index Repository

```bash
POST /index
Content-Type: application/json

{
  "repo_path": "/absolute/path/to/repo",
  "force": false
}
```

**Response:**
```json
{
  "success": true,
  "repo_path": "/path/to/repo",
  "files_indexed": 150,
  "chunks_created": 287,
  "files_found": 150,
  "duration_seconds": 23.4
}
```

### Check if Indexed

```bash
POST /check-indexed
Content-Type: application/json

{
  "repo_path": "/absolute/path/to/repo"
}
```

**Response:**
```json
{
  "success": true,
  "indexed": true,
  "repo_path": "/path/to/repo"
}
```

### Search Code

```bash
POST /search
Content-Type: application/json

{
  "query": "authentication function",
  "repo_path": "/absolute/path/to/repo",
  "limit": 10,
  "threshold": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "file_path": "src/auth/login.js",
      "chunk_text": "function authenticate(user, password) { ... }",
      "chunk_type": "chunk_0",
      "start_line": 15,
      "end_line": 45,
      "language": "javascript",
      "score": 0.89,
      "description": "chunk_0 (lines 15-45)"
    }
  ],
  "count": 5,
  "duration_ms": 234.5
}
```

### Re-index Repository

```bash
POST /reindex
Content-Type: application/json

{
  "repo_path": "/absolute/path/to/repo"
}
```

**Response:**
```json
{
  "success": true,
  "files_updated": 150,
  "chunks_created": 287,
  "duration_seconds": 8.2
}
```

### Get Statistics

```bash
GET /stats
```

**Response:**
```json
{
  "success": true,
  "repo_count": 2,
  "chunk_count": 1543,
  "repositories": [
    {
      "repo_path": "/path/to/repo1",
      "chunks": 287,
      "files": 150,
      "last_indexed": "2026-01-23T10:30:45"
    }
  ]
}
```

## CLI Tool

The CLI tool (`cli.py`) provides easy command-line access:

### Commands

```bash
# Check service health
./cli.py health

# Index a repository
./cli.py index /path/to/repo
./cli.py index /path/to/repo --force  # Force re-index

# Check index status
./cli.py status /path/to/repo

# Search code
./cli.py search "query" /path/to/repo
./cli.py search "authentication" /path/to/repo --limit 5 --threshold 0.8

# Re-index repository
./cli.py reindex /path/to/repo

# View statistics
./cli.py stats
```

## Configuration

### config.py

Main configuration file with settings for:

#### Database
- `DATABASE_URL`: PostgreSQL connection string

#### Embedding Model
- `EMBEDDING_MODEL`: Sentence Transformers model name
- Default: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)

#### Chunking
- `MAX_CHUNK_SIZE`: Maximum lines per chunk (default: 500)
- `CHUNK_OVERLAP`: Overlap between chunks (default: 100)

#### File Patterns
- `INDEXABLE_EXTENSIONS`: File types to index
- `SKIP_PATTERNS`: Directories/patterns to skip

#### Service
- `FLASK_PORT`: Port to run on (default: 5000)
- `FLASK_HOST`: Host to bind to (default: 0.0.0.0)
- `DEBUG`: Debug mode (default: false)

## Architecture

### Indexing Flow

1. **File Discovery**: Walk directory tree, filter by extensions
2. **Chunking**: Split files into manageable pieces
   - Small files: whole file
   - Large files: sliding window with overlap
3. **Embedding**: Generate vector embeddings using Sentence Transformers
4. **Storage**: Save to PostgreSQL with pgvector

### Search Flow

1. **Query Embedding**: Convert search query to vector
2. **Similarity Search**: PostgreSQL cosine similarity via pgvector
3. **Filtering**: Apply threshold to results
4. **Ranking**: Return top-k results by score

### Database Schema

```sql
CREATE TABLE code_chunks (
    id SERIAL PRIMARY KEY,
    repo_path TEXT NOT NULL,
    file_path TEXT NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_type TEXT,
    start_line INTEGER,
    end_line INTEGER,
    language TEXT,
    metadata JSONB,
    embedding vector(384),
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_mtime TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_code_chunks_repo_path ON code_chunks(repo_path);
CREATE INDEX idx_code_chunks_embedding ON code_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## Development

### Running in Debug Mode

```bash
DEBUG=true python app.py
```

### Testing

```bash
# Start service
python app.py

# In another terminal, run tests
cd ..
node test-cocoindex.js
```

### Adding New Languages

Edit `chunking.py` to add language support:

```python
# In get_language_from_extension()
lang_map = {
    '.js': 'javascript',
    '.newlang': 'newlanguage',  # Add here
    # ...
}
```

And in `config.py`:

```python
INDEXABLE_EXTENSIONS = [
    '.js', '.jsx',
    '.newlang',  # Add here
    # ...
]
```

## Performance

### Indexing
- **Speed**: ~10ms per chunk (CPU-dependent)
- **Throughput**: 100-200 files/minute
- **Memory**: ~500MB baseline + models

### Search
- **Latency**: 100-500ms (P50), 500ms-1s (P95)
- **Throughput**: 10-20 queries/second

### Optimization Tips

1. **Increase chunk size** for faster indexing (less granular)
2. **Add to SKIP_PATTERNS** to exclude large generated files
3. **Use IVFFlat index** for large datasets (already enabled)
4. **Consider GPU** for embedding generation (requires setup)

## Troubleshooting

### Service won't start

Check:
1. Virtual environment activated: `source venv/bin/activate`
2. Dependencies installed: `pip list | grep cocoindex`
3. PostgreSQL running: `pg_isready`
4. Database exists: `psql -U postgres -l | grep pr_review_coco`

### Slow indexing

Possible causes:
- CPU-bound embedding generation
- Large files (>1000 lines)
- Disk I/O bottleneck

Solutions:
- Reduce `MAX_CHUNK_SIZE`
- Skip large files
- Use SSD storage

### Search returns no results

Check:
1. Repository indexed: `./cli.py status /path/to/repo`
2. Threshold not too high (try 0.5-0.6)
3. Query is descriptive (not too vague)
4. Database has data: `psql -U postgres -d pr_review_coco -c "SELECT COUNT(*) FROM code_chunks;"`

## Future Enhancements

- [ ] Tree-sitter for function-level parsing
- [ ] True incremental indexing (mtime tracking)
- [ ] Multi-branch support
- [ ] GPU acceleration
- [ ] Batch API for multiple queries
- [ ] WebSocket streaming results
- [ ] Admin UI for monitoring

## Dependencies

Key packages:
- **cocoindex**: Core indexing framework
- **flask**: HTTP API server
- **psycopg2-binary**: PostgreSQL driver
- **sentence-transformers**: Embedding model
- **click**: CLI tool framework

See `requirements.txt` for full list.

## License

Same as parent project (PR-Review-AMP).

## Support

For issues or questions:
1. Check the main setup guide: `../../COCOINDEX_SETUP.md`
2. Review logs for error messages
3. Test with CLI tool: `./cli.py health`
4. Check PostgreSQL status: `pg_isready`
