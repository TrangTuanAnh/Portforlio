import type { APIRoute } from 'astro';
import { deletePost, getPostById, slugExists, updatePost } from '../../../../lib/db';
import { getPublicEnv } from '../../../../lib/env';
import { json, readJsonBody } from '../../../../lib/http';
import { parsePostInput } from '../../../../lib/validators';

const parseId = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
};

export const GET: APIRoute = async ({ params, locals }) => {
  const id = parseId(params.id);
  if (!id) return json({ error: 'Invalid post id.' }, 400);

  try {
    const env = getPublicEnv(locals);
    const post = await getPostById(env.DB, id);
    if (!post) return json({ error: 'Post not found.' }, 404);
    return json({ data: post });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load post.';
    return json({ error: message }, 500);
  }
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const id = parseId(params.id);
  if (!id) return json({ error: 'Invalid post id.' }, 400);

  try {
    const env = getPublicEnv(locals);
    const payload = await readJsonBody(request);
    const input = parsePostInput(payload);

    if (await slugExists(env.DB, input.slug, id)) {
      return json({ error: 'Slug already exists.' }, 409);
    }

    const updated = await updatePost(env.DB, id, input);
    if (!updated) return json({ error: 'Post not found.' }, 404);
    return json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update post.';
    return json({ error: message }, 400);
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const id = parseId(params.id);
  if (!id) return json({ error: 'Invalid post id.' }, 400);

  try {
    const env = getPublicEnv(locals);
    await deletePost(env.DB, id);
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete post.';
    return json({ error: message }, 500);
  }
};
