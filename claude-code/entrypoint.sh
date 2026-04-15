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
    
    # --- Official Ollama Integration Pattern ---
    export ANTHROPIC_AUTH_TOKEN="ollama"
    export ANTHROPIC_API_KEY=""
    export ANTHROPIC_BASE_URL="$OLLAMA_BASE_URL"
    export CLAUDE_MODEL="${OLLAMA_MODEL:-glm-5:cloud}"
    export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"
    
    # Persist environment for 'docker compose exec' sessions
    echo "export ANTHROPIC_AUTH_TOKEN=\"$ANTHROPIC_AUTH_TOKEN\"" >> /home/codeuser/.bashrc
    echo "export ANTHROPIC_BASE_URL=\"$ANTHROPIC_BASE_URL\"" >> /home/codeuser/.bashrc
    echo "export ANTHROPIC_API_KEY=\"\"" >> /home/codeuser/.bashrc
    echo "export CLAUDE_MODEL=\"$CLAUDE_MODEL\"" >> /home/codeuser/.bashrc
    echo "export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=\"1\"" >> /home/codeuser/.bashrc

    # Bypass onboarding for a seamless container experience
    echo '{"hasCompletedOnboarding": true}' > /home/codeuser/.claude.json
    rm -rf /home/codeuser/.claude/settings.json # Clean up old manual overrides
    
    # Ensure proper ownership
    chown codeuser:codeuser /home/codeuser/.claude.json
    chown codeuser:codeuser /home/codeuser/.bashrc

    echo "Status: Official Ollama Integration Active"
    echo "Ollama Endpoint: $ANTHROPIC_BASE_URL"
    echo "Primary Model: $CLAUDE_MODEL"
else
    echo "Using Cloud LLM (OpenRouter)"
    export ANTHROPIC_BASE_URL="$OPENROUTER_BASE_URL"
    export ANTHROPIC_API_KEY="$OPENROUTER_API_KEY"
    export CLAUDE_MODEL="${OPENROUTER_MODEL:-mistralai/mistral-7b-instruct}"
    echo "Model: $CLAUDE_MODEL"
fi

echo "--- Configuration Complete ---"
echo "Starting Claude Code Web Terminal on Port 8080..."

# Execute the command through ttyd
# -p 8080: Listen on port 8080
# -W: Allow write (interactive)
# -t fontSize=14: Aesthetic terminal sizing
# bash: Provide a shell so we can run Claude and other tools
exec ttyd -p 8080 -W -t fontSize=14 node /usr/local/bin/claude --model "$CLAUDE_MODEL" "$@"
