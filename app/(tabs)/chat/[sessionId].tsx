import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Send, Mic } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { apiRequest, ChatSession, ChatMessage } from '@/utils/api';
import { SUPPORTED_LANGUAGES } from '@/constants/languages';
import { AnimatedPressable } from '@/components/AnimatedPressable';

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: -6, duration: 300, delay, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );
    Animated.parallel([anim(dot1, 0), anim(dot2, 150), anim(dot3, 300)]).start();
  }, []);

  return (
    <View style={typingStyles.container}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={[typingStyles.dot, { transform: [{ translateY: dot }] }]} />
      ))}
    </View>
  );
}

const typingStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.textTertiary,
  },
});

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isCorrection = message.is_correction;

  const timeStr = message.created_at
    ? new Date(message.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';

  const prefix = isCorrection ? '💡 ' : '';
  const displayContent = prefix + message.content;

  if (isUser) {
    return (
      <View style={msgStyles.userRow}>
        <View style={msgStyles.userBubble}>
          <Text style={msgStyles.userText}>{message.content}</Text>
          {timeStr ? <Text style={msgStyles.userTime}>{timeStr}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={msgStyles.aiRow}>
      <View style={[msgStyles.aiBubble, isCorrection && msgStyles.correctionBubble]}>
        <Text style={[msgStyles.aiText, isCorrection && msgStyles.correctionText]}>
          {displayContent}
        </Text>
        {timeStr ? <Text style={msgStyles.aiTime}>{timeStr}</Text> : null}
      </View>
    </View>
  );
}

const msgStyles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '78%',
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 21,
  },
  userTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
  aiRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  aiBubble: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '78%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  correctionBubble: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  aiText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 21,
  },
  correctionText: {
    fontSize: 13,
    color: '#92400E',
  },
  aiTime: {
    color: COLORS.textTertiary,
    fontSize: 11,
    marginTop: 4,
  },
});

const QUICK_ACTIONS = ['Explain', 'Translate', 'Simplify'] as const;
type QuickAction = typeof QUICK_ACTIONS[number];

export default function ChatScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, activeLanguage } = useApp();

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [difficulty, setDifficulty] = useState(0);
  const [micTooltip, setMicTooltip] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      console.log('[Chat] Fetching session:', sessionId);
      const data = await apiRequest<ChatSession & { messages: ChatMessage[] }>(
        `/api/chat/sessions/${sessionId}`
      );
      setSession(data);
      setMessages(data.messages ?? []);
      setFeedbackMode(data.feedback_mode ?? false);
      setDifficulty(data.difficulty_adjustment ?? 0);
    } catch (e) {
      console.error('[Chat] Fetch session error:', e);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToEnd();
  }, [messages.length]);

  const sendMessage = async (content: string, action?: string) => {
    if (!content.trim() || !profile || !sessionId) return;
    console.log('[Chat] Send message pressed:', content.trim(), action ? `action: ${action}` : '');
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content: content.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSending(true);
    setIsTyping(true);
    scrollToEnd();

    try {
      const response = await apiRequest<{
        user_message: ChatMessage;
        ai_message: ChatMessage;
        correction_message: ChatMessage | null;
      }>(`/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: content.trim(),
          main_language: profile.main_language,
          action: action ?? 'none',
        }),
      });
      setIsTyping(false);
      const newMsgs = [
        response.user_message,
        ...(response.correction_message ? [response.correction_message] : []),
        response.ai_message,
      ];
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== userMsg.id);
        return [...filtered, ...newMsgs];
      });
      scrollToEnd();
    } catch (e) {
      console.error('[Chat] Send message error:', e);
      setIsTyping(false);
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    console.log('[Chat] Quick action pressed:', action);
    const content = inputText.trim() || action;
    sendMessage(content, action.toLowerCase());
  };

  const handleFeedbackToggle = async () => {
    const newVal = !feedbackMode;
    console.log('[Chat] Feedback toggle pressed, new value:', newVal);
    setFeedbackMode(newVal);
    try {
      await apiRequest(`/api/chat/sessions/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ feedback_mode: newVal }),
      });
    } catch (e) {
      console.error('[Chat] Feedback toggle error:', e);
      setFeedbackMode(!newVal);
    }
  };

  const handleDifficulty = async (delta: number) => {
    const newVal = Math.max(-2, Math.min(2, difficulty + delta));
    console.log('[Chat] Difficulty button pressed, new value:', newVal);
    setDifficulty(newVal);
    try {
      await apiRequest(`/api/chat/sessions/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ difficulty_adjustment: newVal }),
      });
    } catch (e) {
      console.error('[Chat] Difficulty update error:', e);
      setDifficulty(difficulty);
    }
  };

  const handleMicPress = () => {
    console.log('[Chat] Mic button pressed');
    setMicTooltip(true);
    setTimeout(() => setMicTooltip(false), 2500);
  };

  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === session?.target_language);
  const headerLabel = lang
    ? `${lang.flag} ${lang.name} · ${session?.cefr_level}`
    : '';

  const difficultyLabel = difficulty === 0 ? 'Normal' : difficulty > 0 ? `+${difficulty}` : `${difficulty}`;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <AnimatedPressable
            onPress={() => {
              console.log('[Chat] Back button pressed');
              router.back();
            }}
            style={styles.backBtn}
          >
            <ArrowLeft size={22} color={COLORS.text} />
          </AnimatedPressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLang}>{headerLabel}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={handleFeedbackToggle}
              style={[styles.feedbackPill, feedbackMode && styles.feedbackPillOn]}
            >
              <Text style={[styles.feedbackText, feedbackMode && styles.feedbackTextOn]}>
                {feedbackMode ? 'Feedback ON' : 'Feedback OFF'}
              </Text>
            </TouchableOpacity>
            <View style={styles.difficultyRow}>
              <TouchableOpacity
                onPress={() => handleDifficulty(-1)}
                disabled={difficulty <= -2}
                style={[styles.diffBtn, difficulty <= -2 && styles.diffBtnDisabled]}
              >
                <Text style={styles.diffBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.diffLabel}>{difficultyLabel}</Text>
              <TouchableOpacity
                onPress={() => handleDifficulty(1)}
                disabled={difficulty >= 2}
                style={[styles.diffBtn, difficulty >= 2 && styles.diffBtnDisabled]}
              >
                <Text style={styles.diffBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Messages */}
        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}
            ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          />
        )}

        {/* Input area */}
        <View style={[styles.inputArea, { paddingBottom: insets.bottom + 8 }]}>
          {/* Quick actions */}
          <View style={styles.quickActions}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action}
                onPress={() => handleQuickAction(action)}
                style={styles.quickBtn}
              >
                <Text style={styles.quickBtnText}>{action}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputRow}>
            <TouchableOpacity onPress={handleMicPress} style={styles.micBtn}>
              <Mic size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message…"
              placeholderTextColor={COLORS.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              returnKeyType="default"
            />
            <AnimatedPressable
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || sending}
              style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Send size={18} color="#FFFFFF" />
              )}
            </AnimatedPressable>
          </View>

          {micTooltip && (
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>Use the 🎤 on your keyboard to speak</Text>
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerLang: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  feedbackPillOn: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  feedbackText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  feedbackTextOn: {
    color: COLORS.primary,
  },
  difficultyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  diffBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  diffBtnDisabled: {
    opacity: 0.4,
  },
  diffBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 20,
  },
  diffLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    minWidth: 36,
    textAlign: 'center',
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  inputArea: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  tooltip: {
    backgroundColor: COLORS.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'center',
    marginBottom: 4,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});
