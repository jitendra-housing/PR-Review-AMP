# CocoIndex Setup Guide

Complete guide for setting up CocoIndex semantic search for PR reviews.

## Overview

CocoIndex provides intelligent code context for PR reviews using:
- **PostgreSQL + pgvector**: Self-hosted vector database
- **Sentence Transformers**: Local embedding generation (384 dimensions)
- **Incremental indexing**: Only re-index changed files
- **HTTP API**: Clean separation between Node.js and Python

## Architecture

```
┌─────────────────────────────────────────┐
│   Node.js Server (Express)              │
│   - Webhook handling                    │
│   - PR review orchestration             │
│   - semantic-search.js (HTTP client)    │
└───────────────┬─────────────────────────┘
                │ HTTP (localhost:5000)
                ▼
┌─────────────────────────────────────────┐
│   Python CocoIndex Service (Flask)      │
│   - CocoIndex flow management           │
│   - Vector search queries               │
│   - Incremental indexing                │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│   PostgreSQL + pgvector                 │
│   - Vector embeddings (384 dimensions)  │
│   - Code metadata & chunks              │
└─────────────────────────────────────────┘
```

## Prerequisites

- **macOS** (Linux support available but requires manual setup)
- **PostgreSQL 16** with pgvector extension
- **Python 3.8+** with pip and venv
- **Node.js 16+**
- **Homebrew** (for macOS installation)

## Quick Start

### 1. Automated Installation (macOS)

Run the installation script:

```bash
./install-cocoindex.sh
```

This will:
1. Install PostgreSQL 16 + pgvector via Homebrew
2. Create `pr_review_coco` database
3. Set up Python virtual environment
4. Install Python dependencies
5. Download embedding model (one-time ~90MB download)

### 2. Manual Installation (Linux or Custom Setup)

#### Install PostgreSQL + pgvector

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo apt install -y postgresql-16-pgvector

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Create Database

```bash
sudo -u postgres psql <<EOF
CREATE DATABASE pr_review_coco;
\c pr_review_coco
CREATE EXTENSION IF NOT EXISTS vector;
CREATE USER cocoindex WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE pr_review_coco TO cocoindex;
EOF
```

#### Install Python Dependencies

```bash
cd server/python-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Download embedding model
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"
```

### 3. Start CocoIndex Service

```bash
cd server/python-service
source venv/bin/activate
python app.py
```

You should see:
```
INFO:__main__:Starting CocoIndex service on 0.0.0.0:5000
```

Keep this running in a terminal window.

### 4. Test the Service

In a new terminal:

```bash
cd server/python-service
./cli.py health
```

Expected output:
```
✅ Status: ok
Database: connected
Flow: loaded
Indexed repositories: 0
Total chunks: 0
```

### 5. Index Your First Repository

```bash
# Replace with your actual repository path
./cli.py index /Users/yourname/path/to/your/repo
```

This will:
- Scan all code files (`.js`, `.ts`, `.py`, etc.)
- Chunk large files intelligently
- Generate embeddings
- Store in PostgreSQL

**Indexing Time:**
- Small repo (100 files): < 1 minute
- Medium repo (1000 files): 2-5 minutes
- Large repo (10,000 files): 20-30 minutes

### 6. Configure Node.js Server

Edit `server/.env`:

```bash
# Enable semantic search
ENABLE_SEMANTIC_SEARCH=true
CONTEXT_STRATEGY=SEMANTIC_SEARCH

# CocoIndex service URL
COCOINDEX_SERVICE_URL=http://localhost:5000

# Search parameters
SEMANTIC_SEARCH_LIMIT=10
SEMANTIC_SEARCH_THRESHOLD=0.7
SEMANTIC_SEARCH_TIMEOUT=30000

# Map GitHub repos to local paths (JSON format)
# IMPORTANT: Use absolute paths
REPO_PATH_MAPPING={"your-org/your-repo":"/absolute/path/to/local/repo"}
```

**Example:**
```bash
REPO_PATH_MAPPING={"elarahq/housing-app":"/Users/jitendra/Documents/Work/housing-app"}
```

### 7. Test the Integration

Run the test suite:

```bash
cd server
TEST_REPO_PATH=/path/to/your/indexed/repo node test-cocoindex.js
```

### 8. Start the Main Server

```bash
cd server
npm start
```

Your PR review system will now use semantic search for intelligent code context!

## CLI Tool Reference

The CLI tool (`cli.py`) provides easy management:

### Health Check
```bash
./cli.py health
```

### Index a Repository
```bash
./cli.py index /path/to/repo

# Force re-index (clears existing index)
./cli.py index /path/to/repo --force
```

### Check Index Status
```bash
./cli.py status /path/to/repo
```

### Search Code
```bash
./cli.py search "authentication function" /path/to/repo

# With options
./cli.py search "error handling" /path/to/repo --limit 5 --threshold 0.8
```

### Re-index (Incremental)
```bash
./cli.py reindex /path/to/repo
```

### View Statistics
```bash
./cli.py stats
```

## Configuration Reference

### Python Service (`.env` in `python-service/`)

```bash
# Database connection
COCOINDEX_DATABASE_URL=postgresql://postgres@localhost:5432/pr_review_coco

# Embedding model
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Chunking parameters
MAX_CHUNK_SIZE=500       # lines
CHUNK_OVERLAP=100        # lines

# Service settings
FLASK_PORT=5000
FLASK_HOST=0.0.0.0
DEBUG=false
```

### Node.js Server (`.env` in `server/`)

```bash
# Enable semantic search
ENABLE_SEMANTIC_SEARCH=true
CONTEXT_STRATEGY=SEMANTIC_SEARCH

# Service connection
COCOINDEX_SERVICE_URL=http://localhost:5000

# Search parameters
SEMANTIC_SEARCH_LIMIT=10           # Max results per query
SEMANTIC_SEARCH_THRESHOLD=0.7      # Min similarity (0-1)
SEMANTIC_SEARCH_TIMEOUT=30000      # Request timeout (ms)

# Repository mappings (JSON)
REPO_PATH_MAPPING={"owner/repo":"/local/path"}
```

## Troubleshooting

### Issue: Python service won't start

**Error:** `ModuleNotFoundError: No module named 'cocoindex'`

**Solution:**
```bash
cd server/python-service
source venv/bin/activate
pip install -r requirements.txt
```

### Issue: Database connection failed

**Error:** `could not connect to server`

**Solution:**
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Start if needed
brew services start postgresql@16

# Test connection
psql -U postgres -d pr_review_coco -c "SELECT 1;"
```

### Issue: Indexing is very slow

**Symptoms:** > 10 minutes for 1000 files

**Causes:**
- CPU-intensive embedding generation
- Large files
- Slow disk I/O

**Solutions:**
1. Reduce batch size (future enhancement)
2. Use smaller embedding model (lower quality)
3. Skip large files in config

### Issue: Search returns no results

**Possible causes:**

1. **Repository not indexed:**
   ```bash
   ./cli.py status /path/to/repo
   ```

2. **Threshold too high:**
   Lower the threshold in `.env`:
   ```bash
   SEMANTIC_SEARCH_THRESHOLD=0.5
   ```

3. **Wrong repository path:**
   Check `REPO_PATH_MAPPING` uses absolute paths

4. **Database empty:**
   ```bash
   psql -U postgres -d pr_review_coco -c "SELECT COUNT(*) FROM code_chunks;"
   ```

### Issue: Circuit breaker open

**Error:** `Circuit breaker open - service unavailable`

**Causes:**
- Python service crashed
- Network issue
- 3+ consecutive failures

**Solutions:**
1. Check Python service is running:
   ```bash
   curl http://localhost:5000/health
   ```

2. Restart Python service:
   ```bash
   cd server/python-service
   source venv/bin/activate
   python app.py
   ```

3. Wait 1 minute for circuit breaker to reset

## Performance Tuning

### Indexing Performance

**Baseline:**
- ~10ms per code chunk (CPU, M1 Mac)
- ~100-200 files/minute

**Optimizations:**
1. Skip large generated files (add to `SKIP_PATTERNS` in `config.py`)
2. Increase `MAX_CHUNK_SIZE` (fewer chunks, less granular)
3. Use GPU acceleration (requires CUDA setup)

### Search Performance

**Baseline:**
- 100-500ms per query (P50)
- 500ms-1s per query (P95)

**Optimizations:**
1. Increase `threshold` to reduce result processing
2. Reduce `limit` for fewer results
3. Add PostgreSQL indexes (already configured)

### Database Growth

**Typical size:**
- ~1MB per 100 files indexed
- ~10KB per code chunk

**Maintenance:**
```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('pr_review_coco'));

-- Check table sizes
SELECT pg_size_pretty(pg_total_relation_size('code_chunks'));

-- Clear old repositories
DELETE FROM code_chunks WHERE repo_path = '/old/repo/path';
```

## Production Deployment

### Using systemd (Linux)

Create `/etc/systemd/system/cocoindex.service`:

```ini
[Unit]
Description=CocoIndex API Service
After=network.target postgresql.service

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/PR-Review-AMP/server/python-service
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/python app.py
Restart=always
RestartSec=10
StandardOutput=append:/var/log/cocoindex.log
StandardError=append:/var/log/cocoindex.error.log

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable cocoindex
sudo systemctl start cocoindex
sudo systemctl status cocoindex
```

### Using Docker (Future Enhancement)

CocoIndex can be containerized for easier deployment. This requires:
1. Dockerfile for Python service
2. docker-compose.yml for PostgreSQL + service
3. Volume mounts for repository access

## Next Steps

1. **Test with a PR:** Trigger a webhook to see semantic search in action
2. **Tune threshold:** Adjust based on result quality
3. **Index more repos:** Add more mappings to `REPO_PATH_MAPPING`
4. **Monitor performance:** Check logs for search times and quality
5. **Set up auto re-indexing:** Enable periodic updates (optional)

## Support

- **GitHub Issues:** [Create an issue](https://github.com/your-org/pr-review-amp/issues)
- **CocoIndex Docs:** https://cocoindex.io/docs
- **pgvector Docs:** https://github.com/pgvector/pgvector

## FAQ

**Q: Can I use a different embedding model?**
A: Yes, edit `EMBEDDING_MODEL` in `.env`. Must be a sentence-transformers model. Note: changing models requires re-indexing.

**Q: How much disk space do I need?**
A: Roughly 1MB per 100 files. A 10,000 file repo ≈ 100MB.

**Q: Can I index multiple branches?**
A: Currently, only one branch per repo. Index the main branch. Future versions may support multi-branch.

**Q: What happens if my code changes?**
A: Run `./cli.py reindex /path/to/repo` to update. Future: automatic detection.

**Q: Can I use remote PostgreSQL?**
A: Yes, update `COCOINDEX_DATABASE_URL` to point to your remote instance.

**Q: Does this work with monorepos?**
A: Yes, but be aware of indexing time. Consider indexing specific subdirectories.
