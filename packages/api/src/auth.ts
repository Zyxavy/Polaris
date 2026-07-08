import { betterAuth } from 'better-auth';

export function createAuth(env: CloudflareBindings) {
    return betterAuth({
        database: env.DB,
        emailAndPassword: { enabled: true, requireEmailVerification: false },
        session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
        trustedOrigins: ['http://localhost:5173', 'https://polaris.kelpselp.workers.dev'],
    });
}