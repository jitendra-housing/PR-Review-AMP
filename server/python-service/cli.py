#!/usr/bin/env python3
"""
CLI tool for CocoIndex operations
"""
import click
import requests
import json
from typing import Optional

SERVICE_URL = 'http://localhost:5001'


def make_request(method: str, endpoint: str, data: Optional[dict] = None):
    """Make HTTP request to CocoIndex service"""
    url = f"{SERVICE_URL}{endpoint}"
    try:
        if method == 'GET':
            response = requests.get(url, timeout=300)
        elif method == 'POST':
            response = requests.post(url, json=data, timeout=300)
        else:
            raise ValueError(f"Unsupported method: {method}")

        response.raise_for_status()
        return response.json()

    except requests.exceptions.ConnectionError:
        click.echo("❌ Error: Cannot connect to CocoIndex service", err=True)
        click.echo("Make sure the service is running: python app.py", err=True)
        return None
    except requests.exceptions.Timeout:
        click.echo("❌ Error: Request timed out", err=True)
        return None
    except requests.exceptions.HTTPError as e:
        click.echo(f"❌ HTTP Error: {e}", err=True)
        try:
            error_data = e.response.json()
            click.echo(f"Details: {error_data.get('error', 'Unknown error')}", err=True)
        except:
            pass
        return None


@click.group()
def cli():
    """CocoIndex CLI tool for managing code search indexes"""
    pass


@cli.command()
def health():
    """Check service health"""
    click.echo("Checking CocoIndex service health...")
    result = make_request('GET', '/health')

    if result:
        status = result.get('status', 'unknown')
        emoji = "✅" if status == "ok" else "⚠️"
        click.echo(f"\n{emoji} Status: {status}")
        click.echo(f"Database: {result.get('database', 'unknown')}")
        click.echo(f"Flow: {result.get('flow', 'unknown')}")
        click.echo(f"Indexed repositories: {result.get('indexed_repos', 0)}")
        click.echo(f"Total chunks: {result.get('total_chunks', 0)}")


@cli.command()
@click.argument('repo_path')
@click.option('--force', is_flag=True, help='Force re-index even if already indexed')
def index(repo_path: str, force: bool):
    """Index a repository"""
    click.echo(f"Indexing repository: {repo_path}")
    if force:
        click.echo("(Force mode: will re-index all files)")

    result = make_request('POST', '/index', {
        'repo_path': repo_path,
        'force': force
    })

    if result and result.get('success'):
        click.echo(f"\n✅ Indexing complete!")
        click.echo(f"Files indexed: {result.get('files_indexed', 0)} / {result.get('files_found', 0)}")
        click.echo(f"Chunks created: {result.get('chunks_created', 0)}")
        click.echo(f"Duration: {result.get('duration_seconds', 0):.1f}s")
    elif result:
        click.echo(f"\n❌ Indexing failed: {result.get('error', 'Unknown error')}")


@cli.command()
@click.argument('repo_path')
def status(repo_path: str):
    """Check if a repository is indexed"""
    result = make_request('POST', '/check-indexed', {
        'repo_path': repo_path
    })

    if result and result.get('success'):
        indexed = result.get('indexed', False)
        if indexed:
            click.echo(f"✅ Repository is indexed: {repo_path}")
        else:
            click.echo(f"❌ Repository is NOT indexed: {repo_path}")
            click.echo(f"Run: ./cli.py index {repo_path}")


@cli.command()
@click.argument('query')
@click.argument('repo_path')
@click.option('--limit', default=5, help='Maximum results to return')
@click.option('--threshold', default=0.7, help='Minimum similarity score (0-1)')
def search(query: str, repo_path: str, limit: int, threshold: float):
    """Search for code"""
    click.echo(f"Searching for: '{query}'")
    click.echo(f"In repository: {repo_path}\n")

    result = make_request('POST', '/search', {
        'query': query,
        'repo_path': repo_path,
        'limit': limit,
        'threshold': threshold
    })

    if result and result.get('success'):
        results = result.get('results', [])
        duration = result.get('duration_ms', 0)

        if not results:
            click.echo("No results found.")
            return

        click.echo(f"Found {len(results)} results in {duration:.0f}ms:\n")

        for i, r in enumerate(results, 1):
            score = r['score']
            file_path = r['file_path']
            desc = r['description']

            # Color code by score
            if score >= 0.9:
                color = 'green'
            elif score >= 0.8:
                color = 'yellow'
            else:
                color = 'white'

            click.secho(f"{i}. [{score:.2f}] {file_path}", fg=color, bold=True)
            click.echo(f"   {desc}")

            # Show snippet preview (first 200 chars)
            snippet = r['chunk_text'][:200].replace('\n', ' ')
            if len(r['chunk_text']) > 200:
                snippet += '...'
            click.echo(f"   {snippet}\n")


@cli.command()
@click.argument('repo_path')
def reindex(repo_path: str):
    """Re-index a repository (incremental update)"""
    click.echo(f"Re-indexing repository: {repo_path}")

    result = make_request('POST', '/reindex', {
        'repo_path': repo_path
    })

    if result and result.get('success'):
        click.echo(f"\n✅ Re-indexing complete!")
        click.echo(f"Files updated: {result.get('files_updated', 0)}")
        click.echo(f"Duration: {result.get('duration_seconds', 0):.1f}s")


@cli.command()
def stats():
    """Show indexing statistics"""
    result = make_request('GET', '/stats')

    if result and result.get('success'):
        click.echo(f"Total repositories: {result.get('repo_count', 0)}")
        click.echo(f"Total chunks: {result.get('chunk_count', 0)}\n")

        repos = result.get('repositories', [])
        if repos:
            click.echo("Repositories:")
            for repo in repos:
                click.echo(f"\n  📁 {repo['repo_path']}")
                click.echo(f"     Files: {repo['files']}")
                click.echo(f"     Chunks: {repo['chunks']}")
                click.echo(f"     Last indexed: {repo['last_indexed']}")


if __name__ == '__main__':
    cli()
