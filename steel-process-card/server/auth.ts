import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthUser } from '../shared/types';
import { repository } from './db/repository';

export function getBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = getBearerToken(request);

  if (!token) {
    reply.code(401).send({ message: '请先登录。' });
    return null;
  }

  const user = await repository.getAuthUserByToken(token);

  if (!user) {
    reply.code(401).send({ message: '登录状态已失效，请重新登录。' });
    return null;
  }

  return user;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = await requireAuth(request, reply);

  if (!user) {
    return null;
  }

  if (user.role !== 'admin') {
    reply.code(403).send({ message: '仅管理员可以编辑系统字典。' });
    return null;
  }

  return user;
}

export async function getOptionalAuthUser(request: FastifyRequest): Promise<AuthUser | null> {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  return repository.getAuthUserByToken(token);
}
