import { Hono } from 'hono'
import { createAuth } from './auth';
import type { User, Session } from 'better-auth/types';
import { requireAuth } from './middleware/require-auth';
import recoveryRoutes from './routes/recovery';

const app = new Hono<{ Bindings: CloudflareBindings; Variables: { user: User | null; session: Session | null } }>();

app.post('/api/auth/recover', async (c) => {
  const { email, recovery_code, new_password } = await c.req.json();

  if (!email || !recovery_code || !new_password) {
    return c.json({ error: 'validation_error', message: 'Email, recovery code, and new password are required.' }, 400);
  }
  if (new_password.length < 8) {
    return c.json({ error: 'validation_error', message: 'Password must be at least 8 characters.' }, 400);
  }

  const db = c.env.DB;

  const user = await db.prepare('SELECT id FROM user WHERE email = ?').bind(email).first<{ id: string }>();
  if (!user) {
    return c.json({ error: 'invalid_credentials', message: 'Invalid email or recovery code.' }, 401);
  }

  const codes = await db.prepare(
    "SELECT id, code FROM recovery_codes WHERE user_id = ? AND used_at IS NULL"
  ).bind(user.id).all<{ id: string; code: string }>();

  const match = codes.results?.find(row => row.code === recovery_code);
  if (!match) {
    return c.json({ error: 'invalid_credentials', message: 'Invalid email or recovery code.' }, 401);
  }

  await db.prepare("UPDATE recovery_codes SET used_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), match.id).run();

  const { hashPassword } = await import('better-auth/crypto');
  const hashedPassword = await hashPassword(new_password);

  await db.prepare("UPDATE account SET password = ? WHERE userId = ?")
    .bind(hashedPassword, user.id).run();

  return c.json({ message: 'Password reset successfully.' });
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