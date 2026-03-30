import { compare } from 'bcryptjs';
import type { AstroCookies } from 'astro';
import type { AdminRuntimeEnv } from './env';

const SESSION_COOKIE_NAME = 'admin_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const textEncoder = new TextEncoder();

interface SessionPayload {
  u: string;
  e: number;
}

const cryptoKeyCache = new Map<string, Promise<CryptoKey>>();

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const constantTimeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
};

const getCryptoKey = async (secret: string): Promise<CryptoKey> => {
  if (!cryptoKeyCache.has(secret)) {
    cryptoKeyCache.set(
      secret,
      crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
      ]),
    );
  }
  const cached = cryptoKeyCache.get(secret);
  if (!cached) throw new Error('Unable to create crypto key.');
  return cached;
};

const signValue = async (value: string, secret: string): Promise<string> => {
  const key = await getCryptoKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
};

export const isSameOriginMutation = (request: Request): boolean => {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const requestOrigin = new URL(request.url).origin;
  return origin === requestOrigin;
};

export const verifyAdminCredentials = async (
  username: string,
  password: string,
  env: AdminRuntimeEnv,
): Promise<boolean> => {
  if (username !== env.ADMIN_USERNAME) return false;
  return compare(password, env.ADMIN_PASSWORD_HASH);
};

const createToken = async (env: AdminRuntimeEnv): Promise<string> => {
  const payload: SessionPayload = {
    u: env.ADMIN_USERNAME,
    e: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const payloadEncoded = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = await signValue(payloadEncoded, env.ADMIN_SESSION_SECRET);
  return `${payloadEncoded}.${signature}`;
};

const verifyToken = async (token: string, env: AdminRuntimeEnv): Promise<boolean> => {
  const [payloadEncoded, signature] = token.split('.');
  if (!payloadEncoded || !signature) return false;

  const expectedSignature = await signValue(payloadEncoded, env.ADMIN_SESSION_SECRET);
  if (!constantTimeEqual(signature, expectedSignature)) return false;

  try {
    const payloadJson = new TextDecoder().decode(fromBase64Url(payloadEncoded));
    const payload = JSON.parse(payloadJson) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.u !== env.ADMIN_USERNAME) return false;
    if (payload.e <= now) return false;
    return true;
  } catch {
    return false;
  }
};

const isSecureRequest = (request: Request): boolean => {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto) return forwardedProto.includes('https');
  return new URL(request.url).protocol === 'https:';
};

export const startAdminSession = async (cookies: AstroCookies, request: Request, env: AdminRuntimeEnv) => {
  const token = await createToken(env);
  cookies.set(SESSION_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'strict',
    maxAge: SESSION_DURATION_SECONDS,
  });
};

export const endAdminSession = (cookies: AstroCookies) => {
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
};

export const isAdminAuthenticated = async (cookies: AstroCookies, env: AdminRuntimeEnv): Promise<boolean> => {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token, env);
};
