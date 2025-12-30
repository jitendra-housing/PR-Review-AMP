# Branch Sync Check Skill

Checks if a PR's feature branch is up-to-date with the base branch and adds a comment if it's behind.

## When to Use

- During PR reviews
- Before merging a PR
- When checking PR health

## Workflow

### 1. Get PR Information

```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER --jq '{base_ref: .base.ref, head_ref: .head.ref, base_sha: .base.sha, head_sha: .head.sha}'
```

### 2. Check if Feature Branch is Behind Base

In the repository directory:

```bash
# Fetch latest
git fetch origin

# Check how many commits behind the feature branch is
git rev-list --count pr-XXXX..origin/BASE_REF
```

If the count is > 0, the feature branch is behind the base branch.

### 3. Get the Commit Count Details

```bash
# Commits behind
BEHIND=$(git rev-list --count pr-XXXX..origin/BASE_REF)

# Commits ahead (changes in the PR)
AHEAD=$(git rev-list --count origin/BASE_REF..pr-XXXX)

echo "Behind: $BEHIND, Ahead: $AHEAD"
```

### 4. Add Comment if Behind

If `BEHIND > 0`, post a comment to the PR:

```bash
gh pr comment PR_NUMBER --repo OWNER/REPO --body "⚠️ **Branch Sync Notice**

This branch is **$BEHIND commit(s) behind** the base branch (\`BASE_REF\`).

Please sync your branch to ensure:
- No merge conflicts
- Latest changes from base are included
- CI/tests run against current codebase

**To sync:**
\`\`\`bash
git checkout HEAD_REF
git fetch origin
git merge origin/BASE_REF
# Or use rebase: git rebase origin/BASE_REF
git push
\`\`\`"
```

### 5. Include in Review Summary

When providing the review, mention the sync status:

```markdown
## Branch Status

🔴 **Out of sync**: This branch is X commits behind staging
```

Or:

```markdown
## Branch Status

✅ **Up to date**: This branch is synced with staging
```

## Example Usage

```bash
# In the PR review workflow
cd .temp/housing-app

# Fetch latest
git fetch origin

# Check sync status
BEHIND=$(git rev-list --count pr-18709..origin/staging)

if [ "$BEHIND" -gt 0 ]; then
  echo "⚠️ Branch is $BEHIND commits behind staging"
  # Post comment
  gh pr comment 18709 --repo elarahq/housing-app --body "..."
else
  echo "✅ Branch is up to date with staging"
fi
```

## Integration with PR Review Skill

This check should be added to the PR review workflow right after fetching the PR and before reviewing files:

1. Parse PR URL
2. Fetch PR data
3. **Check branch sync status** ← Add this step
4. Get list of changed files
5. Review files
6. Generate review output
7. Post review

## Output Format

Include sync status in the review header:

```markdown
# 🔍 PR Review: [PR Title]

**Repository**: `owner/repo`  
**PR**: [#123](https://github.com/owner/repo/pull/123)  
**Branch**: `feature-branch` → `base-branch`  
**Branch Status**: ⚠️ 15 commits behind base | ✅ Up to date  
**Files Changed**: X files
```

## Best Practices

- Always check sync status before reviewing
- If branch is significantly behind (>10 commits), recommend syncing before detailed review
- Don't block review on sync status, but make it visible
- Check for both merge conflicts and commit distance
