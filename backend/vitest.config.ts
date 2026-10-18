const { defineConfig } = require('vitest/config');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

module.exports = defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  test: {
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/services/host-auth.service.ts',
        'src/services/voter.service.ts',
        'src/services/voting.service.ts'
      ],
      reporter: ['text', 'html', 'json'],
      reportsDirectory: 'coverage'
    }
  }
});
