import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

export function initTelemetry(): NodeSDK | undefined {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    process.stderr.write(
      '[halo-api] WARN: OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing is DISABLED.\n',
    )
    return undefined
  }

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [getNodeAutoInstrumentations()],
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'halo-api',
  })

  sdk.start()
  return sdk
}
