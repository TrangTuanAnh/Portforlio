import type { APIRoute } from 'astro';
import { marked } from 'marked';
import { json, readJsonBody } from '../../../../lib/http';

interface PreviewPayload {
  markdown?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await readJsonBody<PreviewPayload>(request);
    const markdown = typeof payload.markdown === 'string' ? payload.markdown : '';
    const html = await marked.parse(markdown);
    return json({ data: { html } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to render markdown.';
    return json({ error: message }, 400);
  }
};
