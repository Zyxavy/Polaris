import { Hono } from 'hono';
import { requireAuth } from '../middleware/require-auth';
import { generateRecoveryCode } from '../lib/recovery';
import type { User, Session } from 'better-auth/types';

const app = new Hono<{
  Bindings: CloudflareBindings;
  Variables: { user: User; session: Session };
}>();

app.use('/*', requireAuth);

app.post('/generate', async (c) => {
  const userId = c.get('user').id;
  const db = c.env.DB;

  await db.prepare(
    "DELETE FROM recovery_codes WHERE user_id = ? AND used_at IS NULL"
  ).bind(userId).run();

  const stmt = db.prepare(
    "INSERT INTO recovery_codes (id, user_id, code, created_at) VALUES (?, ?, ?, ?)"
  );

  const codes: string[] = [];
  const batch: D1PreparedStatement[] = Array.from({ length: 3 }, () => {
    const code = generateRecoveryCode();
    codes.push(code);
    return stmt.bind(crypto.randomUUID(), userId, code, new Date().toISOString());
  });

  await db.batch(batch);

  return c.json({ codes }, 201);
});

app.get('/', async (c) => {
  const userId = c.get('user').id;
  const db = c.env.DB;

  const { results } = await db.prepare(
    "SELECT id, code, created_at FROM recovery_codes WHERE user_id = ? AND used_at IS NULL"
  ).bind(userId).all<{ id: string; code: string; created_at: string }>();

  return c.json({ codes: results ?? [] });
});

export default app;