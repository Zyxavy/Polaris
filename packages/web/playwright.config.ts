import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: [
		{
			command: 'pnpm run dev:e2e',
			port: 8787,
			cwd: '../api',
			reuseExistingServer: true,
		},
		{
			command: 'pnpm build && pnpm preview',
			port: 4173,
			env: { VITE_API_BASE_URL: 'http://localhost:8787' },
			reuseExistingServer: true,
		},
	],
	use: { baseURL: 'http://localhost:4173' },
	testMatch: '**/*.e2e.{ts,js}'
});
