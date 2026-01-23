"""
Flask API server for CocoIndex semantic search
"""
import logging
import time
from flask import Flask, request, jsonify
from flask_cors import CORS

import config
from cocoindex_flow import CocoIndexFlow

# Configure logging
logging.basicConfig(
    level=logging.INFO if not config.DEBUG else logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Initialize CocoIndex flow
flow = None

try:
    logger.info("Initializing CocoIndex flow...")
    flow = CocoIndexFlow()
    logger.info("CocoIndex flow initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize CocoIndex flow: {e}")
    logger.error("Service will start but operations will fail")


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    # Check database connection
    db_healthy = False
    if flow and flow.db_conn:
        try:
            with flow.db_conn.cursor() as cur:
                cur.execute("SELECT 1")
            db_healthy = True
        except:
            pass

    # Check if flow is loaded
    flow_healthy = flow is not None

    # Get index stats
    stats = {}
    if flow_healthy and db_healthy:
        try:
            stats = flow.get_index_stats()
        except Exception as e:
            logger.warning(f"Failed to get stats: {e}")

    status = "ok" if (db_healthy and flow_healthy) else "degraded"

    return jsonify({
        "status": status,
        "service": "cocoindex",
        "database": "connected" if db_healthy else "disconnected",
        "flow": "loaded" if flow_healthy else "not_loaded",
        "indexed_repos": stats.get('repo_count', 0),
        "total_chunks": stats.get('chunk_count', 0)
    })


@app.route('/index', methods=['POST'])
def index_repository():
    """Index a repository"""
    if not flow:
        return jsonify({"success": False, "error": "Service not initialized"}), 500

    data = request.json
    repo_path = data.get('repo_path')
    force = data.get('force', False)

    if not repo_path:
        return jsonify({"success": False, "error": "repo_path is required"}), 400

    logger.info(f"Index request: {repo_path} (force={force})")

    start_time = time.time()

    try:
        stats = flow.index_repository(repo_path, force=force)
        duration = time.time() - start_time

        logger.info(f"Indexing complete: {stats['files_indexed']} files, {stats['chunks_created']} chunks in {duration:.1f}s")

        return jsonify({
            "success": True,
            **stats,
            "duration_seconds": round(duration, 2)
        })

    except Exception as e:
        logger.error(f"Indexing failed: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/check-indexed', methods=['POST'])
def check_indexed():
    """Check if a repository is indexed"""
    if not flow:
        return jsonify({"success": False, "error": "Service not initialized"}), 500

    data = request.json
    repo_path = data.get('repo_path')

    if not repo_path:
        return jsonify({"success": False, "error": "repo_path is required"}), 400

    try:
        indexed = flow.is_repository_indexed(repo_path)
        return jsonify({"success": True, "indexed": indexed, "repo_path": repo_path})

    except Exception as e:
        logger.error(f"Check indexed failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/search', methods=['POST'])
def search():
    """Search for relevant code"""
    if not flow:
        return jsonify({"success": False, "error": "Service not initialized"}), 500

    data = request.json
    query = data.get('query')
    repo_path = data.get('repo_path')
    limit = data.get('limit', 10)
    threshold = data.get('threshold', 0.7)

    if not query:
        return jsonify({"success": False, "error": "query is required"}), 400
    if not repo_path:
        return jsonify({"success": False, "error": "repo_path is required"}), 400

    logger.info(f"Search request: '{query[:50]}...' in {repo_path}")

    start_time = time.time()

    try:
        results = flow.search(query, repo_path, limit, threshold)
        duration = time.time() - start_time

        logger.info(f"Search complete: {len(results)} results in {duration*1000:.0f}ms")

        return jsonify({
            "success": True,
            "results": results,
            "count": len(results),
            "duration_ms": round(duration * 1000, 2)
        })

    except Exception as e:
        logger.error(f"Search failed: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/reindex', methods=['POST'])
def reindex():
    """Re-index changed files (incremental update)"""
    if not flow:
        return jsonify({"success": False, "error": "Service not initialized"}), 500

    data = request.json
    repo_path = data.get('repo_path')

    if not repo_path:
        return jsonify({"success": False, "error": "repo_path is required"}), 400

    logger.info(f"Re-index request: {repo_path}")

    # For now, re-index performs a full re-index
    # TODO: Implement true incremental update with mtime tracking
    start_time = time.time()

    try:
        stats = flow.index_repository(repo_path, force=True)
        duration = time.time() - start_time

        logger.info(f"Re-indexing complete: {stats['files_indexed']} files in {duration:.1f}s")

        return jsonify({
            "success": True,
            "files_updated": stats['files_indexed'],
            "chunks_created": stats['chunks_created'],
            "duration_seconds": round(duration, 2)
        })

    except Exception as e:
        logger.error(f"Re-indexing failed: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/stats', methods=['GET'])
def stats():
    """Get indexing statistics"""
    if not flow:
        return jsonify({"success": False, "error": "Service not initialized"}), 500

    try:
        stats_data = flow.get_index_stats()
        return jsonify({"success": True, **stats_data})

    except Exception as e:
        logger.error(f"Get stats failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == '__main__':
    logger.info(f"Starting CocoIndex service on {config.FLASK_HOST}:{config.FLASK_PORT}")
    app.run(
        host=config.FLASK_HOST,
        port=config.FLASK_PORT,
        debug=config.DEBUG
    )
