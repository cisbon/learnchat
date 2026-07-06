import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const cefrLevelEnum = pgEnum('cefr_level', ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  nickname: text('nickname').notNull(),
  main_language: text('main_language').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const learning_languages = pgTable('learning_languages', {
  id: text('id').primaryKey(),
  profile_id: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  target_language: text('target_language').notNull(),
  cefr_level: cefrLevelEnum('cefr_level').notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ai_config = pgTable(
  'ai_config',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull().unique(),
    value: text('value').notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('ai_config_key_idx').on(table.key)]
);

export const grammar_lessons = pgTable('grammar_lessons', {
  id: text('id').primaryKey(),
  profile_id: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  target_language: text('target_language').notNull(),
  cefr_level: cefrLevelEnum('cefr_level').notNull(),
  title: text('title').notNull(),
  explanation: text('explanation').notNull(),
  examples: jsonb('examples').notNull().$type<string[]>(),
  exercises: jsonb('exercises').notNull().$type<Array<{ question: string; answer: string }>>(),
  completed: boolean('completed').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chat_sessions = pgTable('chat_sessions', {
  id: text('id').primaryKey(),
  profile_id: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  target_language: text('target_language').notNull(),
  cefr_level: cefrLevelEnum('cefr_level').notNull(),
  scenario: text('scenario').notNull(),
  feedback_mode: boolean('feedback_mode').default(true).notNull(),
  difficulty_adjustment: integer('difficulty_adjustment').default(0).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chat_messages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  session_id: text('session_id')
    .notNull()
    .references(() => chat_sessions.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  is_correction: boolean('is_correction').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const vocabulary_cards = pgTable('vocabulary_cards', {
  id: text('id').primaryKey(),
  profile_id: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  target_language: text('target_language').notNull(),
  cefr_level: cefrLevelEnum('cefr_level').notNull(),
  word: text('word').notNull(),
  translation: text('translation').notNull(),
  example_sentence: text('example_sentence').notNull(),
  pronunciation_hint: text('pronunciation_hint'),
  known_forward: boolean('known_forward').default(false).notNull(),
  known_backward: boolean('known_backward').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
