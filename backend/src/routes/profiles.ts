import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

export function register(app: App, fastify: FastifyInstance) {
  fastify.post(
    '/api/profiles',
    {
      schema: {
        description: 'Create a new profile',
        tags: ['profiles'],
        body: {
          type: 'object',
          required: ['nickname', 'main_language'],
          properties: {
            nickname: { type: 'string' },
            main_language: { type: 'string' },
          },
        },
        response: {
          201: {
            description: 'Profile created successfully',
            type: 'object',
            properties: {
              id: { type: 'string' },
              nickname: { type: 'string' },
              main_language: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { nickname: string; main_language: string } }>,
      reply: FastifyReply
    ) => {
      app.logger.info({ body: request.body }, 'Creating profile');
      const id = randomUUID();
      const now = new Date();
      const profile = {
        id,
        nickname: request.body.nickname,
        main_language: request.body.main_language,
        created_at: now,
        updated_at: now,
      };
      const [created] = await app.db.insert(schema.profiles).values(profile).returning();
      app.logger.info({ profileId: id }, 'Profile created successfully');
      return reply.status(201).send(created);
    }
  );

  fastify.get(
    '/api/profiles/:id',
    {
      schema: {
        description: 'Get profile by ID',
        tags: ['profiles'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              nickname: { type: 'string' },
              main_language: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      app.logger.info({ profileId: request.params.id }, 'Fetching profile');
      const profile = await app.db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, request.params.id))
        .limit(1);

      if (!profile || profile.length === 0) {
        app.logger.warn({ profileId: request.params.id }, 'Profile not found');
        return reply.status(404).send({ error: 'Profile not found' });
      }

      return profile[0];
    }
  );

  fastify.put(
    '/api/profiles/:id',
    {
      schema: {
        description: 'Update profile',
        tags: ['profiles'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            nickname: { type: 'string' },
            main_language: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              nickname: { type: 'string' },
              main_language: { type: 'string' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>,
      reply: FastifyReply
    ) => {
      app.logger.info(
        { profileId: request.params.id, body: request.body },
        'Updating profile'
      );
      const updates: Record<string, unknown> = { updated_at: new Date() };
      if (request.body.nickname) updates.nickname = request.body.nickname;
      if (request.body.main_language) updates.main_language = request.body.main_language;

      const result = await app.db
        .update(schema.profiles)
        .set(updates)
        .where(eq(schema.profiles.id, request.params.id))
        .returning();

      if (!result || result.length === 0) {
        app.logger.warn({ profileId: request.params.id }, 'Profile not found for update');
        return reply.status(404).send({ error: 'Profile not found' });
      }

      app.logger.info({ profileId: request.params.id }, 'Profile updated successfully');
      return result[0];
    }
  );

  fastify.get(
    '/api/profiles/:id/languages',
    {
      schema: {
        description: 'Get learning languages for profile',
        tags: ['profiles'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              languages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    profile_id: { type: 'string' },
                    target_language: { type: 'string' },
                    cefr_level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
                    is_active: { type: 'boolean' },
                    created_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      app.logger.info({ profileId: request.params.id }, 'Fetching learning languages');
      const languages = await app.db
        .select()
        .from(schema.learning_languages)
        .where(eq(schema.learning_languages.profile_id, request.params.id));

      return { languages };
    }
  );

  fastify.post(
    '/api/profiles/:id/languages',
    {
      schema: {
        description: 'Add learning language to profile',
        tags: ['profiles'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['target_language', 'cefr_level'],
          properties: {
            target_language: { type: 'string' },
            cefr_level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              profile_id: { type: 'string' },
              target_language: { type: 'string' },
              cefr_level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
              is_active: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { target_language: string; cefr_level: string };
      }>,
      reply: FastifyReply
    ) => {
      app.logger.info(
        { profileId: request.params.id, body: request.body },
        'Adding learning language'
      );
      const language = {
        id: randomUUID(),
        profile_id: request.params.id,
        target_language: request.body.target_language,
        cefr_level: request.body.cefr_level as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2',
        is_active: true,
        created_at: new Date(),
      };
      const [created] = await app.db.insert(schema.learning_languages).values(language).returning();
      app.logger.info(
        { languageId: created.id, profileId: request.params.id },
        'Learning language added'
      );
      return reply.status(201).send(created);
    }
  );

  fastify.put(
    '/api/languages/:lang_id',
    {
      schema: {
        description: 'Update learning language',
        tags: ['profiles'],
        params: {
          type: 'object',
          required: ['lang_id'],
          properties: {
            lang_id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            cefr_level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
            is_active: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              cefr_level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
              is_active: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { lang_id: string }; Body: Record<string, unknown> }>
    ) => {
      app.logger.info(
        { languageId: request.params.lang_id, body: request.body },
        'Updating learning language'
      );
      const updates: Record<string, unknown> = {};
      if (request.body.cefr_level) updates.cefr_level = request.body.cefr_level;
      if (request.body.is_active !== undefined) updates.is_active = request.body.is_active;

      const result = await app.db
        .update(schema.learning_languages)
        .set(updates)
        .where(eq(schema.learning_languages.id, request.params.lang_id))
        .returning();

      app.logger.info({ languageId: request.params.lang_id }, 'Learning language updated');
      return result[0];
    }
  );

  fastify.delete(
    '/api/languages/:lang_id',
    {
      schema: {
        description: 'Delete learning language',
        tags: ['profiles'],
        params: {
          type: 'object',
          required: ['lang_id'],
          properties: {
            lang_id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { lang_id: string } }>,
      reply: FastifyReply
    ) => {
      app.logger.info({ languageId: request.params.lang_id }, 'Deleting learning language');
      await app.db
        .delete(schema.learning_languages)
        .where(eq(schema.learning_languages.id, request.params.lang_id));

      app.logger.info({ languageId: request.params.lang_id }, 'Learning language deleted');
      return reply.send({ success: true });
    }
  );
}
