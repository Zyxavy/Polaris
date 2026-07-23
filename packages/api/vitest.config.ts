import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          d1Databases: { DB: 'test-db' },
          bindings: {
              BETTER_AUTH_SECRET: 'paragon-test-secret-32-characters-min!',
              BETTER_AUTH_URL: 'http://localhost:8787',
              MONGODB_URI: 'mongodb://localhost:27017/paragon',
          },
          queues: {
              'paragon-journal-retry': { binding: 'JOURNAL_RETRY_QUEUE' },
          },
        },
      }),
    ],
    test: {
      provide: { migrations },
    },
  };
});