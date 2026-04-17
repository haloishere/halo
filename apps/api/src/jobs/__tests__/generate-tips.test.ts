/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We'll import the function under test after mocks are set up
const { generateDailyTips, TIPS_PROMPT } = await import('../generate-tips.js')

function makeMockAiClient() {
  return {
    generateContent: vi.fn(),
    generateContentStream: vi.fn(),
    countTokens: vi.fn(),
  }
}

function makeMockDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  }
}

function makeMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as any
}

function buildValidTips(count: number) {
  const categories = [
    'Self Care',
    'Communication',
    'Daily Care',
    'Safety',
    'Emotional',
    'Behavioral',
  ]
  return Array.from({ length: count }, (_, i) => ({
    tip: `Tip number ${i + 1} for caregivers.`,
    category: categories[i % categories.length],
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateDailyTips', () => {
  it('generates tips via Gemini and inserts into DB', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    const tips = buildValidTips(50)
    mockAiClient.generateContent.mockResolvedValue(JSON.stringify(tips))

    // Mock: no existing tips for today
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    // Mock: insert succeeds (with onConflictDoNothing)
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    })

    // Mock: delete for cleanup
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await generateDailyTips(mockDb as any, mockAiClient, logger)

    expect(mockAiClient.generateContent).toHaveBeenCalledTimes(1)
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify values were called with an array of 50 tips
    const insertChain = mockDb.insert.mock.results[0]?.value
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          tip: expect.any(String),
          category: expect.any(String),
          tipDate: expect.any(String),
        }),
      ]),
    )
  })

  it('validates each tip with dailyTipSchema — rejects invalid tips', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    const tipsWithInvalid = [
      { tip: 'Valid tip for caregivers.', category: 'Self Care' },
      { tip: '', category: 'Safety' }, // invalid: empty tip
      { tip: 'Another valid tip.', category: 'Communication' },
      { tip: 'Good tip.', category: 'InvalidCategory' }, // invalid category
      { category: 'Safety' }, // missing tip field
    ]

    mockAiClient.generateContent.mockResolvedValue(JSON.stringify(tipsWithInvalid))

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    })

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await generateDailyTips(mockDb as any, mockAiClient, logger)

    // Only 2 valid tips should be inserted (first and third)
    const insertChain = mockDb.insert.mock.results[0]?.value
    const insertedValues = insertChain.values.mock.calls[0][0]
    expect(insertedValues).toHaveLength(2)

    // Logger should warn about rejected tips
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ rejectedCount: 3 }),
      expect.stringContaining('rejected'),
    )
  })

  it("skips generation if today's tips already exist (idempotent)", async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    // Mock: tips already exist for today
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'existing-tip' }]),
      }),
    })

    // Cleanup mock (still runs even if skipped)
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await generateDailyTips(mockDb as any, mockAiClient, logger)

    // Should NOT call AI or insert
    expect(mockAiClient.generateContent).not.toHaveBeenCalled()
    expect(mockDb.insert).not.toHaveBeenCalled()

    // Should log that tips already exist
    expect(logger.info).toHaveBeenCalledWith(expect.any(String))
  })

  it('cleans up tips older than 7 days', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    const tips = buildValidTips(50)
    mockAiClient.generateContent.mockResolvedValue(JSON.stringify(tips))

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    })

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await generateDailyTips(mockDb as any, mockAiClient, logger)

    // Delete should have been called for cleanup
    expect(mockDb.delete).toHaveBeenCalled()
  })

  it('throws when Gemini fails completely', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    mockAiClient.generateContent.mockRejectedValue(new Error('Vertex AI unavailable'))

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await expect(generateDailyTips(mockDb as any, mockAiClient, logger)).rejects.toThrow(
      'Vertex AI unavailable',
    )
  })

  it('throws when DB insert fails', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    const tips = buildValidTips(50)
    mockAiClient.generateContent.mockResolvedValue(JSON.stringify(tips))

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockRejectedValue(new Error('DB insert failed')),
      }),
    })

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await expect(generateDailyTips(mockDb as any, mockAiClient, logger)).rejects.toThrow(
      'DB insert failed',
    )
  })

  it('prompt includes medical advice safety guardrails', () => {
    expect(TIPS_PROMPT).toContain('Do NOT recommend specific medications, dosages, or treatments')
    expect(TIPS_PROMPT).toContain('Do NOT provide medical diagnoses or clinical advice')
  })

  it('handles Gemini returning fewer than 50 valid tips (partial success)', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    // Only 3 valid tips returned
    const tips = buildValidTips(3)
    mockAiClient.generateContent.mockResolvedValue(JSON.stringify(tips))

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    })

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    // Should NOT throw — partial success is acceptable
    await generateDailyTips(mockDb as any, mockAiClient, logger)

    // Should insert the 3 valid tips
    const insertChain = mockDb.insert.mock.results[0]?.value
    const insertedValues = insertChain.values.mock.calls[0][0]
    expect(insertedValues).toHaveLength(3)
  })

  it('throws when Gemini returns zero valid tips', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    // All invalid
    const tips = [{ tip: '', category: '' }, { category: 'Safety' }]
    mockAiClient.generateContent.mockResolvedValue(JSON.stringify(tips))

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await expect(generateDailyTips(mockDb as any, mockAiClient, logger)).rejects.toThrow(
      'No valid tips',
    )
  })

  it('handles Gemini returning non-JSON response', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    mockAiClient.generateContent.mockResolvedValue('This is not JSON at all')

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await expect(generateDailyTips(mockDb as any, mockAiClient, logger)).rejects.toThrow(
      'Gemini response is not valid JSON',
    )
  })

  it('throws descriptive error when Gemini returns empty response', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    mockAiClient.generateContent.mockResolvedValue('')

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await expect(generateDailyTips(mockDb as any, mockAiClient, logger)).rejects.toThrow(
      'Gemini returned an empty response',
    )
  })

  it('strips HTML tags from tip text before validation', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    const tipsWithHtml = [
      { tip: '<b>Take a walk</b> today for <i>self care</i>.', category: 'Self Care' },
      { tip: '<script>alert("xss")</script>Stay hydrated.', category: 'Daily Care' },
      { tip: 'Tip with <a href="http://evil.com">link</a> removed.', category: 'Safety' },
    ]
    mockAiClient.generateContent.mockResolvedValue(JSON.stringify(tipsWithHtml))

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    })
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await generateDailyTips(mockDb as any, mockAiClient, logger)

    const insertChain = mockDb.insert.mock.results[0]?.value
    const insertedValues = insertChain.values.mock.calls[0][0]

    // HTML tags should be stripped
    expect(insertedValues[0].tip).toBe('Take a walk today for self care.')
    expect(insertedValues[1].tip).toBe('alert("xss")Stay hydrated.')
    expect(insertedValues[2].tip).toBe('Tip with link removed.')
  })

  it('strips control characters from tip text', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    const tipsWithControlChars = [
      { tip: 'Tip with\x00null\x01and\x7Fcontrol chars.', category: 'Self Care' },
    ]
    mockAiClient.generateContent.mockResolvedValue(JSON.stringify(tipsWithControlChars))

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    })
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await generateDailyTips(mockDb as any, mockAiClient, logger)

    const insertChain = mockDb.insert.mock.results[0]?.value
    const insertedValues = insertChain.values.mock.calls[0][0]
    expect(insertedValues[0].tip).toBe('Tip withnullandcontrol chars.')
  })

  it('throws when Gemini response exceeds 512KB', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    // Generate a response larger than 512KB
    const hugeResponse = 'x'.repeat(512 * 1024 + 1)
    mockAiClient.generateContent.mockResolvedValue(hugeResponse)

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await expect(generateDailyTips(mockDb as any, mockAiClient, logger)).rejects.toThrow(
      'Gemini response too large',
    )
  })

  it('caps insertion at MAX_TIPS_PER_DAY (100)', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    // Generate 150 valid tips — only 100 should be inserted
    const tips = buildValidTips(150)
    mockAiClient.generateContent.mockResolvedValue(JSON.stringify(tips))

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    })
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await generateDailyTips(mockDb as any, mockAiClient, logger)

    const insertChain = mockDb.insert.mock.results[0]?.value
    const insertedValues = insertChain.values.mock.calls[0][0]
    expect(insertedValues).toHaveLength(100)
  })

  it('parses JSON wrapped in markdown code fences', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    const tips = buildValidTips(3)
    // Wrap in ```json ... ``` like Gemini often does
    const fencedResponse = '```json\n' + JSON.stringify(tips) + '\n```'
    mockAiClient.generateContent.mockResolvedValue(fencedResponse)

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    })
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await generateDailyTips(mockDb as any, mockAiClient, logger)

    const insertChain = mockDb.insert.mock.results[0]?.value
    const insertedValues = insertChain.values.mock.calls[0][0]
    expect(insertedValues).toHaveLength(3)
  })

  it('parses JSON wrapped in plain code fences (no language tag)', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    const tips = buildValidTips(2)
    const fencedResponse = '```\n' + JSON.stringify(tips) + '\n```'
    mockAiClient.generateContent.mockResolvedValue(fencedResponse)

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    })
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await generateDailyTips(mockDb as any, mockAiClient, logger)

    const insertChain = mockDb.insert.mock.results[0]?.value
    const insertedValues = insertChain.values.mock.calls[0][0]
    expect(insertedValues).toHaveLength(2)
  })

  it('cleanup failure does not prevent successful generation', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    const tips = buildValidTips(5)
    mockAiClient.generateContent.mockResolvedValue(JSON.stringify(tips))

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    })
    // Cleanup throws
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockRejectedValue(new Error('DB delete failed')),
    })

    // Should NOT throw — cleanup failure is non-fatal
    await generateDailyTips(mockDb as any, mockAiClient, logger)

    // Insert should have succeeded
    expect(mockDb.insert).toHaveBeenCalled()
    // Error should be logged
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      expect.stringContaining('Failed to clean up old tips'),
    )
  })

  it('handles Gemini returning non-array JSON', async () => {
    const mockDb = makeMockDb()
    const mockAiClient = makeMockAiClient()
    const logger = makeMockLogger()

    mockAiClient.generateContent.mockResolvedValue(
      JSON.stringify({ tip: 'single tip', category: 'Safety' }),
    )

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })

    await expect(generateDailyTips(mockDb as any, mockAiClient, logger)).rejects.toThrow(
      'not an array',
    )
  })
})
