#!/bin/bash
# PreToolUse hook: Block edits to .env files (except .env.example)
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
BASENAME=$(basename "$FILE")

# Match .env or .env.* files
if echo "$BASENAME" | grep -qE '^\.env($|\.)'; then
  # Allow .env.example
  if echo "$BASENAME" | grep -qE '\.example$'; then
    exit 0
  fi
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Cannot edit .env files — manage secrets manually. Only .env.example is allowed."
    }
  }'
  exit 0
fi
exit 0
