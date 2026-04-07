import { access } from 'node:fs/promises';
import path from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { appConfig, projectRoot } from './config';
import { repository } from './db/repository';
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { dashboardRoutes } from './routes/dashboard';
import { metaRoutes } from './routes/meta';
import { processCardRoutes } from './routes/process-cards';

const server = Fastify({
  logger: appConfig.serverLogEnabled,
});

await repository.init();

await server.register(cors, {
  origin: appConfig.corsOrigin,
});

server.get('/api/health', async () => ({ status: 'ok' }));

await server.register(authRoutes, { prefix: '/api/auth' });
await server.register(dashboardRoutes, { prefix: '/api/dashboard' });
await server.register(metaRoutes, { prefix: '/api/meta' });
await server.register(adminRoutes, { prefix: '/api/admin' });
await server.register(processCardRoutes, { prefix: '/api/process-cards' });

const distPath = path.join(projectRoot, 'dist');
const indexFile = path.join(distPath, 'index.html');

try {
  await access(indexFile);

  await server.register(fastifyStatic, {
    root: distPath,
    prefix: '/',
    wildcard: false,
  });

  server.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api')) {
      reply.code(404).send({ message: '接口不存在。' });
      return;
    }

    reply.sendFile('index.html');
  });
} catch {
  server.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api')) {
      reply.code(404).send({ message: '接口不存在。' });
      return;
    }

    reply.code(404).send({ message: '前端尚未构建，请使用 npm run dev 启动开发环境。' });
  });
}

server.listen({ port: appConfig.port, host: appConfig.host }).catch((error) => {
  console.error(error);
  process.exit(1);
});
