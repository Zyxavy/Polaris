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
            BETTER_AUTH_SECRET: 'polaris-test-secret-32-characters-min!',
            BETTER_AUTH_URL: 'http://localhost:8787',
          },
        },
      }),
    ],
    test: {
      provide: { migrations },
    },
  };
});