import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      include: [
        'src/access/**/*.ts',
        'src/hooks/**/*.ts',
        'src/lib/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.config.ts',
        'src/app/**',
        'src/collections/**',
        'src/migrations/**',
        'src/scripts/**',
        'src/payload-types.ts',
        'src/payload.config.ts',
      ],
    },
    include: ['src/**/*.test.ts'],
  },
})
