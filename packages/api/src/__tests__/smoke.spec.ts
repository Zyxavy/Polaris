import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { describe, it, expect, beforeEach, inject } from 'vitest';

const migrations = inject('migrations');

/**
 * Creates a stub `user` table matching Better Auth's expected shape so FK
 * references in the application tables (systems.user_id, etc.) resolve during
 * tests. Better Auth creates the real table in Slice 8; until then, this stub
 * keeps the schema testable without disabling FK enforcement.
 */
async function seedUserStub(db: D1Database) {
  // Insert a stub user row for FK references. The user table is created by
  // the 0014_better_auth_core.sql migration with NOT NULL on email/createdAt/updatedAt.
  const now = new Date().toISOString();
  await db.prepare(
    "INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind('fake_user_abc', 'Test User', 'fake@test.com', 1, now, now).run();
}

describe('D1 schema smoke test', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, migrations);
    await seedUserStub(env.DB);
  });

  it('0001: PRAGMA foreign_keys is ON', async () => {
    const result = await env.DB.prepare("PRAGMA foreign_keys").first<{ foreign_keys: number }>();
    expect(result!.foreign_keys).toBe(1);
  });

  it('can insert and read a system', async () => {
    await env.DB
      .prepare(
        `INSERT INTO systems (id, user_id, name, domain, purpose, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind('sys_001', 'fake_user_abc', 'Test System', 'health',
        'Test every day', new Date().toISOString(), new Date().toISOString())
      .run();

    const result = await env.DB
      .prepare("SELECT id, name, domain FROM systems WHERE id = ?")
      .bind('sys_001')
      .first<{ id: string; name: string; domain: string }>();

    expect(result).toBeDefined();
    expect(result!.name).toBe('Test System');
    expect(result!.domain).toBe('health');
  });

  it('UNIQUE(system_id, date) on instances rejects duplicates', async () => {
    await env.DB
      .prepare(
        `INSERT INTO systems (id, user_id, name, domain, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind('sys_002', 'fake_user_abc', 'Dup Test', 'fitness',
        new Date().toISOString(), new Date().toISOString())
      .run();

    await env.DB
      .prepare(
        `INSERT INTO instances (id, system_id, date, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind('inst_001', 'sys_002', '2026-07-05', 'full',
        new Date().toISOString(), new Date().toISOString())
      .run();

    await expect(
      env.DB
        .prepare(
          `INSERT INTO instances (id, system_id, date, state, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind('inst_002', 'sys_002', '2026-07-05', 'floor',
          new Date().toISOString(), new Date().toISOString())
        .run()
    ).rejects.toThrow();
  });
});