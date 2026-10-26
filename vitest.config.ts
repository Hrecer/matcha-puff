import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'desktop/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-self/**'],
    testTimeout: 15_000,
  },
})
