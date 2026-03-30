import { env as workerEnv } from 'cloudflare:workers';

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run<T = unknown>(): Promise<T>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
}

export interface PublicRuntimeEnv {
  DB: D1DatabaseLike;
}

export interface AdminRuntimeEnv extends PublicRuntimeEnv {
  DB: D1DatabaseLike;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD_HASH: string;
  ADMIN_SESSION_SECRET: string;
}

const assertString = (value: unknown, key: string) => {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  throw new Error(`Missing runtime environment variable: ${key}`);
};

const isRuntimeEnv = (value: unknown): value is PublicRuntimeEnv => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.DB !== undefined;
};

const getRawEnv = (): Record<string, unknown> => {
  if (!workerEnv || typeof workerEnv !== 'object') {
    throw new Error('Cloudflare runtime env is not available. Ensure this code runs on Workers runtime.');
  }
  return workerEnv as Record<string, unknown>;
};

export const getPublicEnv = (_locals?: App.Locals): PublicRuntimeEnv => {
  const runtimeEnv = getRawEnv();
  if (isRuntimeEnv(runtimeEnv)) return runtimeEnv;

  if (!runtimeEnv.DB) {
    throw new Error('Missing D1 binding: DB');
  }
  return {
    DB: runtimeEnv.DB as D1DatabaseLike,
  };
};

export const getAdminEnv = (locals?: App.Locals): AdminRuntimeEnv => {
  const publicEnv = getPublicEnv(locals);
  const runtimeEnv = getRawEnv();
  return {
    DB: publicEnv.DB,
    ADMIN_USERNAME: assertString(runtimeEnv.ADMIN_USERNAME, 'ADMIN_USERNAME'),
    ADMIN_PASSWORD_HASH: assertString(runtimeEnv.ADMIN_PASSWORD_HASH, 'ADMIN_PASSWORD_HASH'),
    ADMIN_SESSION_SECRET: assertString(runtimeEnv.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET'),
  };
};
