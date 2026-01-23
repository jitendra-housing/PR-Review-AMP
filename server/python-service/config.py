"""
Configuration management for CocoIndex service
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Database Configuration
DATABASE_URL = os.getenv(
    'COCOINDEX_DATABASE_URL',
    'postgresql://postgres@localhost:5432/pr_review_coco'
)

# Embedding Model Configuration
EMBEDDING_MODEL = os.getenv(
    'EMBEDDING_MODEL',
    'sentence-transformers/all-MiniLM-L6-v2'
)

# Chunking Configuration
MAX_CHUNK_SIZE = int(os.getenv('MAX_CHUNK_SIZE', '500'))  # lines
CHUNK_OVERLAP = int(os.getenv('CHUNK_OVERLAP', '100'))    # lines

# File Pattern Configuration
INDEXABLE_EXTENSIONS = [
    '.js', '.jsx', '.ts', '.tsx',
    '.py', '.swift', '.kt', '.java',
    '.go', '.rs', '.rb', '.php',
    '.c', '.cpp', '.h', '.hpp',
    '.cs', '.scala', '.clj',
    '.vue', '.svelte'
]

SKIP_PATTERNS = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.min.js',
    '**/*.lock',
    '**/vendor/**',
    '**/.git/**',
    '**/target/**',
    '**/__pycache__/**',
    '**/venv/**',
    '**/coverage/**',
    '**/.next/**',
    '**/.cache/**'
]

# Service Configuration
FLASK_PORT = int(os.getenv('FLASK_PORT', '5000'))
FLASK_HOST = os.getenv('FLASK_HOST', '0.0.0.0')
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
