import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: [
		{
			command: 'npm run dev:e2e',
			port: 8787,
			cwd: '../api',
			reuseExistingServer: true,
		},
		{
			command: 'npm run build && npm run preview',
			port: 4173,
			env: { VITE_API_BASE_URL: 'http://localhost:8787' },
			reuseExistingServer: true,
		},
	],
	testMatch: '**/*.e2e.{ts,js}'
});
