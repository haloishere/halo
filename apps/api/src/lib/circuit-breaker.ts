export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open — request rejected') {
    super(message)
    this.name = 'CircuitOpenError'
  }
}

type CircuitState = 'closed' | 'open' | 'half_open'

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold?: number
  /** Milliseconds to wait before transitioning from open → half_open */
  resetTimeoutMs?: number
  /** Injectable clock for deterministic testing */
  now?: () => number
}

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private lastFailureTime = 0
  private readonly failureThreshold: number
  private readonly resetTimeoutMs: number
  private readonly now: () => number

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000
    this.now = options.now ?? Date.now
  }

  getState(): CircuitState {
    return this.state
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half_open'
      } else {
        throw new CircuitOpenError()
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    this.state = 'closed'
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = this.now()

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open'
    }
  }

  recordSuccess(): void {
    this.onSuccess()
  }

  recordFailure(): void {
    this.onFailure()
  }

  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.lastFailureTime = 0
  }
}
