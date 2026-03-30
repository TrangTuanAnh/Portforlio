import type { APIRoute } from 'astro';
import { getAdminEnv } from '../../../../lib/env';
import { readJsonBody, json } from '../../../../lib/http';
import { startAdminSession, verifyAdminCredentials } from '../../../../lib/auth';

interface LoginPayload {
  username?: string;
  password?: string;
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const env = getAdminEnv(locals);
    const payload = await readJsonBody<LoginPayload>(request);
    const username = typeof payload.username === 'string' ? payload.username.trim() : '';
    const password = typeof payload.password === 'string' ? payload.password : '';

    if (!username || !password) {
      return json({ error: 'Username and password are required.' }, 400);
    }

    const valid = await verifyAdminCredentials(username, password, env);
    if (!valid) {
      return json({ error: 'Invalid credentials.' }, 401);
    }

    await startAdminSession(cookies, request, env);
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed.';
    return json({ error: message }, 500);
  }
};
