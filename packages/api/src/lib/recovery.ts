export function generateRecoveryCode(): string {
  const raw = crypto.randomUUID().replace(/-/g, '').toUpperCase();
  return `POLARIS-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  status: number;
}

export async function handleRecovery(
  db: D1Database,
  email: string,
  recoveryCode: string,
  newPassword: string,
): Promise<RecoveryResult> {
  if (!email || !recoveryCode || !newPassword) {
    return { success: false, message: 'Email, recovery code, and new password are required.', status: 400 };
  }
  if (newPassword.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters.', status: 400 };
  }

  const user = await db.prepare('SELECT id FROM user WHERE email = ?').bind(email).first<{ id: string }>();
  if (!user) {
    return { success: false, message: 'Invalid email or recovery code.', status: 401 };
  }

  const codes = await db.prepare(
    "SELECT id, code FROM recovery_codes WHERE user_id = ? AND used_at IS NULL"
  ).bind(user.id).all<{ id: string; code: string }>();

  const match = codes.results?.find(row => row.code === recoveryCode);
  if (!match) {
    return { success: false, message: 'Invalid email or recovery code.', status: 401 };
  }

  await db.prepare("UPDATE recovery_codes SET used_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), match.id).run();

  const { hashPassword } = await import('better-auth/crypto');
  const hashedPassword = await hashPassword(newPassword);

  await db.prepare("UPDATE account SET password = ? WHERE userId = ?")
    .bind(hashedPassword, user.id).run();

  return { success: true, message: 'Password reset successfully.', status: 200 };
}