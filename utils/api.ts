const BASE_URL = 'https://fyk4emwnn3vnk56khgzqzq2fx5cs2xr9.app.specular.dev';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  console.log(`[API] ${options.method || 'GET'} ${path}`, options.body ? JSON.parse(options.body as string) : '');
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const error = await res.text();
    console.error(`[API] Error ${res.status} for ${path}:`, error);
    throw new Error(error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  console.log(`[API] Response ${path}:`, data);
  return data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  nickname: string;
  main_language: string;
  created_at?: string;
}

export interface LearningLanguage {
  id: string;
  profile_id: string;
  target_language: string;
  cefr_level: string;
  created_at?: string;
}

export interface GrammarLesson {
  id: string;
  profile_id: string;
  target_language: string;
  cefr_level: string;
  title: string;
  explanation: string;
  examples: string[];
  exercises: { question: string; answer: string }[];
  completed: boolean;
  created_at?: string;
}

export interface ChatSession {
  id: string;
  profile_id: string;
  target_language: string;
  cefr_level: string;
  scenario?: string;
  feedback_mode: boolean;
  difficulty_adjustment: number;
  created_at?: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  is_correction?: boolean;
  created_at?: string;
}

export interface VocabularyCard {
  id: string;
  profile_id: string;
  target_language: string;
  cefr_level: string;
  word: string;
  translation: string;
  pronunciation?: string;
  example_sentence?: string;
  known: boolean;
  created_at?: string;
}

export interface AppConfig {
  key: string;
  value: string;
}
