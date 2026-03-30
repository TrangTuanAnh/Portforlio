import type { APIRoute } from 'astro';
import { endAdminSession } from '../../../../lib/auth';
import { json } from '../../../../lib/http';

export const POST: APIRoute = async ({ cookies }) => {
  endAdminSession(cookies);
  return json({ ok: true });
};
