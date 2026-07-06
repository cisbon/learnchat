import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Plus, ChevronDown, ChevronUp, CheckCircle, BookOpen } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { apiRequest, GrammarLesson } from '@/utils/api';
import { SUPPORTED_LANGUAGES } from '@/constants/languages';
import { AnimatedPressable } from '@/components/AnimatedPressable';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonLine} />
    </Animated.View>
  );
}

function LessonCard({
  lesson,
  index,
  onMarkComplete,
}: {
  lesson: GrammarLesson;
  index: number;
  onMarkComplete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleToggle = () => {
    console.log('[Grammar] Lesson card toggled:', lesson.title, 'expanded:', !expanded);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  const handleMarkComplete = async () => {
    console.log('[Grammar] Mark complete pressed for lesson:', lesson.id);
    setCompleting(true);
    try {
      await apiRequest(`/api/grammar/lessons/${lesson.id}/complete`, { method: 'POST' });
      onMarkComplete(lesson.id);
    } catch (e) {
      console.error('[Grammar] Mark complete error:', e);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
      <View style={[styles.lessonCard, lesson.completed && styles.lessonCardCompleted]}>
        <TouchableOpacity onPress={handleToggle} activeOpacity={0.8} style={styles.lessonHeader}>
          <View style={styles.lessonHeaderLeft}>
            {lesson.completed ? (
              <CheckCircle size={20} color={COLORS.success} />
            ) : (
              <View style={styles.lessonDot} />
            )}
            <Text style={styles.lessonTitle} numberOfLines={expanded ? undefined : 1}>
              {lesson.title}
            </Text>
          </View>
          {expanded ? (
            <ChevronUp size={18} color={COLORS.textSecondary} />
          ) : (
            <ChevronDown size={18} color={COLORS.textSecondary} />
          )}
        </TouchableOpacity>

        {expanded && (
          <View style={styles.lessonBody}>
            <View style={styles.explanationBox}>
              <Text style={styles.sectionLabel}>Explanation</Text>
              <Text style={styles.explanationText}>{lesson.explanation}</Text>
            </View>

            {lesson.examples && lesson.examples.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Examples</Text>
                {lesson.examples.map((ex, i) => (
                  <View key={i} style={styles.exampleRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.exampleText}>{ex}</Text>
                  </View>
                ))}
              </View>
            )}

            {lesson.exercises && lesson.exercises.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Exercises</Text>
                {lesson.exercises.map((ex, i) => (
                  <ExerciseItem key={i} index={i} question={ex.question} answer={ex.answer} />
                ))}
              </View>
            )}

            {!lesson.completed && (
              <AnimatedPressable
                onPress={handleMarkComplete}
                disabled={completing}
                style={styles.completeButton}
              >
                {completing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.completeButtonText}>Mark as complete</Text>
                )}
              </AnimatedPressable>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function ExerciseItem({ index, question, answer }: { index: number; question: string; answer: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={styles.exerciseItem}>
      <Text style={styles.exerciseQ}>
        {index + 1}. {question}
      </Text>
      {revealed ? (
        <Text style={styles.exerciseA}>{answer}</Text>
      ) : (
        <TouchableOpacity onPress={() => {
          console.log('[Grammar] Exercise answer revealed:', index + 1);
          setRevealed(true);
        }} style={styles.revealBtn}>
          <Text style={styles.revealBtnText}>Tap to reveal answer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function GrammarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, activeLanguage } = useApp();
  const [lessons, setLessons] = useState<GrammarLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const targetLang = SUPPORTED_LANGUAGES.find((l) => l.code === activeLanguage?.target_language);
  const langDisplay = targetLang
    ? `${targetLang.flag} ${targetLang.name} · ${activeLanguage?.cefr_level}`
    : '';

  const fetchLessons = useCallback(async () => {
    if (!profile || !activeLanguage) return;
    setLoading(true);
    setError('');
    try {
      console.log('[Grammar] Fetching lessons for', profile.id, activeLanguage.target_language);
      const data = await apiRequest<{ lessons: GrammarLesson[] }>(
        `/api/grammar/lessons?profile_id=${profile.id}&target_language=${activeLanguage.target_language}&cefr_level=${activeLanguage.cefr_level}`
      );
      setLessons(data.lessons);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load lessons';
      console.error('[Grammar] Fetch error:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [profile, activeLanguage]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const handleGenerate = async () => {
    if (!profile || !activeLanguage) return;
    console.log('[Grammar] Generate lesson button pressed');
    setGenerating(true);
    try {
      const lesson = await apiRequest<GrammarLesson>('/api/grammar/lessons', {
        method: 'POST',
        body: JSON.stringify({
          profile_id: profile.id,
          target_language: activeLanguage.target_language,
          cefr_level: activeLanguage.cefr_level,
        }),
      });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLessons((prev) => [lesson, ...prev]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate lesson';
      console.error('[Grammar] Generate error:', msg);
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkComplete = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLessons((prev) =>
      prev.map((l) => (l.id === id ? { ...l, completed: true } : l))
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Grammar</Text>
          {langDisplay ? (
            <Text style={styles.langBadge}>{langDisplay}</Text>
          ) : null}
        </View>
        <AnimatedPressable
          onPress={() => {
            console.log('[Grammar] Settings button pressed');
            router.push('/settings');
          }}
          style={styles.iconBtn}
        >
          <Settings size={22} color={COLORS.textSecondary} />
        </AnimatedPressable>
      </View>

      {/* Content */}
      {loading ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </ScrollView>
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyTitle}>Couldn't load lessons</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <AnimatedPressable onPress={fetchLessons} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>Try again</Text>
          </AnimatedPressable>
        </View>
      ) : lessons.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <BookOpen size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>No lessons yet</Text>
          <Text style={styles.emptySubtitle}>
            Generate your first grammar lesson to get started
          </Text>
          <AnimatedPressable onPress={handleGenerate} disabled={generating} style={styles.emptyButton}>
            {generating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.emptyButtonText}>Generate lesson</Text>
            )}
          </AnimatedPressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {lessons.map((lesson, i) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              index={i}
              onMarkComplete={handleMarkComplete}
            />
          ))}
        </ScrollView>
      )}

      {/* FAB */}
      {!loading && lessons.length > 0 && (
        <AnimatedPressable
          onPress={handleGenerate}
          disabled={generating}
          style={[styles.fab, { bottom: insets.bottom + 90 }]}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Plus size={24} color="#FFFFFF" />
          )}
        </AnimatedPressable>
      )}
    </View>
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
    justifyContent: 'space-between',
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
  langBadge: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 120,
  },
  skeletonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skeletonTitle: {
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSecondary,
    width: '70%',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceSecondary,
    width: '45%',
  },
  lessonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  lessonCardCompleted: {
    borderColor: COLORS.successMuted,
    backgroundColor: '#FAFFFE',
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  lessonHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  lessonDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    flexShrink: 0,
  },
  lessonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  lessonBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  explanationBox: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 21,
  },
  exampleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bullet: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 1,
  },
  exampleText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 21,
    flex: 1,
  },
  exerciseItem: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  exerciseQ: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 20,
  },
  exerciseA: {
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '500',
    lineHeight: 20,
  },
  revealBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 8,
  },
  revealBtnText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
    minWidth: 140,
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
});
