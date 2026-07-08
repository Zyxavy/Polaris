import { Hono } from 'hono'
import { createAuth } from './auth';
import type {User, Session } from 'better-auth/types';
import { requireAuth } from './middleware/require-auth';

const app = new Hono<{ Bindings: CloudflareBindings; Variables: { user: User | null; session: Session | null } }>();

app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

app.use('/api/*', async(c, next) => {
  if (c.req.path.startsWith('/api/auth')) return next();
  return requireAuth(c, next);
});

export default app