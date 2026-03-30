import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const wranglerPath = join(process.cwd(), 'dist', 'server', 'wrangler.json');

if (!existsSync(wranglerPath)) {
  console.log('Skip patch: dist/server/wrangler.json not found.');
  process.exit(0);
}

const raw = readFileSync(wranglerPath, 'utf-8');
const parsed = JSON.parse(raw);

// Pages provides ASSETS internally, and explicitly declaring it causes deploy validation errors.
if (parsed.assets) {
  delete parsed.assets;
}

// Pages validator rejects empty triggers object; explicit empty cron list is valid.
if (parsed.triggers && Object.keys(parsed.triggers).length === 0) {
  parsed.triggers = { crons: [] };
}

// Keep only fully-defined KV bindings to avoid invalid binding errors.
if (Array.isArray(parsed.kv_namespaces)) {
  parsed.kv_namespaces = parsed.kv_namespaces.filter(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      typeof entry.binding === 'string' &&
      typeof entry.id === 'string',
  );
}

writeFileSync(wranglerPath, JSON.stringify(parsed), 'utf-8');
console.log('Patched dist/server/wrangler.json for Cloudflare Pages deploy validation.');
