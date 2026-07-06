import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, MessageCircle } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { apiRequest, ChatSession } from '@/utils/api';
import { SUPPORTED_LANGUAGES } from '@/constants/languages';
import { AnimatedPressable } from '@/components/AnimatedPressable';

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonFlag} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonLine} />
        </View>
      </View>
    </Animated.View>
  );
}

function SessionCard({ session, index }: { session: ChatSession; index: number }) {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === session.target_language);
  const dateStr = session.created_at
    ? new Date(session.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
      <AnimatedPressable
        onPress={() => {
          console.log('[Chat] Session card pressed:', session.id);
          router.push(`/(tabs)/chat/${session.id}`);
        }}
        style={styles.sessionCard}
      >
        <View style={styles.sessionFlag}>
          <Text style={styles.flagText}>{lang?.flag ?? '🌐'}</Text>
        </View>
        <View style={styles.sessionInfo}>
          <View style={styles.sessionTopRow}>
            <Text style={styles.sessionLang}>{lang?.name ?? session.target_language}</Text>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{session.cefr_level}</Text>
            </View>
          </View>
          {session.scenario ? (
            <Text style={styles.sessionScenario} numberOfLines={1}>
              {session.scenario}
            </Text>
          ) : null}
          {dateStr ? <Text style={styles.sessionDate}>{dateStr}</Text> : null}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function ChatListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, activeLanguage } = useApp();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchSessions = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      console.log('[Chat] Fetching sessions for profile:', profile.id);
      const data = await apiRequest<{ sessions: ChatSession[] }>(`/api/chat/sessions?profile_id=${profile.id}`);
      setSessions(data.sessions);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load sessions';
      console.error('[Chat] Fetch error:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreate = async () => {
    if (!profile || !activeLanguage) return;
    console.log('[Chat] Create new session button pressed');
    setCreating(true);
    try {
      const session = await apiRequest<ChatSession>('/api/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({
          profile_id: profile.id,
          target_language: activeLanguage.target_language,
          cefr_level: activeLanguage.cefr_level,
        }),
      });
      console.log('[Chat] Session created:', session.id);
      router.push(`/(tabs)/chat/${session.id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create session';
      console.error('[Chat] Create error:', msg);
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat</Text>
      </View>

      {loading ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>Couldn't load chats</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <AnimatedPressable onPress={fetchSessions} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>Try again</Text>
          </AnimatedPressable>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <MessageCircle size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>Start your first conversation</Text>
          <Text style={styles.emptySubtitle}>
            Chat with your AI tutor and practice speaking naturally
          </Text>
          <AnimatedPressable onPress={handleCreate} disabled={creating} style={styles.emptyButton}>
            {creating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.emptyButtonText}>Start conversation</Text>
            )}
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <SessionCard session={item} index={index} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {!loading && sessions.length > 0 && (
        <AnimatedPressable
          onPress={handleCreate}
          disabled={creating}
          style={[styles.fab, { bottom: insets.bottom + 90 }]}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Plus size={24} color="#FFFFFF" />
          )}
        </AnimatedPressable>
      )}

      {/* Creating modal */}
      <Modal visible={creating} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.modalText}>Setting up your conversation…</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 120,
  },
  skeletonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  skeletonFlag: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceSecondary,
  },
  skeletonTitle: {
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.surfaceSecondary,
    width: '60%',
  },
  skeletonLine: {
    height: 11,
    borderRadius: 5.5,
    backgroundColor: COLORS.surfaceSecondary,
    width: '40%',
  },
  sessionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sessionFlag: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagText: {
    fontSize: 24,
  },
  sessionInfo: {
    flex: 1,
    gap: 4,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionLang: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  levelBadge: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sessionScenario: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  sessionDate: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 8,
    minWidth: 160,
    alignItems: 'center',
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    minWidth: 220,
  },
  modalText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
  },
});
