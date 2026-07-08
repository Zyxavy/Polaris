import { createAuthClient } from 'better-auth/svelte';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

export const authClient = createAuthClient({
  baseURL: BASE ? `${BASE}/api/auth` : undefined,
});

export const { signIn, signUp, signOut, useSession } = authClient;