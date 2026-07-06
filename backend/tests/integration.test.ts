import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, connectWebSocket, connectAuthenticatedWebSocket, waitForMessage, createTestFile } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests
  let profileId: string;
  let languageId: string;
  let grammarLessonId: string;
  let chatSessionId: string;
  let vocabCardId: string;

  // ============================================================================
  // PROFILES TESTS
  // ============================================================================

  test("Create profile", async () => {
    const res = await api("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: "Test User",
        main_language: "English",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.nickname).toBe("Test User");
    expect(data.main_language).toBe("English");
    expect(data.created_at).toBeDefined();
    expect(data.updated_at).toBeDefined();
    profileId = data.id;
  });

  test("Create profile with missing required field (nickname)", async () => {
    const res = await api("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        main_language: "English",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Get profile by ID", async () => {
    const res = await api(`/api/profiles/${profileId}`, {
      method: "GET",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(profileId);
    expect(data.nickname).toBe("Test User");
    expect(data.main_language).toBe("English");
  });

  test("Get profile by invalid ID format", async () => {
    const res = await api(`/api/profiles/invalid-uuid`, {
      method: "GET",
    });
    await expectStatus(res, 400);
  });

  test("Get profile with nonexistent UUID", async () => {
    const res = await api(`/api/profiles/00000000-0000-0000-0000-000000000000`, {
      method: "GET",
    });
    await expectStatus(res, 404);
  });

  test("Update profile", async () => {
    const res = await api(`/api/profiles/${profileId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: "Updated User",
        main_language: "Spanish",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(profileId);
    expect(data.nickname).toBe("Updated User");
    expect(data.main_language).toBe("Spanish");
  });

  test("Update profile with nonexistent ID", async () => {
    const res = await api(`/api/profiles/00000000-0000-0000-0000-000000000000`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: "Updated",
      }),
    });
    await expectStatus(res, 404);
  });

  // ============================================================================
  // LANGUAGE LEARNING TESTS
  // ============================================================================

  test("Add learning language to profile", async () => {
    const res = await api(`/api/profiles/${profileId}/languages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_language: "French",
        cefr_level: "A1",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.profile_id).toBe(profileId);
    expect(data.target_language).toBe("French");
    expect(data.cefr_level).toBe("A1");
    expect(data.is_active).toBeDefined();
    expect(data.created_at).toBeDefined();
    languageId = data.id;
  });

  test("Get learning languages for profile", async () => {
    const res = await api(`/api/profiles/${profileId}/languages`, {
      method: "GET",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.languages).toBeDefined();
    expect(Array.isArray(data.languages)).toBe(true);
    expect(data.languages.length).toBeGreaterThan(0);
    const frenchLang = data.languages.find((l: any) => l.target_language === "French");
    expect(frenchLang).toBeDefined();
  });

  test("Update learning language (change level)", async () => {
    const res = await api(`/api/languages/${languageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cefr_level: "B1",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(languageId);
    expect(data.cefr_level).toBe("B1");
  });

  test("Update learning language (toggle is_active)", async () => {
    const res = await api(`/api/languages/${languageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_active: false,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(languageId);
    expect(data.is_active).toBe(false);
  });

  test("Delete learning language", async () => {
    const res = await api(`/api/languages/${languageId}`, {
      method: "DELETE",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  // ============================================================================
  // CONFIG TESTS
  // ============================================================================

  test("Get all configuration", async () => {
    const res = await api("/api/config", {
      method: "GET",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.config).toBeDefined();
    expect(Array.isArray(data.config)).toBe(true);
  });

  test("Update or insert configuration value", async () => {
    const res = await api("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "test_key",
        value: "test_value",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.key).toBe("test_key");
    expect(data.value).toBe("test_value");
    expect(data.updated_at).toBeDefined();
  });

  test("Update configuration value", async () => {
    const res = await api("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "test_key",
        value: "updated_value",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.key).toBe("test_key");
    expect(data.value).toBe("updated_value");
  });

  // ============================================================================
  // GRAMMAR LESSONS TESTS
  // ============================================================================

  test("Get grammar lessons for profile and language", async () => {
    const res = await api(
      `/api/grammar/lessons?profile_id=${profileId}&target_language=French&cefr_level=A1`,
      {
        method: "GET",
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.lessons).toBeDefined();
    expect(Array.isArray(data.lessons)).toBe(true);
  });

  test("Generate grammar lesson with AI", async () => {
    const res = await api("/api/grammar/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: profileId,
        target_language: "French",
        cefr_level: "A1",
        main_language: "English",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.profile_id).toBe(profileId);
    expect(data.target_language).toBe("French");
    expect(data.cefr_level).toBe("A1");
    expect(data.title).toBeDefined();
    expect(data.explanation).toBeDefined();
    expect(data.examples).toBeDefined();
    expect(Array.isArray(data.examples)).toBe(true);
    expect(data.completed).toBe(false);
    expect(data.created_at).toBeDefined();
    grammarLessonId = data.id;
  });

  test("Mark grammar lesson as completed", async () => {
    const res = await api(`/api/grammar/lessons/${grammarLessonId}/complete`, {
      method: "POST",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(grammarLessonId);
    expect(data.completed).toBe(true);
  });

  // ============================================================================
  // CHAT SESSIONS TESTS
  // ============================================================================

  test("Get chat sessions for profile", async () => {
    const res = await api(`/api/chat/sessions?profile_id=${profileId}`, {
      method: "GET",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.sessions).toBeDefined();
    expect(Array.isArray(data.sessions)).toBe(true);
  });

  test("Create chat session with AI-generated scenario", async () => {
    const res = await api("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: profileId,
        target_language: "French",
        cefr_level: "A1",
        main_language: "English",
        feedback_mode: true,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.profile_id).toBe(profileId);
    expect(data.scenario).toBeDefined();
    expect(data.feedback_mode).toBe(true);
    expect(data.messages).toBeDefined();
    chatSessionId = data.id;
  });

  test("Get chat session with all messages", async () => {
    const res = await api(`/api/chat/sessions/${chatSessionId}`, {
      method: "GET",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(chatSessionId);
    expect(data.profile_id).toBe(profileId);
    expect(data.target_language).toBe("French");
    expect(data.cefr_level).toBe("A1");
    expect(data.scenario).toBeDefined();
    expect(data.feedback_mode).toBe(true);
    expect(data.created_at).toBeDefined();
    expect(data.messages).toBeDefined();
  });

  test("Update chat session settings (feedback_mode)", async () => {
    const res = await api(`/api/chat/sessions/${chatSessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedback_mode: false,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(chatSessionId);
    expect(data.feedback_mode).toBe(false);
  });

  test("Update chat session settings (difficulty_adjustment)", async () => {
    const res = await api(`/api/chat/sessions/${chatSessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        difficulty_adjustment: 2,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(chatSessionId);
    expect(data.difficulty_adjustment).toBe(2);
  });

  test("Send message to chat session", async () => {
    const res = await api(`/api/chat/sessions/${chatSessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Bonjour",
        main_language: "English",
        action: "none",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.user_message).toBeDefined();
    expect(data.ai_message).toBeDefined();
  });

  test("Send message with translate action", async () => {
    const res = await api(`/api/chat/sessions/${chatSessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Hello",
        main_language: "English",
        action: "translate",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.user_message).toBeDefined();
    expect(data.ai_message).toBeDefined();
  });

  // ============================================================================
  // VOCABULARY CARDS TESTS
  // ============================================================================

  test("Get vocabulary cards for profile and language", async () => {
    const res = await api(
      `/api/vocabulary/cards?profile_id=${profileId}&target_language=French&cefr_level=A1`,
      {
        method: "GET",
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.cards).toBeDefined();
    expect(Array.isArray(data.cards)).toBe(true);
  });

  test("Generate vocabulary cards with AI", async () => {
    const res = await api("/api/vocabulary/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: profileId,
        target_language: "French",
        cefr_level: "A1",
        main_language: "English",
        count: 5,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.cards).toBeDefined();
    expect(Array.isArray(data.cards)).toBe(true);
    if (data.cards.length > 0) {
      vocabCardId = data.cards[0].id;
    }
  });

  test("Update vocabulary card progress (known_forward)", async () => {
    if (!vocabCardId) {
      // Skip if no card was generated
      return;
    }
    const res = await api(`/api/vocabulary/cards/${vocabCardId}/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        known_forward: true,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(vocabCardId);
    expect(data.known_forward).toBe(true);
  });

  test("Update vocabulary card progress (known_backward)", async () => {
    if (!vocabCardId) {
      // Skip if no card was generated
      return;
    }
    const res = await api(`/api/vocabulary/cards/${vocabCardId}/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        known_backward: true,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(vocabCardId);
    expect(data.known_backward).toBe(true);
  });
});
