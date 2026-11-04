import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** Vercel includes public/data in each function bundle; no request origin is trusted. */
export function createDailyFiles(directory = resolve(process.cwd(), 'public', 'data', 'daily')) {
  return {
    read(name) {
      if (!/^(?:latest|\d{4}-\d{2}-\d{2})\.json$/.test(name)) return undefined;
      try { return JSON.parse(readFileSync(resolve(directory, name), 'utf8')); }
      catch { return undefined; }
    },
    datedFiles() {
      try { return readdirSync(directory).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort().reverse(); }
      catch { return []; }
    },
  };
}
