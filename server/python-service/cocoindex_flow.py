"""
CocoIndex flow definition for code indexing and search
"""
import os
import logging
from typing import List, Dict, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from sentence_transformers import SentenceTransformer

import config
from chunking import smart_chunk

logger = logging.getLogger(__name__)


class CocoIndexFlow:
    """
    Manages the complete flow: indexing, embedding, storage, and search
    """

    def __init__(self):
        self.model = None
        self.db_conn = None
        self._initialize_model()
        self._initialize_database()

    def _initialize_model(self):
        """Load the embedding model"""
        logger.info(f"Loading embedding model: {config.EMBEDDING_MODEL}")
        try:
            self.model = SentenceTransformer(config.EMBEDDING_MODEL)
            logger.info(f"Model loaded successfully. Embedding dimension: {self.model.get_sentence_embedding_dimension()}")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise

    def _initialize_database(self):
        """Initialize database connection and create tables"""
        logger.info(f"Connecting to database: {config.DATABASE_URL.split('@')[1] if '@' in config.DATABASE_URL else config.DATABASE_URL}")

        try:
            self.db_conn = psycopg2.connect(config.DATABASE_URL)
            self._create_tables()
            logger.info("Database initialized successfully")
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            raise

    def _create_tables(self):
        """Create necessary database tables"""
        with self.db_conn.cursor() as cur:
            # Create extension if not exists
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

            # Create code_chunks table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS code_chunks (
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
            """)

            # Create index on repo_path for faster lookups
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_code_chunks_repo_path
                ON code_chunks(repo_path);
            """)

            # Create index for vector similarity search
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_code_chunks_embedding
                ON code_chunks USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """)

            self.db_conn.commit()

    def index_repository(self, repo_path: str, force: bool = False) -> Dict[str, Any]:
        """
        Index a repository

        Args:
            repo_path: Absolute path to repository
            force: If True, re-index even if already indexed

        Returns:
            Indexing statistics
        """
        logger.info(f"Starting indexing: {repo_path} (force={force})")

        if not os.path.exists(repo_path):
            raise ValueError(f"Repository path does not exist: {repo_path}")

        # Clear existing index if force
        if force:
            self._clear_repo_index(repo_path)

        # Walk directory and collect files
        files_to_index = self._collect_files(repo_path)
        logger.info(f"Found {len(files_to_index)} files to index")

        # Process and index files
        indexed_count = 0
        chunk_count = 0

        for file_path in files_to_index:
            try:
                chunks_added = self._index_file(repo_path, file_path)
                if chunks_added > 0:
                    indexed_count += 1
                    chunk_count += chunks_added
            except Exception as e:
                logger.warning(f"Failed to index {file_path}: {e}")

        logger.info(f"Indexing complete: {indexed_count} files, {chunk_count} chunks")

        return {
            'repo_path': repo_path,
            'files_indexed': indexed_count,
            'chunks_created': chunk_count,
            'files_found': len(files_to_index)
        }

    def _collect_files(self, repo_path: str) -> List[str]:
        """Collect indexable files from repository"""
        files = []

        for root, dirs, filenames in os.walk(repo_path):
            # Skip directories matching skip patterns
            dirs[:] = [d for d in dirs if not self._should_skip(os.path.join(root, d), repo_path)]

            for filename in filenames:
                file_path = os.path.join(root, filename)

                # Check if file should be indexed
                if self._should_index(file_path):
                    files.append(file_path)

        return files

    def _should_skip(self, path: str, repo_path: str) -> bool:
        """Check if path matches skip patterns"""
        rel_path = os.path.relpath(path, repo_path)

        for pattern in config.SKIP_PATTERNS:
            # Simple pattern matching (can be enhanced with fnmatch)
            pattern_clean = pattern.replace('**/', '').replace('/**', '')
            if pattern_clean in rel_path:
                return True

        return False

    def _should_index(self, file_path: str) -> bool:
        """Check if file should be indexed"""
        ext = os.path.splitext(file_path)[1].lower()
        return ext in config.INDEXABLE_EXTENSIONS

    def _index_file(self, repo_path: str, file_path: str) -> int:
        """
        Index a single file

        Returns:
            Number of chunks created
        """
        # Read file content
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            logger.warning(f"Cannot read {file_path}: {e}")
            return 0

        # Get file modification time
        file_mtime = os.path.getmtime(file_path)

        # Chunk the file
        rel_file_path = os.path.relpath(file_path, repo_path)
        chunks = smart_chunk(
            rel_file_path,
            content,
            config.MAX_CHUNK_SIZE,
            config.CHUNK_OVERLAP
        )

        if not chunks:
            return 0

        # Generate embeddings for all chunks
        chunk_texts = [chunk['chunk_text'] for chunk in chunks]
        embeddings = self.model.encode(chunk_texts, show_progress_bar=False)

        # Store in database
        with self.db_conn.cursor() as cur:
            for chunk, embedding in zip(chunks, embeddings):
                cur.execute("""
                    INSERT INTO code_chunks (
                        repo_path, file_path, chunk_text, chunk_type,
                        start_line, end_line, language, metadata,
                        embedding, file_mtime
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, to_timestamp(%s))
                """, (
                    repo_path,
                    rel_file_path,
                    chunk['chunk_text'],
                    chunk['chunk_type'],
                    chunk['start_line'],
                    chunk['end_line'],
                    chunk['language'],
                    psycopg2.extras.Json(chunk['metadata']),
                    embedding.tolist(),
                    file_mtime
                ))

        self.db_conn.commit()
        return len(chunks)

    def _clear_repo_index(self, repo_path: str):
        """Clear existing index for a repository"""
        logger.info(f"Clearing existing index for: {repo_path}")
        with self.db_conn.cursor() as cur:
            cur.execute("DELETE FROM code_chunks WHERE repo_path = %s", (repo_path,))
        self.db_conn.commit()

    def search(
        self,
        query: str,
        repo_path: str,
        limit: int = 10,
        threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Search for relevant code chunks

        Args:
            query: Search query
            repo_path: Repository to search in
            limit: Maximum results
            threshold: Minimum similarity score (0-1)

        Returns:
            List of matching chunks with scores
        """
        # Generate query embedding
        query_embedding = self.model.encode([query], show_progress_bar=False)[0]

        # Search database
        with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    file_path,
                    chunk_text,
                    chunk_type,
                    start_line,
                    end_line,
                    language,
                    metadata,
                    1 - (embedding <=> %s::vector) AS score
                FROM code_chunks
                WHERE repo_path = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (
                query_embedding.tolist(),
                repo_path,
                query_embedding.tolist(),
                limit * 2  # Fetch 2x, then filter by threshold
            ))

            results = cur.fetchall()

        # Filter by threshold and format
        filtered_results = []
        for row in results:
            if row['score'] >= threshold:
                filtered_results.append({
                    'file_path': row['file_path'],
                    'chunk_text': row['chunk_text'],
                    'chunk_type': row['chunk_type'],
                    'start_line': row['start_line'],
                    'end_line': row['end_line'],
                    'language': row['language'],
                    'score': float(row['score']),
                    'description': f"{row['chunk_type']} (lines {row['start_line']}-{row['end_line']})"
                })

        return filtered_results[:limit]

    def is_repository_indexed(self, repo_path: str) -> bool:
        """Check if a repository is indexed"""
        with self.db_conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) FROM code_chunks WHERE repo_path = %s
            """, (repo_path,))
            count = cur.fetchone()[0]

        return count > 0

    def get_index_stats(self) -> Dict[str, Any]:
        """Get indexing statistics"""
        with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Repository count
            cur.execute("SELECT COUNT(DISTINCT repo_path) as repo_count FROM code_chunks")
            repo_count = cur.fetchone()['repo_count']

            # Total chunks
            cur.execute("SELECT COUNT(*) as chunk_count FROM code_chunks")
            chunk_count = cur.fetchone()['chunk_count']

            # Per-repo stats
            cur.execute("""
                SELECT
                    repo_path,
                    COUNT(*) as chunks,
                    COUNT(DISTINCT file_path) as files,
                    MAX(indexed_at) as last_indexed
                FROM code_chunks
                GROUP BY repo_path
            """)
            repos = cur.fetchall()

        return {
            'repo_count': repo_count,
            'chunk_count': chunk_count,
            'repositories': [dict(r) for r in repos]
        }

    def close(self):
        """Close database connection"""
        if self.db_conn:
            self.db_conn.close()
            logger.info("Database connection closed")
