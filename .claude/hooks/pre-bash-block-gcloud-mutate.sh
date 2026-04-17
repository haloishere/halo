#!/bin/bash
# PreToolUse hook: Block gcloud commands that create, update, or delete GCP resources.
# Read-only commands (describe, list, get, logs, info) are allowed.
# All infrastructure changes must go through Terraform.
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Strip heredoc content so only the actual command is matched. Takes the first line only.
FIRST_CMD=$(echo "$CMD" | sed "s/<<['\"]\\{0,1\\}EOF.*//g" | head -1)

# Only check commands where gcloud is actually invoked (not just mentioned in strings)
if ! echo "$FIRST_CMD" | grep -qE '(^|\||&&|;)\s*gcloud\b'; then
  exit 0
fi

# Allow read-only subcommands FIRST — these are safe regardless of what's in the arguments.
# Check that a read-only verb appears as an actual gcloud subcommand (after gcloud + service path).
if echo "$FIRST_CMD" | grep -qE '\bgcloud\b.*\b(describe|list|get|logs|info|print-access-token|auth|config|version|help)\b'; then
  exit 0
fi

# Block known mutating gcloud actions.
# Match the verb as a gcloud subcommand, not in argument values (e.g., SA names like "halo-deploy-staging").
# Extract the gcloud subcommand chain (words between gcloud and the first flag/argument).
GCLOUD_SUBCMD=$(echo "$FIRST_CMD" | grep -oP '(?<=gcloud\s)[\w\s-]+' | head -1)
if echo "$GCLOUD_SUBCMD" | grep -qE '\b(create|delete|update|deploy|add-iam-policy-binding|remove-iam-policy-binding|set-iam-policy|submit)\b'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "gcloud mutating command blocked — all GCP infrastructure changes must go through Terraform. Use `terraform plan` and `terraform apply` instead."
    }
  }'
  exit 0
fi

# Fallback: allow unrecognized subcommands (may include unlisted mutating commands —
# expand blocklist above as needed).
exit 0
