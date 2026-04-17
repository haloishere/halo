#!/usr/bin/env bash
# Block git branch deletion commands unless user explicitly requested it.
# Reads JSON from stdin (PreToolUse Bash payload).
# Fails open on infrastructure errors (missing jq, malformed JSON).

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)

if echo "$CMD" | grep -qE 'git\s+branch\s+-[dD]|git\s+push\s+\S+\s+--delete'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Branch deletion blocked — user must explicitly request deletion."
    }
  }'
  exit 0
fi
