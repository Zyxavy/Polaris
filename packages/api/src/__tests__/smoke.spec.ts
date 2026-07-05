import { env, applyD1Migrations } from 'cloudflare:test';
import { type D1Migration } from '@cloudflare/vitest-pool-workers';
import { inject } from 'vitest';

const migrations = inject<D1Migration[]>('migrations');

describe('D1 schema smoke test', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, migrations);
  });

  it('0001: PRAGMA foreign_keys is ON', async () => {
    const result = await env.DB.prepare("PRAGMA foreign_keys").first<{ foreign_keys: number }>();
    expect(result!.foreign_keys).toBe(1);
  });

  it('can insert and read a system', async () => {
    await env.DB.exec("PRAGMA foreign_keys = OFF");

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
    await env.DB.exec("PRAGMA foreign_keys = OFF");

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