import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';
import { call_openrouter, strip_code_fences, get_active_model } from '../utils/openrouter.js';
import { LANGUAGE_NAMES, CEFR_DESCRIPTIONS } from '../utils/prompts.js';

export function register(app: App, fastify: FastifyInstance) {
  fastify.get(
    '/api/chat/sessions',
    {
      schema: {
        description: 'Get chat sessions for a profile',
        tags: ['chat'],
        querystring: {
          type: 'object',
          required: ['profile_id'],
          properties: {
            profile_id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              sessions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    profile_id: { type: 'string' },
                    target_language: { type: 'string' },
                    cefr_level: { type: 'string' },
                    scenario: { type: 'string' },
                    feedback_mode: { type: 'boolean' },
                    difficulty_adjustment: { type: 'integer' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { profile_id: string } }>) => {
      app.logger.info({ profileId: request.query.profile_id }, 'Fetching chat sessions');

      const sessions = await app.db
        .select()
        .from(schema.chat_sessions)
        .where(eq(schema.chat_sessions.profile_id, request.query.profile_id));

      sessions.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return { sessions };
    }
  );

  fastify.post(
    '/api/chat/sessions',
    {
      schema: {
        description: 'Create a new chat session with AI-generated scenario',
        tags: ['chat'],
        body: {
          type: 'object',
          required: ['profile_id', 'target_language', 'cefr_level', 'main_language'],
          properties: {
            profile_id: { type: 'string', format: 'uuid' },
            target_language: { type: 'string' },
            cefr_level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
            main_language: { type: 'string' },
            feedback_mode: { type: 'boolean' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              profile_id: { type: 'string' },
              scenario: { type: 'string' },
              feedback_mode: { type: 'boolean' },
              messages: { type: 'array' },
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
          feedback_mode?: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      app.logger.info({ body: request.body }, 'Creating chat session');

      try {
        const model = await get_active_model(app);

        const targetName = LANGUAGE_NAMES[request.body.target_language] || request.body.target_language;
        const mainName = LANGUAGE_NAMES[request.body.main_language] || request.body.main_language;
        const cefrDesc =
          CEFR_DESCRIPTIONS[request.body.cefr_level] || request.body.cefr_level;

        const systemMessage = `You are a friendly ${targetName} language tutor.
Create a short, engaging conversation scenario for a ${mainName} speaker at CEFR ${request.body.cefr_level} (${cefrDesc}).

The scenario should:
- Be realistic and practical (café, travel, shopping, work, social situations)
- Be appropriate for ${request.body.cefr_level} vocabulary and grammar
- Start the conversation naturally in ${targetName}
- Be welcoming and encouraging

Respond with ONLY valid JSON:
{
  "scenario_description": "brief scenario description in ${mainName}",
  "opening_message": "your opening message in ${targetName} (keep it appropriate for ${request.body.cefr_level})"
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
          return reply.status(500).send({ error: 'Failed to generate scenario' });
        }

        let cleanedResponse = strip_code_fences(aiResponse);
        let scenarioData: any;

        try {
          scenarioData = JSON.parse(cleanedResponse);
        } catch {
          app.logger.warn({ response: cleanedResponse }, 'First JSON parse failed, retrying');
          try {
            aiResponse = await call_openrouter(
              [{ role: 'user', content: systemMessage }],
              model,
              true
            );
            cleanedResponse = strip_code_fences(aiResponse);
            scenarioData = JSON.parse(cleanedResponse);
          } catch (error) {
            app.logger.error({ err: error, response: cleanedResponse }, 'JSON parsing failed');
            return reply.status(500).send({ error: 'AI response could not be parsed' });
          }
        }

        const sessionId = randomUUID();
        const now = new Date();
        const feedbackMode = request.body.feedback_mode !== false;

        const session = {
          id: sessionId,
          profile_id: request.body.profile_id,
          target_language: request.body.target_language,
          cefr_level: request.body.cefr_level as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2',
          scenario: scenarioData.scenario_description,
          feedback_mode: feedbackMode,
          difficulty_adjustment: 0,
          created_at: now,
          updated_at: now,
        };

        const [createdSession] = await app.db.insert(schema.chat_sessions).values(session).returning();

        const openingMessage = {
          id: randomUUID(),
          session_id: sessionId,
          role: 'assistant' as const,
          content: scenarioData.opening_message,
          is_correction: false,
          created_at: now,
        };

        const [createdMessage] = await app.db.insert(schema.chat_messages).values(openingMessage).returning();

        app.logger.info(
          { sessionId, profileId: request.body.profile_id },
          'Chat session created'
        );

        return reply.status(201).send({
          ...createdSession,
          messages: [createdMessage],
        });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, 'Error creating chat session');
        throw error;
      }
    }
  );

  fastify.get(
    '/api/chat/sessions/:id',
    {
      schema: {
        description: 'Get chat session with all messages',
        tags: ['chat'],
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
              profile_id: { type: 'string' },
              target_language: { type: 'string' },
              cefr_level: { type: 'string' },
              scenario: { type: 'string' },
              feedback_mode: { type: 'boolean' },
              difficulty_adjustment: { type: 'integer' },
              created_at: { type: 'string', format: 'date-time' },
              messages: { type: 'array' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      app.logger.info({ sessionId: request.params.id }, 'Fetching chat session');

      const session = await app.db
        .select()
        .from(schema.chat_sessions)
        .where(eq(schema.chat_sessions.id, request.params.id))
        .limit(1);

      if (!session || session.length === 0) {
        app.logger.warn({ sessionId: request.params.id }, 'Chat session not found');
        return reply.status(404).send({ error: 'Session not found' });
      }

      const messages = await app.db
        .select()
        .from(schema.chat_messages)
        .where(eq(schema.chat_messages.session_id, request.params.id));

      messages.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      return { ...session[0], messages };
    }
  );

  fastify.put(
    '/api/chat/sessions/:id',
    {
      schema: {
        description: 'Update chat session settings',
        tags: ['chat'],
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
            feedback_mode: { type: 'boolean' },
            difficulty_adjustment: { type: 'integer' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              feedback_mode: { type: 'boolean' },
              difficulty_adjustment: { type: 'integer' },
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
        { sessionId: request.params.id, body: request.body },
        'Updating chat session'
      );

      const updates: Record<string, unknown> = { updated_at: new Date() };
      if (request.body.feedback_mode !== undefined) updates.feedback_mode = request.body.feedback_mode;
      if (request.body.difficulty_adjustment !== undefined)
        updates.difficulty_adjustment = request.body.difficulty_adjustment;

      const result = await app.db
        .update(schema.chat_sessions)
        .set(updates)
        .where(eq(schema.chat_sessions.id, request.params.id))
        .returning();

      app.logger.info({ sessionId: request.params.id }, 'Chat session updated');
      return result[0];
    }
  );

  fastify.post(
    '/api/chat/sessions/:id/messages',
    {
      schema: {
        description: 'Send a message and get AI response',
        tags: ['chat'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['content', 'main_language'],
          properties: {
            content: { type: 'string' },
            main_language: { type: 'string' },
            action: { type: 'string', enum: ['explain', 'translate', 'simplify', 'none'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user_message: { type: 'object' },
              ai_message: { type: 'object' },
              correction_message: { type: ['object', 'null'] },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { content: string; main_language: string; action?: string };
      }>,
      reply: FastifyReply
    ) => {
      app.logger.info(
        { sessionId: request.params.id, action: request.body.action },
        'Processing chat message'
      );

      const session = await app.db
        .select()
        .from(schema.chat_sessions)
        .where(eq(schema.chat_sessions.id, request.params.id))
        .limit(1);

      if (!session || session.length === 0) {
        app.logger.warn({ sessionId: request.params.id }, 'Session not found');
        return reply.status(404).send({ error: 'Session not found' });
      }

      const sess = session[0];
      const model = await get_active_model(app);

      const userMessageId = randomUUID();
      const now = new Date();

      const userMessage = {
        id: userMessageId,
        session_id: request.params.id,
        role: 'user' as const,
        content: request.body.content,
        is_correction: false,
        created_at: now,
      };

      await app.db.insert(schema.chat_messages).values(userMessage);

      const allMessages = await app.db
        .select()
        .from(schema.chat_messages)
        .where(eq(schema.chat_messages.session_id, request.params.id));

      allMessages.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const targetName = LANGUAGE_NAMES[sess.target_language] || sess.target_language;
      const mainName = LANGUAGE_NAMES[request.body.main_language] || request.body.main_language;
      const cefrDesc = CEFR_DESCRIPTIONS[sess.cefr_level] || sess.cefr_level;

      const difficultyNote =
        sess.difficulty_adjustment > 0
          ? ` Use slightly more advanced vocabulary and grammar than standard ${sess.cefr_level}.`
          : sess.difficulty_adjustment < 0
            ? ` Use simpler vocabulary and shorter sentences than standard ${sess.cefr_level}.`
            : '';

      const feedbackInstruction = sess.feedback_mode
        ? `\nFEEDBACK MODE IS ON:\n- Before your conversational reply, give a brief correction or praise about the user's last message\n- Format: Start with '✓ [praise]' or '💡 [gentle correction]' on its own line, then a blank line, then your conversational reply\n- Keep corrections short, kind, and specific (1-2 sentences max)\n- If the message was perfect, just say '✓ Perfect!' or similar\n- Then continue the conversation naturally`
        : '';

      const systemMessage = `You are a friendly, encouraging ${targetName} language tutor having a conversation with a ${mainName} speaker.

Scenario: ${sess.scenario}
Student level: CEFR ${sess.cefr_level} (${cefrDesc})${difficultyNote}

Rules:
- Conduct the conversation primarily in ${targetName}
- Use vocabulary and grammar appropriate for ${sess.cefr_level} level
- Only use ${mainName} when explaining grammar or when the student is clearly confused
- Be supportive, patient, and encouraging
- Keep responses concise (2-4 sentences for conversation)
- Never make the student feel bad about mistakes${feedbackInstruction}

If the student asks for "explain", explain the last grammar point in ${mainName}.
If the student asks for "translate", translate the last ${targetName} message to ${mainName}.
If the student asks for "simplify", rephrase your last message more simply.`;

      const messageHistory: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemMessage },
      ];

      for (const msg of allMessages) {
        if (msg.role !== 'system') {
          messageHistory.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }

      let userContent = request.body.content;
      const action = request.body.action || 'none';
      if (action === 'explain') {
        userContent += ` [Please explain the grammar in ${mainName}]`;
      } else if (action === 'translate') {
        userContent += ` [Please translate your last message to ${mainName}]`;
      } else if (action === 'simplify') {
        userContent += ` [Please simplify your last message]`;
      }

      messageHistory.push({
        role: 'user',
        content: userContent,
      });

      try {
        // OpenRouter accepts system messages in the messages array
        const aiResponse = await call_openrouter(messageHistory, model, false);

        let aiMessageText = aiResponse;
        let correctionMessage: any = null;

        if (sess.feedback_mode && (aiResponse.startsWith('✓') || aiResponse.startsWith('💡'))) {
          const parts = aiResponse.split('\n\n');
          if (parts.length > 1) {
            const correctionText = parts[0];
            aiMessageText = parts.slice(1).join('\n\n').trim();

            const correctionId = randomUUID();
            correctionMessage = {
              id: correctionId,
              session_id: request.params.id,
              role: 'assistant' as const,
              content: correctionText,
              is_correction: true,
              created_at: new Date(),
            };

            await app.db.insert(schema.chat_messages).values(correctionMessage);
          }
        }

        const aiMessageId = randomUUID();
        const aiMessage = {
          id: aiMessageId,
          session_id: request.params.id,
          role: 'assistant' as const,
          content: aiMessageText,
          is_correction: false,
          created_at: new Date(),
        };

        await app.db.insert(schema.chat_messages).values(aiMessage);

        app.logger.info({ sessionId: request.params.id }, 'Chat message processed');

        return {
          user_message: userMessage,
          ai_message: aiMessage,
          correction_message: correctionMessage,
        };
      } catch (error) {
        app.logger.error({ err: error, sessionId: request.params.id }, 'Error getting AI response');
        throw error;
      }
    }
  );
}
