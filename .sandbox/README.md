# Docker Sandbox for Claude Code Headless Loops

Isolates Ralph loop scripts in a Docker container. The container boundary prevents the agent from touching host files outside the mounted repo. Network access is unrestricted so Claude can use WebFetch, npm, GitHub, etc.

## Prerequisites

- **Docker Desktop** with WSL2 backend (Windows 11)
- **Claude Code CLI** installed on the host (`npm install -g @anthropic-ai/claude-code`)
- **Git** configured on the host (`user.name` and `user.email` set)

## One-Time Setup

Authenticate Claude Code on the host (the container reuses this session):

```bash
claude /login
```

This creates `~/.claude/.credentials.json`, which the container mounts read-only and copies internally.

## Quick Start

```bash
# Build the sandbox image
docker compose -f .sandbox/docker-compose.sandbox.yml build

# Run a Ralph loop with dangerous permissions (10 iterations)
docker compose -f .sandbox/docker-compose.sandbox.yml run --rm \
  -e DANGEROUSLY_SKIP_PERMISSIONS=true \
  sandbox ./ralph/ralph-jeopardy/loop.sh 10

# Drop into an interactive shell
docker compose -f .sandbox/docker-compose.sandbox.yml run --rm sandbox
```

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `DANGEROUSLY_SKIP_PERMISSIONS` | `false` | Pass `--dangerously-skip-permissions` to Claude |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | `64000` | Max output tokens per Claude invocation |
| `ANTHROPIC_API_KEY` | _(empty)_ | API key auth (alternative to OAuth login) |
| `CLAUDE_MODEL` | _(empty)_ | Override the Claude model |

### Using an API Key Instead of OAuth

If you have an API key, skip `claude /login` and pass it directly:

```bash
ANTHROPIC_API_KEY=sk-ant-... \
  docker compose -f .sandbox/docker-compose.sandbox.yml run --rm sandbox \
  ./ralph/ralph-jeopardy/loop.sh 10
```

## What the Sandbox Protects

- **Filesystem isolation** -- Claude cannot access host files outside the mounted repo
- **Disposable environment** -- `--rm` destroys the container after each run
- **Git safety net** -- all repo changes are visible via `git diff` and revertible

## Debugging

```bash
# Shell into the container
docker compose -f .sandbox/docker-compose.sandbox.yml run --rm sandbox

# Verify Claude CLI works
claude -p "say hello"

# Check git identity
git config user.name && git config user.email
```

## Volumes

| Host Path | Container Path | Mode | Purpose |
|---|---|---|---|
| `.` (repo root) | `/workspace` | read-write | Project files |
| `~/.claude/.credentials.json` | `/tmp/host-credentials` | read-only | OAuth credentials (copied at start) |
| `~/.gitconfig` | `/home/node/.gitconfig` | read-only | Git identity |

## Limitations

- **No MCP tools**: The container has no Chrome or MCP servers. Only headless `claude -p` mode is supported.
- **OAuth token expiry**: If the OAuth token expires during a long loop, the CLI cannot refresh it (credentials are copied, not bind-mounted writable). Use `ANTHROPIC_API_KEY` for loops expected to run many hours.
