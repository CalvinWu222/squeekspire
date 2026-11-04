import { createServer, loadEnv } from 'vite';
const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
for (const [key, value] of Object.entries(env)) if (process.env[key] === undefined) process.env[key] = value;
const server = await createServer({
  configFile: false, resolve: { preserveSymlinks: true }, server: { host: '127.0.0.1' },
  plugins: [{
    name: 'squeekspire-local-api',
    configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith('/api/')) return next();
        try {
          const { default: handler } = await vite.ssrLoadModule('/server/api.ts');
          await handler(request, response);
        } catch {
          response.statusCode = 503;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ error: 'leaderboard_unavailable', message: 'Local API failed to load' }));
        }
      });
    },
  }],
});
await server.listen();
server.printUrls();
