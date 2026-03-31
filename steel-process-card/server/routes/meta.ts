import type { FastifyPluginAsync } from 'fastify';
import { repository } from '../db/repository';
import type { DepartmentOption } from '../../shared/types';

export const metaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/operations', async () => ({
    items: await repository.getOperationDefinitions(),
  }));

  fastify.get('/departments', async () => ({
    items: await repository.getDepartmentOptions(),
  }));

  fastify.put('/departments', async (request) => {
    const payload = request.body as DepartmentOption[];
    return {
      items: await repository.saveDepartmentOptions(payload),
    };
  });
};
