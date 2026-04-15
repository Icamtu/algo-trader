FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash codeuser

# Create workspace directory if it doesn't exist
RUN mkdir -p /workspace
WORKDIR /workspace

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install ttyd for web terminal access (ARM64)
RUN curl -L https://github.com/tsl0922/ttyd/releases/download/1.7.3/ttyd.aarch64 -o /usr/local/bin/ttyd \
    && chmod +x /usr/local/bin/ttyd

# Set permissions
RUN chown -R codeuser:codeuser /workspace

# Add entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Switch to non-root user
USER codeuser

# Expose port (if applicable)
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["claude"]
