import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** Dev-only persistence; writes are serialized by the store and replaced atomically. */
export function localFile(filename) {
  const path = resolve(filename);
  return {
    async read() {
      try { return JSON.parse(await readFile(path, 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    },
    async write(entries) {
      await mkdir(dirname(path), { recursive: true });
      const pending = `${path}.${process.pid}.pending`;
      await writeFile(pending, JSON.stringify(entries), 'utf8');
      await rename(pending, path);
    },
  };
}
