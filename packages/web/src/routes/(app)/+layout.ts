import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { authClient } from '$lib/auth-client';

export const load: LayoutLoad = async () => {
  const { data: session } = await authClient.getSession();
  if (!session) {
    throw redirect(302, '/sign-in');
  }
  return { session };
};