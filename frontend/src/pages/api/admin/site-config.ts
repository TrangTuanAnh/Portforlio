import type { APIRoute } from 'astro';
import { getPublicEnv } from '../../../lib/env';
import { getSiteConfig, saveSiteConfig } from '../../../lib/db';
import { parseSiteConfigInput } from '../../../lib/validators';
import { json, readJsonBody } from '../../../lib/http';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = getPublicEnv(locals);
    const config = await getSiteConfig(env.DB);
    return json({ data: config });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load site config.';
    return json({ error: message }, 500);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const env = getPublicEnv(locals);
    const payload = await readJsonBody(request);
    const input = parseSiteConfigInput(payload);
    const saved = await saveSiteConfig(env.DB, input);
    return json({ data: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save site config.';
    return json({ error: message }, 400);
  }
};
