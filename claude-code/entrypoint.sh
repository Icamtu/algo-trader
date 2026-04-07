#!/bin/bash
set -e

# Load defaults if not set
: "${OPENROUTER_BASE_URL:=https://openrouter.ai/api/v1}"
: "${PREFER_LOCAL:=true}"
: "${LLM_PROVIDER:=auto}" # auto, ollama, openrouter

echo "--- Claude Code LLM Routing Initializing ---"

check_ollama() {
    echo "Checking Ollama connectivity at $OLLAMA_BASE_URL..."
    if curl -s --connect-timeout 2 "$OLLAMA_BASE_URL/api/tags" > /dev/null; then
        echo "Ollama is UP."
        return 0
    else
        echo "Ollama is DOWN or unreachable."
        return 1
    fi
}

check_openrouter() {
    echo "Checking OpenRouter connectivity..."
    if curl -s --connect-timeout 5 "$OPENROUTER_BASE_URL/models" > /dev/null; then
        echo "OpenRouter is UP."
        return 0
    else
        echo "OpenRouter is DOWN or unreachable."
        return 1
    fi
}

# Determine Provider Logic
FINAL_PROVIDER=""

if [ "$LLM_PROVIDER" = "ollama" ]; then
    FINAL_PROVIDER="ollama"
elif [ "$LLM_PROVIDER" = "openrouter" ]; then
    FINAL_PROVIDER="openrouter"
else
    # Auto-routing / Preference logic
    if [ "$PREFER_LOCAL" = "true" ]; then
        if check_ollama; then
            FINAL_PROVIDER="ollama"
        else
            echo "Falling back to OpenRouter..."
            FINAL_PROVIDER="openrouter"
        fi
    else
        FINAL_PROVIDER="openrouter"
    fi
fi

# Configure Environment for Claude Code
if [ "$FINAL_PROVIDER" = "ollama" ]; then
    echo "Using Local LLM (Ollama)"
    export ANTHROPIC_BASE_URL="$OLLAMA_BASE_URL/v1" # Assuming Anthropic-compatible shim if needed
    export CLAUDE_MODEL="${OLLAMA_MODEL:-llama3.2}"
    echo "Model: $CLAUDE_MODEL"
else
    echo "Using Cloud LLM (OpenRouter)"
    export ANTHROPIC_BASE_URL="$OPENROUTER_BASE_URL"
    export ANTHROPIC_API_KEY="$OPENROUTER_API_KEY"
    export CLAUDE_MODEL="${OPENROUTER_MODEL:-mistralai/mistral-7b-instruct}"
    echo "Model: $CLAUDE_MODEL"
fi

echo "--- Configuration Complete ---"
echo "Starting Claude Code..."

# Execute the command passed to the container (default: claude)
exec "$@"
