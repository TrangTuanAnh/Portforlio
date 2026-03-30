import type { APIRoute } from 'astro';
import { createPost, listPosts, slugExists } from '../../../lib/db';
import { getPublicEnv } from '../../../lib/env';
import { json, readJsonBody } from '../../../lib/http';
import { parsePostInput } from '../../../lib/validators';
import type { PostType } from '../../../lib/models';

const parseType = (value: string | null): PostType | undefined => {
  if (!value) return undefined;
  if (value === 'ctf' || value === 'project' || value === 'blog') return value;
  return undefined;
};

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const env = getPublicEnv(locals);
    const type = parseType(url.searchParams.get('type'));
    const status = url.searchParams.get('status');
    const includeDrafts = status !== 'published';

    let posts = await listPosts(env.DB, { type, includeDrafts });
    if (status === 'draft') {
      posts = posts.filter((post) => !post.isPublished);
    }

    return json({ data: posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load posts.';
    return json({ error: message }, 500);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = getPublicEnv(locals);
    const payload = await readJsonBody(request);
    const input = parsePostInput(payload);

    if (await slugExists(env.DB, input.slug)) {
      return json({ error: 'Slug already exists.' }, 409);
    }

    const created = await createPost(env.DB, input);
    return json({ data: created }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create post.';
    return json({ error: message }, 400);
  }
};
