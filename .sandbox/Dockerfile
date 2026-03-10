FROM node:20-slim

# Install system dependencies (single layer, minimal packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
      git bash curl ca-certificates procps \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code \
    && npm cache clean --force

# Prepare directories for node user (UID 1000, already exists in node image)
RUN mkdir -p /home/node/.claude /workspace \
    && chown -R node:node /home/node/.claude /workspace

# Copy entrypoint and fix Windows line endings
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/bin/bash"]
