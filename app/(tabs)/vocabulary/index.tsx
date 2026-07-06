import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layers, X, Check, RefreshCw } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { apiRequest, VocabularyCard } from '@/utils/api';
import { SUPPORTED_LANGUAGES } from '@/constants/languages';
import { AnimatedPressable } from '@/components/AnimatedPressable';

type Direction = 'target-to-native' | 'native-to-target';

function isKnown(card: VocabularyCard, direction: Direction): boolean {
  return direction === 'target-to-native' ? card.known_forward : card.known_backward;
}

function FlashCard({
  card,
  direction,
}: {
  card: VocabularyCard;
  direction: Direction;
}) {
  const [flipped, setFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const cardWidth = width - 48;

  const handleFlip = () => {
    console.log('[Vocabulary] Card flipped:', card.word);
    Animated.spring(flipAnim, {
      toValue: flipped ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
    setFlipped((v) => !v);
  };

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [0, 0, 1, 1] });

  const frontWord = direction === 'target-to-native' ? card.word : card.translation;
  const frontPronunciation = direction === 'target-to-native' ? card.pronunciation_hint : undefined;
  const backWord = direction === 'target-to-native' ? card.translation : card.word;
  const backExample = card.example_sentence;

  return (
    <TouchableOpacity onPress={handleFlip} activeOpacity={0.95} style={{ width: cardWidth, height: cardWidth * 0.65 }}>
      {/* Front */}
      <Animated.View
        style={[
          styles.card,
          { width: cardWidth, height: cardWidth * 0.65 },
          { transform: [{ rotateY: frontRotate }], opacity: frontOpacity },
        ]}
      >
        <Text style={styles.cardWord}>{frontWord}</Text>
        {frontPronunciation ? (
          <Text style={styles.cardPronunciation}>{frontPronunciation}</Text>
        ) : null}
        <Text style={styles.cardHint}>Tap to reveal</Text>
      </Animated.View>

      {/* Back */}
      <Animated.View
        style={[
          styles.card,
          styles.cardBack,
          { width: cardWidth, height: cardWidth * 0.65 },
          { transform: [{ rotateY: backRotate }], opacity: backOpacity, position: 'absolute' },
        ]}
      >
        <Text style={styles.cardTranslation}>{backWord}</Text>
        {backExample ? (
          <Text style={styles.cardExample}>{backExample}</Text>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function VocabularyScreen() {
  const insets = useSafeAreaInsets();
  const { profile, activeLanguage } = useApp();
  const [cards, setCards] = useState<VocabularyCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState<Direction>('target-to-native');
  const [knownCount, setKnownCount] = useState(0);
  const [completed, setCompleted] = useState(false);

  const targetLang = SUPPORTED_LANGUAGES.find((l) => l.code === activeLanguage?.target_language);

  const fetchCards = useCallback(async () => {
    if (!profile || !activeLanguage) return;
    setLoading(true);
    setError('');
    try {
      console.log('[Vocabulary] Fetching cards for', profile.id, activeLanguage.target_language);
      const data = await apiRequest<{ cards: VocabularyCard[] }>(
        `/api/vocabulary/cards?profile_id=${profile.id}&target_language=${activeLanguage.target_language}&cefr_level=${activeLanguage.cefr_level}`
      );
      // Unknown cards first
      const sorted = [...data.cards.filter((c) => !isKnown(c, direction)), ...data.cards.filter((c) => isKnown(c, direction))];
      setCards(sorted);
      setCurrentIndex(0);
      setKnownCount(data.cards.filter((c) => isKnown(c, direction)).length);
      setCompleted(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load cards';
      console.error('[Vocabulary] Fetch error:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [profile, activeLanguage, direction]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleGenerate = async () => {
    if (!profile || !activeLanguage) return;
    console.log('[Vocabulary] Generate cards button pressed');
    setGenerating(true);
    try {
      const data = await apiRequest<{ cards: VocabularyCard[] }>('/api/vocabulary/cards', {
        method: 'POST',
        body: JSON.stringify({
          profile_id: profile.id,
          target_language: activeLanguage.target_language,
          cefr_level: activeLanguage.cefr_level,
          main_language: profile.main_language,
        }),
      });
      const sorted = [...data.cards.filter((c) => !isKnown(c, direction)), ...data.cards.filter((c) => isKnown(c, direction))];
      setCards(sorted);
      setCurrentIndex(0);
      setCompleted(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate cards';
      console.error('[Vocabulary] Generate error:', msg);
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleProgress = async (known: boolean) => {
    const card = cards[currentIndex];
    if (!card) return;
    console.log('[Vocabulary] Card progress:', card.word, known ? 'known' : 'unknown');
    try {
      await apiRequest(`/api/vocabulary/cards/${card.id}/progress`, {
        method: 'PUT',
        body: JSON.stringify(
          direction === 'target-to-native' ? { known_forward: known } : { known_backward: known }
        ),
      });
    } catch (e) {
      console.error('[Vocabulary] Progress update error:', e);
    }

    if (known) setKnownCount((k) => k + 1);

    const nextIndex = currentIndex + 1;
    if (nextIndex >= cards.length) {
      setCompleted(true);
    } else {
      setCurrentIndex(nextIndex);
    }
  };

  const progress = cards.length > 0 ? (currentIndex / cards.length) : 0;
  const currentCard = cards[currentIndex];

  const directionLabel = direction === 'target-to-native'
    ? `${targetLang?.flag ?? ''} → Native`
    : `Native → ${targetLang?.flag ?? ''}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Vocabulary</Text>
          {cards.length > 0 && (
            <Text style={styles.progressLabel}>{knownCount} / {cards.length} known</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => {
            const next: Direction = direction === 'target-to-native' ? 'native-to-target' : 'target-to-native';
            console.log('[Vocabulary] Direction toggle pressed:', next);
            setDirection(next);
          }}
          style={styles.directionToggle}
        >
          <Text style={styles.directionText}>{directionLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      {cards.length > 0 && (
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📖</Text>
          <Text style={styles.emptyTitle}>Couldn't load cards</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <AnimatedPressable onPress={fetchCards} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Try again</Text>
          </AnimatedPressable>
        </View>
      ) : cards.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconCircle}>
            <Layers size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>No vocabulary cards yet</Text>
          <Text style={styles.emptySubtitle}>
            Generate your first set of flashcards to start learning
          </Text>
          <AnimatedPressable onPress={handleGenerate} disabled={generating} style={styles.actionButton}>
            {generating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>Generate cards</Text>
            )}
          </AnimatedPressable>
        </View>
      ) : completed ? (
        <View style={styles.center}>
          <Text style={styles.completedEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>Deck complete!</Text>
          <Text style={styles.emptySubtitle}>
            You reviewed all {cards.length} cards.{'\n'}{knownCount} known, {cards.length - knownCount} to review.
          </Text>
          <AnimatedPressable
            onPress={() => {
              console.log('[Vocabulary] Restart deck pressed');
              setCurrentIndex(0);
              setCompleted(false);
            }}
            style={styles.actionButton}
          >
            <RefreshCw size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionButtonText}>Review again</Text>
          </AnimatedPressable>
          <AnimatedPressable onPress={handleGenerate} disabled={generating} style={[styles.actionButton, styles.secondaryButton]}>
            {generating ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>Generate more</Text>
            )}
          </AnimatedPressable>
        </View>
      ) : currentCard ? (
        <View style={styles.cardArea}>
          <View style={styles.cardCounter}>
            <Text style={styles.cardCounterText}>{currentIndex + 1} / {cards.length}</Text>
          </View>

          <FlashCard card={currentCard} direction={direction} />

          <View style={styles.actionRow}>
            <AnimatedPressable
              onPress={() => handleProgress(false)}
              style={styles.dontKnowBtn}
            >
              <X size={24} color={COLORS.error} />
              <Text style={styles.dontKnowText}>Don't know</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => handleProgress(true)}
              style={styles.knowBtn}
            >
              <Check size={24} color={COLORS.success} />
              <Text style={styles.knowText}>Know it!</Text>
            </AnimatedPressable>
          </View>
        </View>
      ) : null}
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
  progressLabel: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  directionToggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  directionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: COLORS.surfaceSecondary,
  },
  progressBarFill: {
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  center: {
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
  completedEmoji: {
    fontSize: 56,
    marginBottom: 4,
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
  actionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 8,
    minWidth: 160,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 24,
    paddingBottom: 100,
  },
  cardCounter: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
  },
  cardCounterText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  cardWord: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  cardPronunciation: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  cardHint: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 8,
  },
  cardTranslation: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  cardExample: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dontKnowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: COLORS.errorMuted,
    borderWidth: 1.5,
    borderColor: COLORS.error,
  },
  dontKnowText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.error,
  },
  knowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: COLORS.successMuted,
    borderWidth: 1.5,
    borderColor: COLORS.success,
  },
  knowText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
});
