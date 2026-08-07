import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth';
import { appConfig } from '../config';
import { repository } from '../db/repository';
import type { AuthUser } from '../../shared/types';

const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);
const extensionByMimeType: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

function canManageProductionPlans(user: AuthUser) {
  return user.role === 'admin' || user.workflowRoles.includes('prepare');
}

function readUploadHeaders(request: FastifyRequest) {
  const rawName = request.headers['x-file-name'];
  const rawMimeType = request.headers['x-file-type'];
  const rawPlanNumber = request.headers['x-plan-number'];
  const encodedName = Array.isArray(rawName) ? rawName[0] : rawName || '';
  const originalName = path.basename(decodeURIComponent(encodedName));
  const mimeType = (Array.isArray(rawMimeType) ? rawMimeType[0] : rawMimeType || '').toLowerCase();
  const planNumber = decodeURIComponent(Array.isArray(rawPlanNumber) ? rawPlanNumber[0] : rawPlanNumber || '').trim();
  return { originalName, mimeType, planNumber };
}

export const productionPlanRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }
    const { keyword = '' } = request.query as { keyword?: string };
    return { items: repository.listProductionPlans(keyword) };
  });

  fastify.get('/match', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }
    const { planNumber = '' } = request.query as { planNumber?: string };
    return { item: repository.matchProductionPlan(planNumber) };
  });

  fastify.get('/:id/cards', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }
    const { id } = request.params as { id: string };
    return repository.getProductionPlanCardRelations(id);
  });

  fastify.get('/:id/content', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }
    const { id } = request.params as { id: string };
    const attachment = repository.getProductionPlanRecord(id);
    if (!attachment) {
      reply.code(404);
      return { message: '生产计划单附件不存在。' };
    }
    const filePath = path.join(appConfig.uploadDir, attachment.stored_name);
    try {
      await access(filePath);
    } catch {
      reply.code(404);
      return { message: '生产计划单原文件不存在，请联系管理员检查附件备份。' };
    }
    reply.header('Content-Type', attachment.mime_type);
    reply.header(
      'Content-Disposition',
      `inline; filename="production-plan${path.extname(attachment.original_name)}"; filename*=UTF-8''${encodeURIComponent(attachment.original_name)}`,
    );
    return reply.send(createReadStream(filePath));
  });

  const saveUpload = async (request: FastifyRequest, reply: FastifyReply, user: AuthUser, id: string) => {
    const { originalName, mimeType, planNumber } = readUploadHeaders(request);
    const body = request.body;
    if (!planNumber) {
      reply.code(400);
      return { message: '计划单号不能为空。' };
    }
    if (!originalName || !allowedTypes.has(mimeType)) {
      reply.code(400);
      return { message: '仅支持 PNG、JPG、WEBP 图片或 PDF 文件。' };
    }
    if (!Buffer.isBuffer(body) || body.length === 0) {
      reply.code(400);
      return { message: '上传文件为空。' };
    }

    const storedName = `${randomUUID()}${extensionByMimeType[mimeType]}`;
    await mkdir(appConfig.uploadDir, { recursive: true });
    await writeFile(path.join(appConfig.uploadDir, storedName), body);
    try {
      const saved = await repository.saveProductionPlanAttachment(
        { id, planNumber, originalName, storedName, mimeType, size: body.length },
        user,
        request.ip,
      );
      if (saved.previousStoredName && saved.previousStoredName !== storedName) {
        await rm(path.join(appConfig.uploadDir, saved.previousStoredName), { force: true });
      }
      return { item: saved.item };
    } catch (error) {
      await rm(path.join(appConfig.uploadDir, storedName), { force: true });
      throw error;
    }
  };

  fastify.post('/', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }
    if (!canManageProductionPlans(user)) {
      reply.code(403);
      return { message: '当前账号没有上传生产计划单附件的权限。' };
    }
    return saveUpload(request, reply, user, randomUUID());
  });

  fastify.put('/:id/file', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }
    if (!canManageProductionPlans(user)) {
      reply.code(403);
      return { message: '当前账号没有替换生产计划单附件的权限。' };
    }
    const { id } = request.params as { id: string };
    if (!repository.getProductionPlanRecord(id)) {
      reply.code(404);
      return { message: '生产计划单附件不存在。' };
    }
    return saveUpload(request, reply, user, id);
  });

  fastify.delete('/:id', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }
    if (!canManageProductionPlans(user)) {
      reply.code(403);
      return { message: '当前账号没有删除生产计划单附件的权限。' };
    }
    const { id } = request.params as { id: string };
    const result = await repository.deleteProductionPlanAttachment(id, user, request.ip);
    if (result.storedName) {
      await rm(path.join(appConfig.uploadDir, result.storedName), { force: true });
    }
    return { success: true };
  });
};
