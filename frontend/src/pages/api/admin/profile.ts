import type { APIRoute } from 'astro';
import { getPublicEnv } from '../../../lib/env';
import { getProfile, saveProfile } from '../../../lib/db';
import { parseProfileInput } from '../../../lib/validators';
import { json, readJsonBody } from '../../../lib/http';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = getPublicEnv(locals);
    const profile = await getProfile(env.DB);
    return json({ data: profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load profile.';
    return json({ error: message }, 500);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const env = getPublicEnv(locals);
    const payload = await readJsonBody(request);
    const input = parseProfileInput(payload);
    const saved = await saveProfile(env.DB, input);
    return json({ data: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save profile.';
    return json({ error: message }, 400);
  }
};
