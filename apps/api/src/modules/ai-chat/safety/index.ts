import { classifyInput } from './input-classifier.js'
import { detectCrisis } from './crisis-detector.js'
import type { InputClassification } from './input-classifier.js'
import type { CrisisResult } from './crisis-detector.js'

export { classifyOutput } from './output-classifier.js'
export { classifyInput } from './input-classifier.js'
export { detectCrisis } from './crisis-detector.js'

export type SafetyPipelineResult =
  | { allowed: true; inputClassification: InputClassification; crisisResult: CrisisResult }
  | {
      allowed: false
      inputClassification: Extract<InputClassification, { safe: false }>
      crisisResult: CrisisResult
      rejectionReason: string
    }

/**
 * Run the safety pipeline on user input BEFORE streaming.
 * Orchestrates input classification + crisis detection.
 * If blocked → the route handler returns 422 (no SSE).
 * Crisis detection does NOT block — it adds resources to the response context.
 */
export function runSafetyPipeline(input: string): SafetyPipelineResult {
  const inputClassification = classifyInput(input)
  const crisisResult = detectCrisis(input)

  if (!inputClassification.safe) {
    return {
      allowed: false,
      inputClassification,
      crisisResult,
      rejectionReason: inputClassification.reason,
    }
  }

  return {
    allowed: true,
    inputClassification,
    crisisResult,
  }
}
