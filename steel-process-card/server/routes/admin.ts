import type { FastifyPluginAsync } from 'fastify';
import type {
  AuditLogFilters,
  UserAccountCreateRequest,
  UserAccountUpdateRequest,
  UserPasswordResetRequest,
} from '../../shared/types';
import { requireAdmin } from '../auth';
import { repository } from '../db/repository';

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/users', async (request, reply) => {
    const user = await requireAdmin(request, reply);
    if (!user) {
      return;
    }

    return {
      items: await repository.getUserAccounts(),
    };
  });

  fastify.post('/users', async (request, reply) => {
    const user = await requireAdmin(request, reply);
    if (!user) {
      return;
    }

    const payload = request.body as UserAccountCreateRequest;
    return {
      items: await repository.createUserAccount(payload, user, request.ip),
    };
  });

  fastify.put('/users/:id', async (request, reply) => {
    const user = await requireAdmin(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    const payload = request.body as UserAccountUpdateRequest;
    return {
      items: await repository.updateUserAccount(id, payload, user, request.ip),
    };
  });

  fastify.post('/users/:id/reset-password', async (request, reply) => {
    const user = await requireAdmin(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    const payload = request.body as UserPasswordResetRequest;
    return repository.resetUserPassword(id, payload, user, request.ip);
  });

  fastify.patch('/users/:id/active', async (request, reply) => {
    const user = await requireAdmin(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    const { isActive = true } = request.body as { isActive?: boolean };
    return {
      items: await repository.setUserActive(id, isActive, user, request.ip),
    };
  });

  fastify.delete('/users/:id', async (request, reply) => {
    const user = await requireAdmin(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    return {
      items: await repository.deleteUserAccount(id, user, request.ip),
    };
  });

  fastify.get('/audit-logs', async (request, reply) => {
    const user = await requireAdmin(request, reply);
    if (!user) {
      return;
    }

    const query = request.query as AuditLogFilters;
    return {
      items: await repository.listAuditLogs(query),
    };
  });
};
