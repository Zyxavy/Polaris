import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuth } from './auth';
import type { User, Session } from 'better-auth/types';
import { requireAuth } from './middleware/require-auth';
import { handleRecovery } from './lib/recovery';
import systemsRoutes from './routes/systems';
import recoveryRoutes from './routes/recovery';
import schedulesRoutes from './routes/schedules';
import dashboardRoutes from './routes/dashboard';
import { tomorrowManilaDate } from './lib/calendar';
import { generateInstancesForAllUsers } from './services/instances';
import { instanceRoutes, systemInstanceRoutes } from './routes/instances';
import workspaceRoutes from './routes/workspace';
import counterLogRoutes from './routes/counter-logs';
import timerSessionRoutes from './routes/timer-sessions';
import checklistRoutes from './routes/checklist';


const app = new Hono<{ Bindings: CloudflareBindings; Variables: { user: User | null; session: Session | null } }>();

app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:4173', 'https://polaris.kelpselp.workers.dev'],
  credentials: true
}));

app.post('/api/auth/recover', async (c) => {
  const { email, recovery_code, new_password } = await c.req.json();
  const result = await handleRecovery(c.env.DB, email, recovery_code, new_password);
  const errorKey = result.status === 400 ? 'validation_error' : result.status === 401 ? 'invalid_credentials' : undefined;
  return c.json(errorKey ? { error: errorKey, message: result.message } : { message: result.message }, result.status as 200 | 400 | 401);
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

// Systems route
app.route('/api/systems', systemsRoutes);

// Schedules
app.route('/api/systems/:system_id/schedules', schedulesRoutes);
app.route('/api/schedules', schedulesRoutes);

// Dashboard
app.route('/api/dashboard', dashboardRoutes);

// Instances
app.route('/api/instances', instanceRoutes);
app.route('/api/systems', systemInstanceRoutes);

// Workspace
app.route('/api/systems/:system_id/workspace', workspaceRoutes);

// Counter logs
app.route('/api', counterLogRoutes);

// Timer sessions
app.route('/api', timerSessionRoutes);

// Checklist
app.route('/api', checklistRoutes);

// Placeholder
app.get('/', (c) => c.text('Hello Hono!'));

export default app;

export async function scheduled(event: ScheduledEvent, env: CloudflareBindings, ctx: ExecutionContext) {
  const tomorrow = tomorrowManilaDate();
  console.log(`[cron] pre-generate instances date=${tomorrow}`);
  await generateInstancesForAllUsers(env.DB, tomorrow);
  console.log(`[cron] pre-generate complete date=${tomorrow}`);
}