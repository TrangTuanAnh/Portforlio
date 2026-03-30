import type { MiddlewareHandler } from 'astro';
import { getAdminEnv } from './lib/env';
import { isAdminAuthenticated, isSameOriginMutation } from './lib/auth';

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const isAdminPage = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');
const isAdminApi = (pathname: string) => pathname === '/api/admin' || pathname.startsWith('/api/admin/');
const isLoginPage = (pathname: string) => pathname === '/admin/login';
const isLoginApi = (pathname: string) => pathname === '/api/admin/auth/login';

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { pathname } = context.url;
  if (!isAdminPage(pathname) && !isAdminApi(pathname)) return next();

  const env = getAdminEnv(context.locals);
  const authenticated = await isAdminAuthenticated(context.cookies, env);

  if (isAdminPage(pathname)) {
    if (isLoginPage(pathname)) {
      if (authenticated) return context.redirect('/admin');
      return next();
    }

    if (!authenticated) return context.redirect('/admin/login');
    return next();
  }

  if (!isSameOriginMutation(context.request)) {
    return json({ error: 'Forbidden origin.' }, 403);
  }

  if (isLoginApi(pathname)) return next();
  if (!authenticated) return json({ error: 'Unauthorized.' }, 401);
  return next();
};
