import type { FastifyPluginAsync } from 'fastify';
import { repository } from '../db/repository';

export const metaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/operations', async () => ({
    items: await repository.getOperationDefinitions(),
  }));
};
