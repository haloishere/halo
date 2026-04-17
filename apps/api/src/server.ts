import { initSentry, Sentry } from './lib/sentry.js'
import { initTelemetry } from './lib/telemetry.js'
import { initAiClient } from './lib/vertex-ai.js'
import { buildApp } from './app.js'

// Initialize observability before app starts
initSentry()
const otelSdk = initTelemetry()

// OTP test mode must only be enabled in development/test environments
if (
  process.env.OTP_TEST_MODE === 'true' &&
  process.env.NODE_ENV !== 'development' &&
  process.env.NODE_ENV !== 'test'
) {
  throw new Error('OTP_TEST_MODE must not be enabled outside development/test environments')
}

// #19: Validate PORT
const PORT = parseInt(process.env.PORT ?? '3000', 10)
if (Number.isNaN(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error(`Invalid PORT: "${process.env.PORT}". Must be 1-65535.`)
}
const HOST = process.env.HOST ?? '0.0.0.0'

async function start() {
  const app = await buildApp()

  // Pre-warm Vertex AI client when configured
  if (process.env.VERTEX_AI_PROJECT) {
    try {
      initAiClient(app.log)
    } catch (err) {
      app.log.warn({ err }, 'Vertex AI client initialization failed — AI features disabled')
    }
  }

  // #2: Graceful shutdown with isolated error handling per step
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT']
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`)
      try {
        await app.close()
      } catch (err) {
        app.log.error({ err }, 'Error during app shutdown')
      }
      try {
        if (otelSdk) await otelSdk.shutdown()
      } catch (err) {
        app.log.error({ err }, 'Error during OTel shutdown')
      }
      try {
        await Sentry.close(2000)
      } catch (err) {
        console.error('Sentry flush failed:', err)
      }
      process.exit(0)
    })
  }

  try {
    await app.listen({ port: PORT, host: HOST })
    app.log.info(`Server listening on ${HOST}:${PORT}`)
  } catch (err) {
    app.log.error({ err }, 'Server failed to start')
    try {
      await Sentry.close(2000)
    } catch (sentryErr) {
      process.stderr.write(`Sentry flush failed during listen error: ${sentryErr}\n`)
    }
    process.exit(1)
  }
}

// #1: Handle startup failures with .catch()
start().catch((err) => {
  console.error('Fatal startup error:', err)
  Sentry.captureException(err)
  Sentry.close(2000)
    .catch((sentryErr) => {
      process.stderr.write(`Sentry flush failed during startup error: ${sentryErr}\n`)
    })
    .finally(() => process.exit(1))
})
