import type { FastifyPluginAsync } from 'fastify';
import { repository } from '../db/repository';
import { requireAdmin, requireAuth } from '../auth';
import type { DepartmentOption } from '../../shared/types';

export const metaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/operations', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    return {
      items: await repository.getOperationDefinitions(),
    };
  });

  fastify.get('/departments', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    return {
      items: await repository.getDepartmentOptions(),
    };
  });

  fastify.put('/departments', async (request, reply) => {
    const user = await requireAdmin(request, reply);
    if (!user) {
      return;
    }

    const payload = request.body as DepartmentOption[];
    return {
      items: await repository.saveDepartmentOptions(payload),
    };
  });
};
