export type CrisisResult = { detected: false } | { detected: true; resources: string }

// Keywords/phrases that suggest crisis situations
const CRISIS_KEYWORDS = [
  /\b(kill|end)\s+(my\s*self|myself|my\s+life)\b/i,
  /\bsuicid(e|al)\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|exist)\b/i,
  /\bhurt(ing)?\s+(my\s*self|myself)\b/i,
  /\bself[- ]?harm\b/i,
  /\bend\s+it\s+all\b/i,
  /\bno\s+(point|reason)\s+(in\s+)?(living|going\s+on)\b/i,
  /\b(abuse|abusing|neglect(ing)?)\s+(my\s+|the\s+|their\s+|an?\s+)?(elderly?\s+)?(parent|mother|father|patient|loved\s+one)\b/i,
  /\bhitting\s+(my\s+|the\s+)(elderly?\s+)?(parent|mother|father|loved\s+one)\b/i,
]

const CRISIS_RESOURCES = `If you or someone you know is in crisis:
- 988 Suicide & Crisis Lifeline: Call or text 988
- Crisis Text Line: Text HOME to 741741
- Adult Protective Services (elder abuse): 1-800-677-1116 (Eldercare Locator)
- Emergency: Call 911`

/**
 * Layer 2: Crisis keyword detection.
 * Non-blocking — does not prevent AI response, but surfaces crisis resources.
 */
export function detectCrisis(text: string): CrisisResult {
  for (const pattern of CRISIS_KEYWORDS) {
    if (pattern.test(text)) {
      return { detected: true, resources: CRISIS_RESOURCES }
    }
  }
  return { detected: false }
}
