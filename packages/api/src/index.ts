import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuth } from './auth';
import type { User, Session } from 'better-auth/types';
import { requireAuth } from './middleware/require-auth';
import { handleRecovery } from './lib/recovery';
import recoveryRoutes from './routes/recovery';

const app = new Hono<{ Bindings: CloudflareBindings; Variables: { user: User | null; session: Session | null } }>();

app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:4173', 'https://polaris.kelpselp.workers.dev'],
  credentials: true
}));

app.post('/api/auth/recover', async (c) => {
  const { email, recovery_code, new_password } = await c.req.json();
  const result = await handleRecovery(c.env.DB, email, recovery_code, new_password);
  const errorKey = result.status === 400 ? 'validation_error' : result.status === 401 ? 'invalid_credentials' : undefined;
  return c.json(errorKey ? { error: errorKey, message: result.message } : { message: result.message }, result.status);
});

// Better Auth catch-all
app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

// Recovery codes routes
app.route('/api/recovery-codes', recoveryRoutes);

// Auth guard for all other /api/*
app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth/')) return next();
  return requireAuth(c, next);
});

// Placeholder
app.get('/', (c) => c.text('Hello Hono!'));

export default app;