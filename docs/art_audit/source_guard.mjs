import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = process.cwd();
const output = 'docs/art_audit/source_hashes.json';
async function walk(p) {
  const result = [];
  for (const e of await readdir(p, { withFileTypes: true })) {
    const file = path.join(p, e.name);
    if (e.isDirectory()) result.push(...await walk(file));
    else result.push(file.replaceAll('\\', '/'));
  }
  return result;
}
const files = [...(await Promise.all(['src', 'api', 'server', 'scripts', 'fixtures'].map(walk))).flat(), 'package.json', 'package-lock.json', 'index.html', 'tsconfig.json'];
const hashes = {};
for (const file of files.sort()) hashes[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
if (process.argv.includes('--verify')) {
  const before = JSON.parse(await readFile(output, 'utf8'));
  const changed = [...new Set([...Object.keys(before.hashes), ...Object.keys(hashes)])].filter(file => before.hashes[file] !== hashes[file]);
  const result = { verifiedAt: new Date().toISOString(), files: files.length, changed, unchanged: changed.length === 0 };
  await writeFile('docs/art_audit/source_integrity.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (changed.length) process.exitCode = 1;
} else {
  await writeFile(output, JSON.stringify({ capturedAt: new Date().toISOString(), hashes }, null, 2));
  console.log(`Recorded SHA-256 for ${files.length} source/config/fixture files.`);
}
