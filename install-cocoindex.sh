#!/bin/bash
set -e

echo "=== CocoIndex Installation ==="
echo

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"
else
  OS="linux"
fi

echo "Detected OS: $OS"
echo

# 1. Install PostgreSQL + pgvector
echo "Step 1: Installing PostgreSQL + pgvector..."
if [ "$OS" == "macos" ]; then
  # Check if PostgreSQL is already installed
  if ! brew list postgresql@16 &>/dev/null; then
    echo "Installing PostgreSQL 16..."
    brew install postgresql@16
  else
    echo "PostgreSQL 16 already installed"
  fi

  # Check if pgvector is already installed
  if ! brew list pgvector &>/dev/null; then
    echo "Installing pgvector..."
    brew install pgvector
  else
    echo "pgvector already installed"
  fi

  # Start PostgreSQL
  echo "Starting PostgreSQL..."
  brew services start postgresql@16
  sleep 3  # Wait for PostgreSQL to start
else
  echo "Linux installation:"
  echo "  sudo apt update"
  echo "  sudo apt install -y postgresql postgresql-contrib"
  echo "  sudo apt install -y postgresql-16-pgvector"
  echo "  sudo systemctl start postgresql"
  echo "  sudo systemctl enable postgresql"
  echo
  echo "Please run these commands manually with sudo privileges."
  exit 1
fi

echo "✓ PostgreSQL + pgvector installed"
echo

# 2. Create database
echo "Step 2: Creating database..."
if [ "$OS" == "macos" ]; then
  # Check if database exists
  if psql -U postgres -lqt | cut -d \| -f 1 | grep -qw pr_review_coco; then
    echo "Database pr_review_coco already exists"
  else
    psql -U postgres <<EOF
CREATE DATABASE pr_review_coco;
\c pr_review_coco
CREATE EXTENSION IF NOT EXISTS vector;
EOF
    echo "✓ Database created"
  fi
else
  echo "Please create the database manually:"
  echo "  sudo -u postgres psql"
  echo "  CREATE DATABASE pr_review_coco;"
  echo "  \\c pr_review_coco"
  echo "  CREATE EXTENSION IF NOT EXISTS vector;"
  exit 1
fi

echo

# 3. Install Python dependencies
echo "Step 3: Installing Python dependencies..."
cd server/python-service

if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
fi

echo "Activating virtual environment and installing packages..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "✓ Python dependencies installed"
echo

# 4. Download embedding model (pre-cache)
echo "Step 4: Downloading embedding model (this may take a few minutes)..."
python -c "from sentence_transformers import SentenceTransformer; print('Loading model...'); model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2'); print('Model loaded successfully!')"

echo "✓ Embedding model cached"
echo

# 5. Verify installation
echo "Step 5: Verifying installation..."
cd ../..

# Test database connection
if psql -U postgres -d pr_review_coco -c "SELECT 1;" &>/dev/null; then
  echo "✓ Database connection successful"
else
  echo "✗ Database connection failed"
  exit 1
fi

echo
echo "======================================"
echo "✅ CocoIndex installation complete!"
echo "======================================"
echo
echo "Next steps:"
echo
echo "1. Start the CocoIndex service:"
echo "   cd server/python-service"
echo "   source venv/bin/activate"
echo "   python app.py"
echo
echo "2. In another terminal, test the service:"
echo "   cd server/python-service"
echo "   ./cli.py health"
echo
echo "3. Index your first repository:"
echo "   ./cli.py index /absolute/path/to/your/repo"
echo
echo "4. Update server/.env with:"
echo "   ENABLE_SEMANTIC_SEARCH=true"
echo "   CONTEXT_STRATEGY=SEMANTIC_SEARCH"
echo "   REPO_PATH_MAPPING='{\"github-owner/repo\":\"/local/path/to/repo\"}'"
echo
echo "5. Start the main server:"
echo "   cd ../"
echo "   npm start"
echo
