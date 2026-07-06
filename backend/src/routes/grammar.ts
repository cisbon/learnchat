import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';
import { call_openrouter, strip_code_fences, get_active_model } from '../utils/openrouter.js';
import { LANGUAGE_NAMES, CEFR_DESCRIPTIONS } from '../utils/prompts.js';

export function register(app: App, fastify: FastifyInstance) {
  fastify.get(
    '/api/grammar/lessons',
    {
      schema: {
        description: 'Get grammar lessons',
        tags: ['grammar'],
        querystring: {
          type: 'object',
          required: ['profile_id', 'target_language', 'cefr_level'],
          properties: {
            profile_id: { type: 'string', format: 'uuid' },
            target_language: { type: 'string' },
            cefr_level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              lessons: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    explanation: { type: 'string' },
                    examples: { type: 'array', items: { type: 'string' } },
                    exercises: { type: 'array' },
                    completed: { type: 'boolean' },
                    created_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: { profile_id: string; target_language: string; cefr_level: string };
      }>
    ) => {
      app.logger.info(
        {
          profileId: request.query.profile_id,
          targetLanguage: request.query.target_language,
          cefrLevel: request.query.cefr_level,
        },
        'Fetching grammar lessons'
      );

      const lessons = await app.db
        .select()
        .from(schema.grammar_lessons)
        .where(
          and(
            eq(schema.grammar_lessons.profile_id, request.query.profile_id),
            eq(schema.grammar_lessons.target_language, request.query.target_language),
            eq(schema.grammar_lessons.cefr_level, request.query.cefr_level as any)
          )
        );

      lessons.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return { lessons };
    }
  );

  fastify.post(
    '/api/grammar/lessons',
    {
      schema: {
        description: 'Generate a grammar lesson with AI',
        tags: ['grammar'],
        body: {
          type: 'object',
          required: ['profile_id', 'target_language', 'cefr_level', 'main_language'],
          properties: {
            profile_id: { type: 'string', format: 'uuid' },
            target_language: { type: 'string' },
            cefr_level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
            main_language: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              profile_id: { type: 'string' },
              target_language: { type: 'string' },
              cefr_level: { type: 'string' },
              title: { type: 'string' },
              explanation: { type: 'string' },
              examples: { type: 'array', items: { type: 'string' } },
              exercises: { type: 'array' },
              completed: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          500: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          profile_id: string;
          target_language: string;
          cefr_level: string;
          main_language: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      app.logger.info({ body: request.body }, 'Generating grammar lesson');

      try {
        const model = await get_active_model(app);

        const existingLessons = await app.db
          .select({ title: schema.grammar_lessons.title })
          .from(schema.grammar_lessons)
          .where(
            and(
              eq(schema.grammar_lessons.profile_id, request.body.profile_id),
              eq(schema.grammar_lessons.target_language, request.body.target_language),
              eq(schema.grammar_lessons.cefr_level, request.body.cefr_level as any)
            )
          );

        const existingTitles = existingLessons.map((l) => l.title);
        const avoid = existingTitles.length > 0 ? existingTitles.join(', ') : 'none';

        const targetName = LANGUAGE_NAMES[request.body.target_language] || request.body.target_language;
        const mainName = LANGUAGE_NAMES[request.body.main_language] || request.body.main_language;
        const cefrDesc =
          CEFR_DESCRIPTIONS[request.body.cefr_level] || request.body.cefr_level;

        const systemMessage = `You are an expert ${targetName} language teacher.
Generate a grammar lesson for a ${mainName} speaker learning ${targetName} at CEFR level ${request.body.cefr_level} (${cefrDesc}).

Rules:
- The lesson must be appropriate for ${request.body.cefr_level} level
- Explanation should be in ${mainName} for clarity
- Examples must be in ${targetName} with ${mainName} translations in parentheses
- Exercises should be fill-in-the-blank or short answer
- Do NOT repeat these already-covered topics: ${avoid}
- Be concise, supportive, and encouraging

Respond with ONLY valid JSON in this exact format:
{
  "title": "lesson title",
  "explanation": "clear grammar explanation in ${mainName}",
  "examples": ["example 1 (translation)", "example 2 (translation)", "example 3 (translation)"],
  "exercises": [
    {"question": "Fill in: ___ (hint)", "answer": "correct answer"},
    {"question": "Translate: ...", "answer": "correct answer"},
    {"question": "Choose: a) ... b) ...", "answer": "a) or b)"}
  ]
}`;

        let aiResponse: string;
        try {
          aiResponse = await call_openrouter(
            [{ role: 'user', content: systemMessage }],
            model,
            true
          );
        } catch (error) {
          app.logger.error({ err: error }, 'OpenRouter API call failed');
          return reply
            .status(500)
            .send({ error: 'Failed to generate lesson from AI' });
        }

        let cleanedResponse = strip_code_fences(aiResponse);
        let lessonData: any;

        try {
          lessonData = JSON.parse(cleanedResponse);
        } catch {
          app.logger.warn({ response: cleanedResponse }, 'First JSON parse failed, retrying');
          try {
            aiResponse = await call_openrouter(
              [{ role: 'user', content: systemMessage }],
              model,
              true
            );
            cleanedResponse = strip_code_fences(aiResponse);
            lessonData = JSON.parse(cleanedResponse);
          } catch (error) {
            app.logger.error({ err: error, response: cleanedResponse }, 'JSON parsing failed');
            return reply.status(500).send({ error: 'AI response could not be parsed' });
          }
        }

        const lesson = {
          id: randomUUID(),
          profile_id: request.body.profile_id,
          target_language: request.body.target_language,
          cefr_level: request.body.cefr_level as
            | 'A1'
            | 'A2'
            | 'B1'
            | 'B2'
            | 'C1'
            | 'C2',
          title: lessonData.title,
          explanation: lessonData.explanation,
          examples: lessonData.examples,
          exercises: lessonData.exercises,
          completed: false,
          created_at: new Date(),
        };

        const [created] = await app.db.insert(schema.grammar_lessons).values(lesson).returning();
        app.logger.info(
          { lessonId: lesson.id, profileId: request.body.profile_id },
          'Grammar lesson created'
        );

        return reply.status(201).send(created);
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, 'Error generating grammar lesson');
        throw error;
      }
    }
  );

  fastify.post(
    '/api/grammar/lessons/:id/complete',
    {
      schema: {
        description: 'Mark grammar lesson as completed',
        tags: ['grammar'],
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
              completed: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      app.logger.info({ lessonId: request.params.id }, 'Marking lesson as completed');
      const result = await app.db
        .update(schema.grammar_lessons)
        .set({ completed: true })
        .where(eq(schema.grammar_lessons.id, request.params.id))
        .returning();

      app.logger.info({ lessonId: request.params.id }, 'Lesson marked as completed');
      return result[0];
    }
  );
}
