import { createApplication } from "@specific-dev/framework";
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from './db/schema/schema.js';
import { register as registerProfilesRoutes } from './routes/profiles.js';
import { register as registerConfigRoutes } from './routes/config.js';
import { register as registerGrammarRoutes } from './routes/grammar.js';
import { register as registerChatRoutes } from './routes/chat.js';
import { register as registerVocabularyRoutes } from './routes/vocabulary.js';

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Register routes
registerProfilesRoutes(app, app.fastify);
registerConfigRoutes(app, app.fastify);
registerGrammarRoutes(app, app.fastify);
registerChatRoutes(app, app.fastify);
registerVocabularyRoutes(app, app.fastify);

// Seed AI config on startup
try {
  const existingConfig = await app.db
    .select()
    .from(schema.ai_config)
    .where(eq(schema.ai_config.key, 'active_model'))
    .limit(1);

  if (!existingConfig || existingConfig.length === 0) {
    app.logger.info('Seeding default active_model config');
    await app.db.insert(schema.ai_config).values({
      id: randomUUID(),
      key: 'active_model',
      value: 'google/gemini-2.0-flash-001',
      updated_at: new Date(),
    });
    app.logger.info('Config seeded successfully');
  }
} catch (error) {
  app.logger.error({ err: error }, 'Error seeding ai_config');
}

await app.run();
app.logger.info('Application running');
