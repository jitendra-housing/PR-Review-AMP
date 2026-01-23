"""
Smart code chunking logic with tree-sitter and fallback strategies
"""
import os
from typing import List, Dict, Any


def get_language_from_extension(filename: str) -> str:
    """Map file extension to language identifier"""
    ext = os.path.splitext(filename)[1].lower()
    lang_map = {
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.py': 'python',
        '.java': 'java',
        '.kt': 'kotlin',
        '.swift': 'swift',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.php': 'php',
        '.c': 'c',
        '.cpp': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.cs': 'csharp',
        '.scala': 'scala',
        '.clj': 'clojure'
    }
    return lang_map.get(ext, 'unknown')


def chunk_code(
    file_path: str,
    content: str,
    max_chunk_size: int = 500,
    chunk_overlap: int = 100
) -> List[Dict[str, Any]]:
    """
    Chunk code intelligently based on file size and structure

    Strategy:
    - Small files (<= max_chunk_size lines): whole file
    - Large files: sliding window chunks with overlap

    Future enhancement: Add tree-sitter for function-level parsing

    Args:
        file_path: Path to the file
        content: File content
        max_chunk_size: Maximum lines per chunk
        chunk_overlap: Overlap between chunks in lines

    Returns:
        List of chunk dictionaries with metadata
    """
    lines = content.split('\n')
    total_lines = len(lines)
    language = get_language_from_extension(file_path)

    chunks = []

    # Small file: return as single chunk
    if total_lines <= max_chunk_size:
        chunks.append({
            'file_path': file_path,
            'chunk_text': content,
            'chunk_type': 'whole_file',
            'start_line': 1,
            'end_line': total_lines,
            'language': language,
            'metadata': {
                'total_lines': total_lines,
                'is_truncated': False
            }
        })
        return chunks

    # Large file: sliding window with overlap
    chunk_num = 0
    start_line = 0

    while start_line < total_lines:
        end_line = min(start_line + max_chunk_size, total_lines)
        chunk_lines = lines[start_line:end_line]
        chunk_text = '\n'.join(chunk_lines)

        chunks.append({
            'file_path': file_path,
            'chunk_text': chunk_text,
            'chunk_type': f'chunk_{chunk_num}',
            'start_line': start_line + 1,  # 1-indexed for display
            'end_line': end_line,
            'language': language,
            'metadata': {
                'total_lines': total_lines,
                'chunk_number': chunk_num,
                'total_chunks': -1,  # Will be filled after
                'is_truncated': end_line < total_lines
            }
        })

        chunk_num += 1

        # Move start position with overlap
        # On last chunk, break to avoid empty trailing chunk
        if end_line >= total_lines:
            break
        start_line = end_line - chunk_overlap

    # Fill in total_chunks metadata
    for chunk in chunks:
        chunk['metadata']['total_chunks'] = len(chunks)

    return chunks


def try_tree_sitter_parse(file_path: str, content: str, language: str) -> List[Dict[str, Any]]:
    """
    Attempt to parse code with tree-sitter for function-level extraction

    This is a placeholder for future enhancement.
    Tree-sitter parsing would extract:
    - Function definitions
    - Class definitions
    - Method signatures
    - Docstrings

    For now, returns None to fall back to sliding window
    """
    # TODO: Implement tree-sitter parsing
    # try:
    #     from tree_sitter import Language, Parser
    #     # Parse and extract functions/classes
    #     return extracted_functions
    # except Exception:
    #     return None
    return None


def smart_chunk(
    file_path: str,
    content: str,
    max_chunk_size: int = 500,
    chunk_overlap: int = 100,
    use_tree_sitter: bool = False
) -> List[Dict[str, Any]]:
    """
    Smart chunking with tree-sitter fallback

    Args:
        file_path: Path to file
        content: File content
        max_chunk_size: Max lines per chunk
        chunk_overlap: Overlap lines
        use_tree_sitter: Try tree-sitter first

    Returns:
        List of chunks
    """
    language = get_language_from_extension(file_path)

    # Try tree-sitter if enabled
    if use_tree_sitter:
        tree_chunks = try_tree_sitter_parse(file_path, content, language)
        if tree_chunks:
            return tree_chunks

    # Fallback to sliding window
    return chunk_code(file_path, content, max_chunk_size, chunk_overlap)
