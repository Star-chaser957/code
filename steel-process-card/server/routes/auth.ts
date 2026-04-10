import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import type { LoginRequest } from '../../shared/types';
import { getBearerToken, requireAuth } from '../auth';
import { repository } from '../db/repository';

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/login', async (request, reply) => {
    const payload = loginSchema.parse(request.body as LoginRequest);

    try {
      const session = await repository.login(payload.username, payload.password, request.ip);

      if (!session) {
        reply.code(401);
        return { message: '账号或密码错误，请重新输入。' };
      }

      return session;
    } catch (error) {
      reply.code(401);
      return {
        message: error instanceof Error ? error.message : '登录失败，请稍后再试。',
      };
    }
  });

  fastify.get('/me', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    return { user };
  });

  fastify.post('/logout', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const token = getBearerToken(request);
    if (token) {
      await repository.logout(token, user, request.ip);
    }

    return { success: true };
  });
};
