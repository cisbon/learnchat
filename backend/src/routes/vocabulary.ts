import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';
import { call_openrouter, strip_code_fences, get_active_model } from '../utils/openrouter.js';
import { LANGUAGE_NAMES, CEFR_DESCRIPTIONS } from '../utils/prompts.js';

export function register(app: App, fastify: FastifyInstance) {
  fastify.get(
    '/api/vocabulary/cards',
    {
      schema: {
        description: 'Get vocabulary cards',
        tags: ['vocabulary'],
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
              cards: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    word: { type: 'string' },
                    translation: { type: 'string' },
                    example_sentence: { type: 'string' },
                    pronunciation_hint: { type: ['string', 'null'] },
                    known_forward: { type: 'boolean' },
                    known_backward: { type: 'boolean' },
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
        'Fetching vocabulary cards'
      );

      const cards = await app.db
        .select()
        .from(schema.vocabulary_cards)
        .where(
          and(
            eq(schema.vocabulary_cards.profile_id, request.query.profile_id),
            eq(schema.vocabulary_cards.target_language, request.query.target_language),
            eq(schema.vocabulary_cards.cefr_level, request.query.cefr_level as any)
          )
        );

      cards.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return { cards };
    }
  );

  fastify.post(
    '/api/vocabulary/cards',
    {
      schema: {
        description: 'Generate vocabulary cards with AI',
        tags: ['vocabulary'],
        body: {
          type: 'object',
          required: ['profile_id', 'target_language', 'cefr_level', 'main_language'],
          properties: {
            profile_id: { type: 'string', format: 'uuid' },
            target_language: { type: 'string' },
            cefr_level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
            main_language: { type: 'string' },
            count: { type: 'integer', default: 10 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              cards: { type: 'array' },
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
          count?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      app.logger.info({ body: request.body }, 'Generating vocabulary cards');

      try {
        const model = await get_active_model(app);
        const count = request.body.count || 10;

        const existingCards = await app.db
          .select({ word: schema.vocabulary_cards.word })
          .from(schema.vocabulary_cards)
          .where(
            and(
              eq(schema.vocabulary_cards.profile_id, request.body.profile_id),
              eq(schema.vocabulary_cards.target_language, request.body.target_language),
              eq(schema.vocabulary_cards.cefr_level, request.body.cefr_level as any)
            )
          );

        const existingWords = existingCards.map((c) => c.word);
        const avoid =
          existingWords.length > 0
            ? existingWords.slice(0, 50).join(', ')
            : 'none';

        const targetName = LANGUAGE_NAMES[request.body.target_language] || request.body.target_language;
        const mainName = LANGUAGE_NAMES[request.body.main_language] || request.body.main_language;
        const cefrDesc = CEFR_DESCRIPTIONS[request.body.cefr_level] || request.body.cefr_level;

        const systemMessage = `You are an expert ${targetName} language teacher.
Generate ${count} vocabulary flashcards for a ${mainName} speaker learning ${targetName} at CEFR ${request.body.cefr_level} (${cefrDesc}).

Rules:
- Words must be appropriate and useful for ${request.body.cefr_level} level
- Include a mix of nouns, verbs, adjectives, and common phrases
- Example sentences must be in ${targetName} at ${request.body.cefr_level} level
- Translations must be in ${mainName}
- Do NOT include these already-known words: ${avoid}
- For pronunciation hints: use simple phonetic spelling only when helpful (especially for ${targetName} if it has non-Latin script or tricky pronunciation)

Respond with ONLY valid JSON array:
[
  {
    "word": "word in ${targetName}",
    "translation": "translation in ${mainName}",
    "example_sentence": "example sentence in ${targetName}",
    "pronunciation_hint": "optional phonetic hint or null"
  }
]`;

        let aiResponse: string;
        try {
          aiResponse = await call_openrouter(
            [{ role: 'user', content: systemMessage }],
            model,
            false
          );
        } catch (error) {
          app.logger.error({ err: error }, 'OpenRouter API call failed');
          return reply.status(500).send({ error: 'Failed to generate vocabulary' });
        }

        let cleanedResponse = strip_code_fences(aiResponse);
        let cardsData: any;

        try {
          cardsData = JSON.parse(cleanedResponse);
        } catch {
          app.logger.warn({ response: cleanedResponse }, 'First JSON parse failed, retrying');
          try {
            aiResponse = await call_openrouter(
              [{ role: 'user', content: systemMessage }],
              model,
              false
            );
            cleanedResponse = strip_code_fences(aiResponse);
            cardsData = JSON.parse(cleanedResponse);
          } catch (error) {
            app.logger.error({ err: error, response: cleanedResponse }, 'JSON parsing failed');
            return reply.status(500).send({ error: 'AI response could not be parsed' });
          }
        }

        if (!Array.isArray(cardsData)) {
          app.logger.error(
            { response: cleanedResponse },
            'AI response is not an array'
          );
          return reply.status(500).send({ error: 'AI response could not be parsed' });
        }

        const now = new Date();
        const cards = cardsData.map((card: any) => ({
          id: randomUUID(),
          profile_id: request.body.profile_id,
          target_language: request.body.target_language,
          cefr_level: request.body.cefr_level as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2',
          word: card.word,
          translation: card.translation,
          example_sentence: card.example_sentence,
          pronunciation_hint: card.pronunciation_hint || null,
          known_forward: false,
          known_backward: false,
          created_at: now,
        }));

        const insertedCards = await app.db.insert(schema.vocabulary_cards).values(cards).returning();

        app.logger.info(
          { count: insertedCards.length, profileId: request.body.profile_id },
          'Vocabulary cards created'
        );

        return reply.status(201).send({ cards: insertedCards });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, 'Error generating vocabulary cards');
        throw error;
      }
    }
  );

  fastify.put(
    '/api/vocabulary/cards/:id/progress',
    {
      schema: {
        description: 'Update vocabulary card progress',
        tags: ['vocabulary'],
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
            known_forward: { type: 'boolean' },
            known_backward: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              known_forward: { type: 'boolean' },
              known_backward: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: Record<string, unknown>;
      }>
    ) => {
      app.logger.info(
        { cardId: request.params.id, body: request.body },
        'Updating card progress'
      );

      const updates: Record<string, unknown> = {};
      if (request.body.known_forward !== undefined) updates.known_forward = request.body.known_forward;
      if (request.body.known_backward !== undefined) updates.known_backward = request.body.known_backward;

      const result = await app.db
        .update(schema.vocabulary_cards)
        .set(updates)
        .where(eq(schema.vocabulary_cards.id, request.params.id))
        .returning();

      app.logger.info({ cardId: request.params.id }, 'Card progress updated');
      return result[0];
    }
  );
}
