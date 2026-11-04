import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export const BASELINE_REF = '6c15f32f1e4427650e37be7709aa9a5fd84f8de6';

/** Transpile the real source at each revision; never maintain a second game. */
export async function loadGame(ref) {
  const root = process.cwd();
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'squeekspire-score-sim-'));
  const directory = path.join(scratch, 'src', 'game');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(scratch, 'package.json'), '{"type":"module"}\n');
  await cp(path.join(root, 'fixtures'), path.join(scratch, 'fixtures'), { recursive: true });
  const files = ref
    ? execFileSync('git.exe', ['ls-tree', '-r', '--name-only', ref, 'src/game'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).map(file => path.basename(file))
    : await readdir(path.join(root, 'src', 'game'));
  for (const file of files.filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))) {
    const source = ref
      ? execFileSync('git.exe', ['show', `${ref}:src/game/${file}`], { cwd: root, encoding: 'utf8' })
      : await readFile(path.join(root, 'src', 'game', file), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    await writeFile(path.join(directory, file.replace(/\.ts$/, '.js')), output);
  }
  const game = Object.assign({}, ...await Promise.all(['engine', 'map', 'data', 'catalog', 'cardValues', 'score'].map(name => import(pathToFileURL(path.join(directory, `${name}.js`)).href))));
  return { game, async cleanup() {
    if (path.dirname(scratch) !== path.resolve(os.tmpdir()) || !path.basename(scratch).startsWith('squeekspire-score-sim-')) throw new Error('Unexpected simulation scratch path');
    await rm(scratch, { recursive: true, force: true });
  } };
}
