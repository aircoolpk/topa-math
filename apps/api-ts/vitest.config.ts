import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    testTimeout: 20_000,
    // The integration tests share one database, so the files must not run
    // next to each other: one file cleans up its fixtures while the other
    // still holds a token for an account that no longer exists.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
})
