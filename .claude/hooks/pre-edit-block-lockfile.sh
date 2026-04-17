#!/bin/bash
# PreToolUse hook: Block direct edits to pnpm-lock.yaml
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
BASENAME=$(basename "$FILE")

if [ "$BASENAME" = "pnpm-lock.yaml" ]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Do not edit pnpm-lock.yaml directly — use pnpm install to update dependencies."
    }
  }'
  exit 0
fi
exit 0
