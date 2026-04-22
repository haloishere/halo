import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestApp } from '../../../test/helpers.js'

const { mockVerifyIdToken, mockGetFollowups, mockSubmitAnswers, mockGetQuestionnaire } = vi.hoisted(
  () => ({
    mockVerifyIdToken: vi.fn(),
    mockGetFollowups: vi.fn(),
    mockSubmitAnswers: vi.fn(),
    mockGetQuestionnaire: vi.fn(),
  }),
)

vi.mock('../../../lib/firebase-admin.js', () => ({
  firebaseAuth: {
    verifyIdToken: mockVerifyIdToken,
    setCustomUserClaims: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
    deleteUser: vi.fn(),
    updateUser: vi.fn(),
  },
}))

vi.mock('../scenarios.service.js', () => ({
  generateFollowups: mockGetFollowups,
  generateProposals: mockSubmitAnswers,
  getQuestionnaire: mockGetQuestionnaire,
}))

const VALID_TOKEN_UID = 'scenarios-test-uid'
const DB_USER_ID = '11111111-1111-1111-1111-111111111111'

function makeMockDb() {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: DB_USER_ID, role: 'user', tier: 'free' }]),
        }),
      }),
    }),
  }
}

async function buildScenariosApp() {
  const app = await createTestApp()
  const scenariosRoutes = (await import('../scenarios.routes.js')).default
  app.decorate('db', makeMockDb() as never)
  await app.register(scenariosRoutes, { prefix: '/v1/scenarios' })
  return app
}

function authHeader() {
  return { authorization: 'Bearer valid-token' }
}

const VALID_ANSWERS = {
  food_diet: { chips: ['Vegetarian'], freeText: '' },
  food_cuisine: { chips: ['Japanese', 'Italian'] },
}

const FIVE_QUESTIONS = Array.from({ length: 5 }, (_, i) => ({
  id: `q_${i}`,
  prompt: `Question ${i}`,
  chips: ['A', 'B'],
  allowFreeText: false,
}))

beforeEach(() => {
  mockVerifyIdToken.mockResolvedValue({ uid: VALID_TOKEN_UID, email: 'test@test.com' })
  mockGetQuestionnaire.mockReturnValue(FIVE_QUESTIONS)
  mockGetFollowups.mockResolvedValue([
    {
      id: 'follow_1',
      prompt: 'Do you prefer ramen or sushi?',
      chips: ['Ramen', 'Sushi', 'Both'],
      allowFreeText: false,
    },
  ])
  mockSubmitAnswers.mockResolvedValue([
    {
      topic: 'food_and_restaurants',
      label: 'vegetarian',
      value: 'Prefers vegetarian food',
    },
    {
      topic: 'food_and_restaurants',
      label: 'japanese_cuisine',
      value: 'Loves Japanese cuisine',
    },
  ])
})

// ── GET /v1/scenarios/:topic/questionnaire ────────────────────────────────────

describe('GET /v1/scenarios/:topic/questionnaire', () => {
  it('returns 5 curated questions for food_and_restaurants', async () => {
    const app = await buildScenariosApp()
    const res = await app.inject({
      method: 'GET',
      url: '/v1/scenarios/food_and_restaurants/questionnaire',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.questions).toHaveLength(5)
    expect(body.data.questions[0]).toMatchObject({
      id: expect.any(String),
      prompt: expect.any(String),
    })
  })

  it('returns 5 curated questions for fashion', async () => {
    const app = await buildScenariosApp()
    const res = await app.inject({
      method: 'GET',
      url: '/v1/scenarios/fashion/questionnaire',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.questions).toHaveLength(5)
  })

  it('returns 401 without auth token', async () => {
    const app = await buildScenariosApp()
    const res = await app.inject({
      method: 'GET',
      url: '/v1/scenarios/food_and_restaurants/questionnaire',
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 for an unknown topic', async () => {
    const app = await buildScenariosApp()
    const res = await app.inject({
      method: 'GET',
      url: '/v1/scenarios/invalid_topic/questionnaire',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── POST /v1/scenarios/:topic/questionnaire/followups ────────────────────────

describe('POST /v1/scenarios/:topic/questionnaire/followups', () => {
  it('returns 1+ follow-up questions from the service', async () => {
    const app = await buildScenariosApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/scenarios/food_and_restaurants/questionnaire/followups',
      headers: authHeader(),
      payload: { answers: VALID_ANSWERS },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.followups).toHaveLength(1)
    expect(body.data.followups[0]).toMatchObject({
      id: expect.any(String),
      prompt: expect.any(String),
      chips: expect.any(Array),
    })
    expect(mockGetFollowups).toHaveBeenCalledWith(
      'food_and_restaurants',
      VALID_ANSWERS,
      expect.anything(),
    )
  })

  it('returns 401 without auth', async () => {
    const app = await buildScenariosApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/scenarios/food_and_restaurants/questionnaire/followups',
      payload: { answers: VALID_ANSWERS },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 when answers is missing', async () => {
    const app = await buildScenariosApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/scenarios/food_and_restaurants/questionnaire/followups',
      headers: authHeader(),
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── POST /v1/scenarios/:topic/questionnaire/submit ───────────────────────────

describe('POST /v1/scenarios/:topic/questionnaire/submit', () => {
  it('returns 3-4 memory proposals from the service', async () => {
    const app = await buildScenariosApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/scenarios/food_and_restaurants/questionnaire/submit',
      headers: authHeader(),
      payload: { answers: VALID_ANSWERS },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.proposals.length).toBeGreaterThanOrEqual(1)
    for (const proposal of body.data.proposals) {
      expect(proposal).toMatchObject({
        topic: 'food_and_restaurants',
        label: expect.any(String),
        value: expect.any(String),
      })
    }
    expect(mockSubmitAnswers).toHaveBeenCalledWith(
      'food_and_restaurants',
      VALID_ANSWERS,
      expect.anything(),
    )
  })

  it('returns 401 without auth', async () => {
    const app = await buildScenariosApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/scenarios/food_and_restaurants/questionnaire/submit',
      payload: { answers: VALID_ANSWERS },
    })
    expect(res.statusCode).toBe(401)
  })
})
