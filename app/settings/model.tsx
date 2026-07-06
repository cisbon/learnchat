import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { apiRequest, AppConfig } from '@/utils/api';
import { AnimatedPressable } from '@/components/AnimatedPressable';

const SUGGESTED_MODELS = [
  'google/gemini-2.0-flash-001',
  'google/gemini-2.5-flash',
  'anthropic/claude-3.5-haiku',
  'openai/gpt-4o-mini',
  'meta-llama/llama-3.3-70b-instruct',
];

export default function ModelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        console.log('[Settings/Model] Fetching current model config');
        const config = await apiRequest<AppConfig>('/api/config?key=active_model');
        setModel(config.value ?? '');
      } catch (e) {
        console.error('[Settings/Model] Fetch config error:', e);
        setModel('google/gemini-2.0-flash-001');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!model.trim()) return;
    console.log('[Settings/Model] Save model button pressed:', model.trim());
    setSaving(true);
    setError('');
    try {
      await apiRequest('/api/config', {
        method: 'PUT',
        body: JSON.stringify({ key: 'active_model', value: model.trim() }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      console.error('[Settings/Model] Save error:', msg);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AnimatedPressable
          onPress={() => {
            console.log('[Settings/Model] Back button pressed');
            router.back();
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={COLORS.text} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>AI Model</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={styles.label}>Active model</Text>
            <TextInput
              style={styles.input}
              value={model}
              onChangeText={setModel}
              placeholder="e.g. google/gemini-2.0-flash-001"
              placeholderTextColor={COLORS.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AnimatedPressable
              onPress={handleSave}
              disabled={!model.trim() || saving}
              style={[styles.saveButton, (!model.trim() || saving) && styles.saveButtonDisabled]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : saved ? (
                <>
                  <Check size={16} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Saved!</Text>
                </>
              ) : (
                <Text style={styles.saveButtonText}>Save changes</Text>
              )}
            </AnimatedPressable>

            <Text style={styles.note}>
              Changes take effect immediately for new conversations
            </Text>

            <Text style={styles.suggestedLabel}>Suggested models</Text>
            <View style={styles.suggestedList}>
              {SUGGESTED_MODELS.map((m) => (
                <AnimatedPressable
                  key={m}
                  onPress={() => {
                    console.log('[Settings/Model] Suggested model tapped:', m);
                    setModel(m);
                  }}
                  style={[styles.suggestedItem, model === m && styles.suggestedItemActive]}
                >
                  <Text style={[styles.suggestedText, model === m && styles.suggestedTextActive]}>
                    {m}
                  </Text>
                  {model === m && <Check size={14} color={COLORS.primary} />}
                </AnimatedPressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  content: {
    padding: 20,
    gap: 12,
    paddingBottom: 48,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    fontFamily: 'SpaceMono',
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  note: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  suggestedLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 4,
  },
  suggestedList: {
    gap: 8,
  },
  suggestedItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestedItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  suggestedText: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: 'SpaceMono',
    flex: 1,
  },
  suggestedTextActive: {
    color: COLORS.primary,
  },
});
