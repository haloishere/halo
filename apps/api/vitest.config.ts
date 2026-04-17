import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      include: ['src/**/*.ts'],
      exclude: [
        'src/test/**',
        'src/server.ts',
        'src/db/**',
        'src/jobs/**',
        'src/lib/sentry.ts',
        'src/lib/telemetry.ts',
        'src/plugins/drizzle.ts',
        '**/*.test.ts',
        '**/*.integration.test.ts',
        '**/*.config.ts',
      ],
    },
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
  },
})
