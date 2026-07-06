import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, User, Globe, Cpu, Info, Plus } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { apiRequest, LearningLanguage } from '@/utils/api';
import { SUPPORTED_LANGUAGES, CEFR_LEVELS } from '@/constants/languages';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import Constants from 'expo-constants';

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <AnimatedPressable onPress={onPress} style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {onPress ? <ChevronRight size={18} color={COLORS.textTertiary} /> : null}
    </AnimatedPressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, activeLanguage, refreshProfile } = useApp();
  const [languages, setLanguages] = useState<LearningLanguage[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(false);

  const fetchLanguages = useCallback(async () => {
    if (!profile) return;
    setLoadingLangs(true);
    try {
      console.log('[Settings] Fetching languages for profile:', profile.id);
      const data = await apiRequest<LearningLanguage[]>(`/api/profiles/${profile.id}/languages`);
      setLanguages(data);
    } catch (e) {
      console.error('[Settings] Fetch languages error:', e);
    } finally {
      setLoadingLangs(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchLanguages();
  }, [fetchLanguages]);

  const mainLang = SUPPORTED_LANGUAGES.find((l) => l.code === profile?.main_language);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleEditLevel = (lang: LearningLanguage) => {
    console.log('[Settings] Edit level pressed for:', lang.target_language);
    const targetLang = SUPPORTED_LANGUAGES.find((l) => l.code === lang.target_language);
    Alert.alert(
      `Change level for ${targetLang?.name ?? lang.target_language}`,
      'Select your new level:',
      CEFR_LEVELS.map((level) => ({
        text: level.label,
        onPress: async () => {
          console.log('[Settings] Level change confirmed:', level.code);
          try {
            await apiRequest(`/api/profiles/${profile!.id}/languages/${lang.id}`, {
              method: 'PUT',
              body: JSON.stringify({ cefr_level: level.code }),
            });
            await fetchLanguages();
            await refreshProfile();
          } catch (e) {
            console.error('[Settings] Level update error:', e);
          }
        },
      }))
    );
  };

  const handleAddLanguage = () => {
    console.log('[Settings] Add language pressed');
    router.push('/onboarding/target-language');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AnimatedPressable
          onPress={() => {
            console.log('[Settings] Back button pressed');
            router.back();
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={COLORS.text} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <SectionHeader title="Profile" />
        <View style={styles.card}>
          <SettingsRow
            icon={<User size={18} color={COLORS.primary} />}
            label="Nickname"
            value={profile?.nickname ?? '—'}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={<Globe size={18} color={COLORS.primary} />}
            label="Native language"
            value={mainLang ? `${mainLang.flag} ${mainLang.name}` : profile?.main_language ?? '—'}
          />
        </View>

        {/* Learning Languages */}
        <SectionHeader title="Learning Languages" />
        <View style={styles.card}>
          {loadingLangs ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : languages.length === 0 ? (
            <Text style={styles.emptyText}>No languages added yet</Text>
          ) : (
            languages.map((lang, i) => {
              const tl = SUPPORTED_LANGUAGES.find((l) => l.code === lang.target_language);
              return (
                <React.Fragment key={lang.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <SettingsRow
                    icon={<Text style={{ fontSize: 18 }}>{tl?.flag ?? '🌐'}</Text>}
                    label={tl?.name ?? lang.target_language}
                    value={lang.cefr_level}
                    onPress={() => handleEditLevel(lang)}
                  />
                </React.Fragment>
              );
            })
          )}
          <View style={styles.divider} />
          <AnimatedPressable onPress={handleAddLanguage} style={styles.addLangRow}>
            <Plus size={16} color={COLORS.primary} />
            <Text style={styles.addLangText}>Add language</Text>
          </AnimatedPressable>
        </View>

        {/* AI Model */}
        <SectionHeader title="AI Model" />
        <View style={styles.card}>
          <SettingsRow
            icon={<Cpu size={18} color={COLORS.primary} />}
            label="Active model"
            value="Tap to configure"
            onPress={() => {
              console.log('[Settings] AI Model row pressed');
              router.push('/settings/model');
            }}
          />
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={styles.card}>
          <SettingsRow
            icon={<Info size={18} color={COLORS.primary} />}
            label="Version"
            value={appVersion}
          />
        </View>
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
    padding: 16,
    gap: 4,
    paddingBottom: 48,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  card: {
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  rowValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginLeft: 60,
  },
  loadingRow: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    padding: 16,
    textAlign: 'center',
  },
  addLangRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addLangText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
