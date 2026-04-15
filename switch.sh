#!/bin/bash
# Usage: ./switch.sh ollama | openrouter | status

ENV="$HOME/trading-workspace/.env"
CLAUDE_DIR="$HOME/trading-workspace/.claude"
mkdir -p $CLAUDE_DIR

# Safe key read — no escape codes
get_key() {
  grep "^${1}=" "$ENV" | cut -d= -f2- | tr -d '[:space:]' | sed 's/\x1b\[[0-9;]*m//g'
}

case $1 in
  ollama)
    cat > $CLAUDE_DIR/settings.local.json << 'JSON'
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://ollama_engine:11434",
    "ANTHROPIC_AUTH_TOKEN": "ollama",
    "ANTHROPIC_API_KEY": "ollama",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "gemma4:31b-cloud",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5.1:cloud",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-5.1:cloud",
    "CLAUDE_CODE_SUBAGENT_MODEL": "glm-5.1:cloud"
  }
}
JSON
    echo "✅ Switched to Ollama"
    ;;

  openrouter)
    OR_KEY=$(get_key "OPENROUTER_API_KEY")
    if [ -z "$OR_KEY" ]; then
      echo "❌ OPENROUTER_API_KEY not found in $ENV"
      exit 1
    fi
    cat > $CLAUDE_DIR/settings.local.json << JSON
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://openrouter.ai/api/v1",
    "ANTHROPIC_AUTH_TOKEN": "${OR_KEY}",
    "ANTHROPIC_API_KEY": "${OR_KEY}",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "z-ai/glm-5.1",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "z-ai/glm-5.1",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "google/gemma-4-31b-it:free",
    "CLAUDE_CODE_SUBAGENT_MODEL": "google/gemma-4-26b-a4b-it:free"
  }
}
JSON
    echo "✅ Switched to OpenRouter"
    ;;

  status)
    echo "=== Active Provider ==="
    grep -E "BASE_URL|SONNET" $CLAUDE_DIR/settings.local.json
    ;;

  *)
    echo "Usage: $0 ollama | openrouter | status"
    ;;
esac

# Restart claude-code to pick up new settings
docker compose -f $HOME/trading-workspace/docker-compose.yml up -d claude-code
echo "🔄 claude-code restarted"
