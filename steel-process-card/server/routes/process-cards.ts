import type { FastifyPluginAsync } from 'fastify';
import { repository } from '../db/repository';
import type { BatchExportRequest, ProcessCardListFilters, ProcessCardPayload } from '../../shared/types';

export const processCardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    const query = request.query as ProcessCardListFilters;
    return {
      items: await repository.listProcessCards(query),
    };
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const card = await repository.getProcessCard(id);

    if (!card) {
      reply.code(404);
      return { message: '工艺卡不存在。' };
    }

    return card;
  });

  fastify.post('/', async (request) => {
    const payload = request.body as ProcessCardPayload;
    return repository.saveProcessCard(payload);
  });

  fastify.put('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const payload = request.body as ProcessCardPayload;
    return repository.saveProcessCard({ ...payload, id });
  });

  fastify.delete('/:id', async (request) => {
    const { id } = request.params as { id: string };
    await repository.deleteProcessCard(id);
    return { success: true };
  });

  fastify.post('/export/batch', async (request) => {
    const payload = request.body as BatchExportRequest;
    return {
      items: await repository.buildBatchExport(payload),
    };
  });
};
