import { build } from 'vite';
await build({ configFile: false, resolve: { preserveSymlinks: true } });
