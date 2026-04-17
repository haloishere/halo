import { describe, it, expect } from 'vitest'
import { CircuitBreaker, CircuitOpenError } from '../circuit-breaker.js'

describe('CircuitBreaker', () => {
  it('starts in closed state', () => {
    const cb = new CircuitBreaker()
    expect(cb.getState()).toBe('closed')
  })

  it('stays closed on successful calls', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 })

    await cb.execute(() => Promise.resolve('ok'))
    await cb.execute(() => Promise.resolve('ok'))

    expect(cb.getState()).toBe('closed')
  })

  it('opens after reaching failure threshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 })

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail')
    }

    expect(cb.getState()).toBe('open')
  })

  it('rejects immediately when open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 })

    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail')
    expect(cb.getState()).toBe('open')

    await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toThrow(CircuitOpenError)
  })

  it('transitions to half_open after reset timeout', async () => {
    let time = 1000
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 5000,
      now: () => time,
    })

    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail')
    expect(cb.getState()).toBe('open')

    // Advance time past the reset timeout
    time = 7000

    // Next call should transition to half_open and attempt the call
    const result = await cb.execute(() => Promise.resolve('recovered'))
    expect(result).toBe('recovered')
    expect(cb.getState()).toBe('closed')
  })

  it('returns to open if half_open probe fails', async () => {
    let time = 1000
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 5000,
      now: () => time,
    })

    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow()
    expect(cb.getState()).toBe('open')

    time = 7000

    await expect(cb.execute(() => Promise.reject(new Error('still failing')))).rejects.toThrow(
      'still failing',
    )
    expect(cb.getState()).toBe('open')
  })

  it('resets failure count on success', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 })

    // 2 failures
    await expect(cb.execute(() => Promise.reject(new Error('f')))).rejects.toThrow()
    await expect(cb.execute(() => Promise.reject(new Error('f')))).rejects.toThrow()
    expect(cb.getState()).toBe('closed')

    // 1 success resets count
    await cb.execute(() => Promise.resolve('ok'))

    // 2 more failures should not trigger opening (count was reset)
    await expect(cb.execute(() => Promise.reject(new Error('f')))).rejects.toThrow()
    await expect(cb.execute(() => Promise.reject(new Error('f')))).rejects.toThrow()
    expect(cb.getState()).toBe('closed')
  })

  it('reset() clears all state', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 })

    await expect(cb.execute(() => Promise.reject(new Error('f')))).rejects.toThrow()
    expect(cb.getState()).toBe('open')

    cb.reset()
    expect(cb.getState()).toBe('closed')

    const result = await cb.execute(() => Promise.resolve('works'))
    expect(result).toBe('works')
  })

  it('does not open circuit before threshold is reached', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 5 })

    for (let i = 0; i < 4; i++) {
      await expect(cb.execute(() => Promise.reject(new Error('f')))).rejects.toThrow()
    }

    expect(cb.getState()).toBe('closed')
  })

  it('CircuitOpenError has correct name', () => {
    const error = new CircuitOpenError()
    expect(error.name).toBe('CircuitOpenError')
    expect(error.message).toBe('Circuit breaker is open — request rejected')
  })

  it('still rejects when open and timeout not elapsed', async () => {
    let time = 1000
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 30_000,
      now: () => time,
    })

    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow()
    expect(cb.getState()).toBe('open')

    // Only advance 10 seconds (< 30s timeout)
    time = 11_000

    await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toThrow(CircuitOpenError)
    expect(cb.getState()).toBe('open')
  })

  it('recordFailure opens circuit after threshold', () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 })

    cb.recordFailure()
    expect(cb.getState()).toBe('closed')

    cb.recordFailure()
    expect(cb.getState()).toBe('open')
  })

  it('recordSuccess resets failure count', () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 })

    cb.recordFailure()
    cb.recordSuccess()
    expect(cb.getState()).toBe('closed')

    // One more failure should not open (count was reset)
    cb.recordFailure()
    expect(cb.getState()).toBe('closed')
  })
})
