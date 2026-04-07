import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../auth';
import { repository } from '../db/repository';
import type {
  ApprovalActionRequest,
  BatchExportRequest,
  ProcessCardListFilters,
  ProcessCardPayload,
} from '../../shared/types';

export const processCardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const query = request.query as ProcessCardListFilters;
    return {
      items: await repository.listProcessCards(query, user),
    };
  });

  fastify.get('/prefill/by-product-name', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const { productName = '' } = request.query as { productName?: string };
    return {
      items: await repository.findProductPrefills(productName),
    };
  });

  fastify.get('/:id', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    const card = await repository.getProcessCard(id, user);

    if (!card) {
      reply.code(404);
      return { message: '工艺卡不存在。' };
    }

    return card;
  });

  fastify.post('/', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const payload = request.body as ProcessCardPayload;
    return repository.saveProcessCard(payload, user, request.ip);
  });

  fastify.put('/:id', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    const payload = request.body as ProcessCardPayload;
    return repository.saveProcessCard({ ...payload, id }, user, request.ip);
  });

  fastify.post('/:id/actions', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    const payload = request.body as ApprovalActionRequest;
    return repository.performApprovalAction(id, payload, user, request.ip);
  });

  fastify.delete('/:id', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    await repository.deleteProcessCard(id, user, request.ip);
    return { success: true };
  });

  fastify.post('/export/batch', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const payload = request.body as BatchExportRequest;
    return {
      items: await repository.buildBatchExport(payload),
    };
  });
};
