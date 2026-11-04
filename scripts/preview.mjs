import { preview } from 'vite';
const server = await preview({ configFile: false, resolve: { preserveSymlinks: true }, preview: { host: '127.0.0.1' } });
server.printUrls();
