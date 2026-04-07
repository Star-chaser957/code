import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../auth';
import { repository } from '../db/repository';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/overview', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    return repository.getDashboardOverview(user);
  });
};
