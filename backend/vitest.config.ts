const { defineConfig } = require('vitest/config');
const path = require('node:path');

module.exports = defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts']
  }
});
