import { betterAuth } from 'better-auth';

export function createAuth(env: {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
}) {
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET || '',
    baseURL: env.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || 'http://localhost:8787',
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    trustedOrigins: [
      'http://localhost:5173',
      'http://localhost:4173',
      'https://polaris-web.kelpselp.workers.dev',
    ],
  });
}