import path from 'node:path';
import { access } from 'node:fs/promises';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { repository } from './db/repository';
import { metaRoutes } from './routes/meta';
import { processCardRoutes } from './routes/process-cards';

const server = Fastify({
  logger: false,
});

await repository.init();

await server.register(cors, {
  origin: true,
});

server.get('/api/health', async () => ({ status: 'ok' }));

await server.register(metaRoutes, { prefix: '/api/meta' });
await server.register(processCardRoutes, { prefix: '/api/process-cards' });

const distPath = path.join(process.cwd(), 'dist');
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

const port = Number(process.env.PORT ?? 3001);

server.listen({ port, host: '0.0.0.0' }).catch((error) => {
  console.error(error);
  process.exit(1);
});
