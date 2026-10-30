import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

export const ROOT = process.cwd();
export const dataDir = () => path.resolve(ROOT, env('OPENPATH_DATA_DIR', 'data'));

export function env(name: string, fallback = ''): string {
  if (process.env[name]?.trim()) return process.env[name]!.trim();
  try { return parse(readFileSync(path.join(ROOT, '.env')))[name]?.trim() || fallback; }
  catch { return fallback; }
}

export function config() {
  return {
    port: Number(env('PORT', '4173')),
    host: env('HOST', '127.0.0.1'),
    key: env('NEBIUS_API_KEY'),
    baseURL: env('NEBIUS_BASE_URL', 'https://api.tokenfactory.nebius.com/v1/'),
    model: env('NEBIUS_MODEL', 'nvidia/Nemotron-3_5-Lightning'),
    accessToken: env('APP_ACCESS_TOKEN'),
    allowedHosts: env('AUDIT_ALLOWED_HOSTS').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
    maxPages: Math.min(4, Math.max(1, Number(env('MAX_AUDIT_PAGES', '4')) || 4)),
    modelTimeout: Math.min(60000, Math.max(5000, Number(env('MODEL_TIMEOUT_MS', '30000')) || 30000)),
    noSandbox: env('CHROMIUM_NO_SANDBOX', 'false') === 'true',
  };
}

export function demoOrigin() { return `http://127.0.0.1:${config().port}`; }
export function isDemoUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.origin === demoOrigin() && /^\/demo\/(broken|fixed)(\/|$)/.test(url.pathname);
  } catch { return false; }
}

export function browserExists(executable: string) { return existsSync(executable); }
