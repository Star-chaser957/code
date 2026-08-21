import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin, requireAuth } from '../auth';
import { repository } from '../db/repository';
import type {
  ApprovalActionRequest,
  BatchExportRequest,
  ProcessCardListFilters,
  ProcessCardPayload,
  ProcessCardRevisionRequest,
} from '../../shared/types';

export const processCardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const query = request.query as ProcessCardListFilters;
    return repository.listProcessCards(query, user);
  });

  fastify.get('/prefill', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const { customerCode = '', productName = '' } = request.query as {
      customerCode?: string;
      productName?: string;
    };
    return {
      items: await repository.findProcessCardPrefills({ customerCode, productName }),
    };
  });

  fastify.get('/workflow/next-task', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const { excludeId = '', step = 'approve' } = request.query as { excludeId?: string; step?: string };
    if (step !== 'review' && step !== 'approve') {
      reply.code(400);
      return { message: '不支持的流程步骤。' };
    }
    return repository.getNextPendingWorkflowTask(user, step, excludeId);
  });

  fastify.get('/:id/production-plan', async (request, reply) => {
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
    return { item: repository.getProductionPlanForCard(id) };
  });

  fastify.put('/:id/production-plan', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    const { productionPlanId = '' } = request.body as { productionPlanId?: string };
    return repository.linkProductionPlanToCard(id, productionPlanId, user);
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

  fastify.post('/:id/revisions', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    const payload = request.body as ProcessCardRevisionRequest;
    return repository.createRevision(id, payload, user, request.ip);
  });

  fastify.get('/:id/revision-diff', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    return repository.getRevisionDiff(id);
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

  fastify.post('/:id/void', async (request, reply) => {
    const user = await requireAdmin(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    return repository.voidProcessCard(id, user, request.ip);
  });

  fastify.delete('/:id/force', async (request, reply) => {
    const user = await requireAdmin(request, reply);
    if (!user) {
      return;
    }

    const { id } = request.params as { id: string };
    return repository.forceDeleteProcessCard(id, user, request.ip);
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
