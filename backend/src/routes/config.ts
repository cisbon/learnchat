import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

export function register(app: App, fastify: FastifyInstance) {
  fastify.get(
    '/api/config',
    {
      schema: {
        description: 'Get all configuration',
        tags: ['config'],
        response: {
          200: {
            type: 'object',
            properties: {
              config: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    key: { type: 'string' },
                    value: { type: 'string' },
                    updated_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      app.logger.info('Fetching all configuration');
      const config = await app.db.select().from(schema.ai_config);
      return { config };
    }
  );

  fastify.put(
    '/api/config',
    {
      schema: {
        description: 'Update or insert configuration value',
        tags: ['config'],
        body: {
          type: 'object',
          required: ['key', 'value'],
          properties: {
            key: { type: 'string' },
            value: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              key: { type: 'string' },
              value: { type: 'string' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { key: string; value: string } }>) => {
      app.logger.info({ key: request.body.key }, 'Updating configuration');

      const existing = await app.db
        .select()
        .from(schema.ai_config)
        .where(eq(schema.ai_config.key, request.body.key))
        .limit(1);

      let result;
      if (existing && existing.length > 0) {
        result = await app.db
          .update(schema.ai_config)
          .set({
            value: request.body.value,
            updated_at: new Date(),
          })
          .where(eq(schema.ai_config.key, request.body.key))
          .returning();
        app.logger.info({ key: request.body.key }, 'Configuration updated');
      } else {
        const config = {
          id: randomUUID(),
          key: request.body.key,
          value: request.body.value,
          updated_at: new Date(),
        };
        await app.db.insert(schema.ai_config).values(config);
        result = [config];
        app.logger.info({ key: request.body.key }, 'Configuration inserted');
      }

      return result[0];
    }
  );
}
