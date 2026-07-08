import { describe, it, expect } from 'vitest';
import { generateRecoveryCode } from '../lib/recovery';

describe('generateRecoveryCode', () => {
  it('matches POLARIS-XXXX-XXXX', () => {
    expect(generateRecoveryCode()).toMatch(/^POLARIS-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateRecoveryCode()));
    expect(codes.size).toBe(100);
  });
});