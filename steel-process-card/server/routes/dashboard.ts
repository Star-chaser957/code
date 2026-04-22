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

  fastify.get('/notifications', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    return repository.getNotificationOverview(user);
  });

  fastify.post('/notifications/:id/read', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    return repository.markNotificationRead(user, id);
  });

  fastify.post('/notifications/read-all', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    return repository.markAllNotificationsRead(user);
  });
};
