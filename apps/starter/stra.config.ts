import { defineConfig } from '@stra/core'

export default defineConfig({
  // STRA runtime configuration
  runtime: {
    // Enable devtools in development
    devtools: true,
    // Strict mode: enforce action-only writes
    strict: true,
  },
})
