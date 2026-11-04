import { startVitest } from 'vitest/node';
const context = await startVitest('test', [], {
  config: false, dir: 'src', pool: 'threads', maxWorkers: 1, minWorkers: 1, watch: false,
}, { configFile: false, resolve: { preserveSymlinks: true } });
if (!context) throw new Error('Vitest did not initialize.');
const files = context.state.getFiles();
process.exitCode = !files.length || files.some(file => file.result?.state === 'fail') ? 1 : 0;
await context.close();
