export type InputClassification =
  | { safe: true }
  | { safe: false; reason: string; category: 'prompt_injection' | 'jailbreak' | 'harmful_request' }

// Patterns that indicate prompt injection or jailbreak attempts
type UnsafeClassification = Extract<InputClassification, { safe: false }>

const INJECTION_PATTERNS: Array<{
  pattern: RegExp
  category: UnsafeClassification['category']
  reason: string
}> = [
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules)/i,
    category: 'prompt_injection',
    reason: 'Attempt to override system instructions',
  },
  {
    pattern: /you\s+are\s+(now|no\s+longer)\s+(a|an|not)\s/i,
    category: 'jailbreak',
    reason: 'Attempt to redefine assistant identity',
  },
  {
    pattern:
      /pretend\s+(you\s+are|to\s+be|you're)\s+(a\s+)?(doctor|physician|nurse|psychiatrist|therapist)/i,
    category: 'jailbreak',
    reason: 'Attempt to impersonate medical professional',
  },
  {
    pattern: /disregard\s+(your|all|the)\s+(safety|guidelines|rules|boundaries|constraints)/i,
    category: 'prompt_injection',
    reason: 'Attempt to bypass safety guidelines',
  },
  {
    pattern: /\bDAN\b.*\bmode\b|\bDAN\b.*\bjailbreak\b/i,
    category: 'jailbreak',
    reason: 'Known jailbreak technique reference',
  },
  {
    pattern: /system\s*prompt|<<\s*SYS\s*>>|<\|im_start\|>/i,
    category: 'prompt_injection',
    reason: 'Attempt to access or manipulate system prompt',
  },
  {
    pattern: /\[INST\]|\[\/INST\]|<\|endoftext\|>/i,
    category: 'prompt_injection',
    reason: 'Prompt delimiter injection',
  },
]

/**
 * Layer 1: Fast regex-based input classification.
 * No API calls — runs in microseconds.
 */
export function classifyInput(text: string): InputClassification {
  for (const { pattern, category, reason } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, reason, category }
    }
  }
  return { safe: true }
}
