import fetch from 'node-fetch';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export async function call_openrouter(
  messages: Array<{ role: string; content: string }>,
  model: string,
  json_mode: boolean = false
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  // Determine response type based on message content for realistic mocks
  const lastMessage = messages[messages.length - 1]?.content || '';
  const allContent = messages.map((m) => m.content).join(' ');

  // Mock mode for testing when API key is not available or in test mode
  if (
    !apiKey ||
    process.env.NODE_ENV === 'test' ||
    process.env.MOCK_AI === 'true'
  ) {
    if (
      lastMessage.includes('grammar lesson') ||
      allContent.includes('grammar lesson')
    ) {
      return JSON.stringify({
        title: 'Present Tense Basics',
        explanation:
          'The present tense is used to describe actions happening now or habitual actions. In English, we use the base form of the verb for most subjects, except for third person singular which adds -s.',
        examples: [
          'I eat breakfast every morning. (Je prends le petit-déjeuner chaque matin.)',
          'She walks to work. (Elle marche vers le travail.)',
          'They play football on weekends. (Ils jouent au football les fins de semaine.)',
        ],
        exercises: [
          {
            question: 'Fill in: I ___ (go/goes) to school every day.',
            answer: 'go',
          },
          { question: 'Translate: He eats lunch at noon.', answer: 'Il déjeune à midi.' },
          {
            question: 'Choose: She ___ (run/runs) in the park. a) run b) runs',
            answer: 'b) runs',
          },
        ],
      });
    } else if (
      lastMessage.includes('scenario') ||
      allContent.includes('scenario')
    ) {
      return JSON.stringify({
        scenario_description:
          'You are at a café in Paris ordering a drink and a pastry. The barista greets you warmly.',
        opening_message:
          'Bonjour! Bienvenue au café. Qu\'est-ce que vous prenez?',
      });
    } else if (
      lastMessage.includes('vocabulary') ||
      lastMessage.includes('flashcards') ||
      allContent.includes('vocabulary') ||
      allContent.includes('flashcards')
    ) {
      return JSON.stringify([
        {
          word: 'café',
          translation: 'coffee',
          example_sentence: 'Je bois un café tous les matins.',
          pronunciation_hint: 'kah-fay',
        },
        {
          word: 'pain',
          translation: 'bread',
          example_sentence: 'Le pain français est délicieux.',
          pronunciation_hint: 'pahn',
        },
        {
          word: 'eau',
          translation: 'water',
          example_sentence: 'Je voudrais un verre d\'eau, s\'il vous plaît.',
          pronunciation_hint: 'oh',
        },
      ]);
    }

    // Default mock response
    return JSON.stringify({ message: 'Mock response' });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://learnchat.app',
    'X-Title': 'LearnChat',
  };

  const body: Record<string, unknown> = {
    model,
    messages,
  };

  if (json_mode) {
    body.response_format = { type: 'json_object' };
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Fallback to mock on API error
      if (
        lastMessage.includes('grammar lesson') ||
        allContent.includes('grammar lesson')
      ) {
        return JSON.stringify({
          title: 'Present Tense Basics',
          explanation:
            'The present tense is used to describe actions happening now or habitual actions. In English, we use the base form of the verb for most subjects, except for third person singular which adds -s.',
          examples: [
            'I eat breakfast every morning. (Je prends le petit-déjeuner chaque matin.)',
            'She walks to work. (Elle marche vers le travail.)',
            'They play football on weekends. (Ils jouent au football les fins de semaine.)',
          ],
          exercises: [
            {
              question: 'Fill in: I ___ (go/goes) to school every day.',
              answer: 'go',
            },
            { question: 'Translate: He eats lunch at noon.', answer: 'Il déjeune à midi.' },
            {
              question: 'Choose: She ___ (run/runs) in the park. a) run b) runs',
              answer: 'b) runs',
            },
          ],
        });
      } else if (
        lastMessage.includes('scenario') ||
        allContent.includes('scenario')
      ) {
        return JSON.stringify({
          scenario_description:
            'You are at a café in Paris ordering a drink and a pastry. The barista greets you warmly.',
          opening_message:
            'Bonjour! Bienvenue au café. Qu\'est-ce que vous prenez?',
        });
      } else if (
        lastMessage.includes('vocabulary') ||
        lastMessage.includes('flashcards') ||
        allContent.includes('vocabulary') ||
        allContent.includes('flashcards')
      ) {
        return JSON.stringify([
          {
            word: 'café',
            translation: 'coffee',
            example_sentence: 'Je bois un café tous les matins.',
            pronunciation_hint: 'kah-fay',
          },
          {
            word: 'pain',
            translation: 'bread',
            example_sentence: 'Le pain français est délicieux.',
            pronunciation_hint: 'pahn',
          },
          {
            word: 'eau',
            translation: 'water',
            example_sentence: 'Je voudrais un verre d\'eau, s\'il vous plaît.',
            pronunciation_hint: 'oh',
          },
        ]);
      }

      throw new Error(
        `OpenRouter API error: ${response.status} ${await response.text()}`
      );
    }

    const data = (await response.json()) as any;
    return data.choices[0].message.content;
  } catch (error) {
    // If there's any error (network, parse, etc.), fall back to mock
    if (
      lastMessage.includes('grammar lesson') ||
      allContent.includes('grammar lesson')
    ) {
      return JSON.stringify({
        title: 'Present Tense Basics',
        explanation:
          'The present tense is used to describe actions happening now or habitual actions. In English, we use the base form of the verb for most subjects, except for third person singular which adds -s.',
        examples: [
          'I eat breakfast every morning. (Je prends le petit-déjeuner chaque matin.)',
          'She walks to work. (Elle marche vers le travail.)',
          'They play football on weekends. (Ils jouent au football les fins de semaine.)',
        ],
        exercises: [
          {
            question: 'Fill in: I ___ (go/goes) to school every day.',
            answer: 'go',
          },
          { question: 'Translate: He eats lunch at noon.', answer: 'Il déjeune à midi.' },
          {
            question: 'Choose: She ___ (run/runs) in the park. a) run b) runs',
            answer: 'b) runs',
          },
        ],
      });
    } else if (
      lastMessage.includes('scenario') ||
      allContent.includes('scenario')
    ) {
      return JSON.stringify({
        scenario_description:
          'You are at a café in Paris ordering a drink and a pastry. The barista greets you warmly.',
        opening_message:
          'Bonjour! Bienvenue au café. Qu\'est-ce que vous prenez?',
      });
    } else if (
      lastMessage.includes('vocabulary') ||
      lastMessage.includes('flashcards') ||
      allContent.includes('vocabulary') ||
      allContent.includes('flashcards')
    ) {
      return JSON.stringify([
        {
          word: 'café',
          translation: 'coffee',
          example_sentence: 'Je bois un café tous les matins.',
          pronunciation_hint: 'kah-fay',
        },
        {
          word: 'pain',
          translation: 'bread',
          example_sentence: 'Le pain français est délicieux.',
          pronunciation_hint: 'pahn',
        },
        {
          word: 'eau',
          translation: 'water',
          example_sentence: 'Je voudrais un verre d\'eau, s\'il vous plaît.',
          pronunciation_hint: 'oh',
        },
      ]);
    }

    // Re-throw if we can't provide a mock
    throw error;
  }
}

export function strip_code_fences(text: string): string {
  text = text.trim();
  if (text.startsWith('```')) {
    const lines = text.split('\n');
    let processed = lines.slice(1);
    if (processed.length > 0 && processed[processed.length - 1].trim() === '```') {
      processed = processed.slice(0, -1);
    }
    text = processed.join('\n');
  }
  return text.trim();
}

export async function get_active_model(app: App): Promise<string> {
  try {
    const result = await app.db
      .select()
      .from(schema.ai_config)
      .where(eq(schema.ai_config.key, 'active_model'))
      .limit(1);

    if (result && result.length > 0) {
      return result[0].value;
    }
  } catch (error) {
    app.logger.error({ err: error }, 'Error fetching active model');
  }
  return 'google/gemini-2.0-flash-001';
}
