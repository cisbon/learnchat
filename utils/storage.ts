import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile, LearningLanguage } from '@/utils/api';

const KEYS = {
  PROFILE_ID: '@learnchat/profile_id',
  PROFILE: '@learnchat/profile',
  ACTIVE_LANGUAGE: '@learnchat/active_language',
} as const;

export async function getProfileId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.PROFILE_ID);
}

export async function setProfileId(id: string): Promise<void> {
  return AsyncStorage.setItem(KEYS.PROFILE_ID, id);
}

export async function getProfile(): Promise<Profile | null> {
  const raw = await AsyncStorage.getItem(KEYS.PROFILE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

export async function setProfile(profile: Profile): Promise<void> {
  return AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
}

export async function getActiveLanguage(): Promise<LearningLanguage | null> {
  const raw = await AsyncStorage.getItem(KEYS.ACTIVE_LANGUAGE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LearningLanguage;
  } catch {
    return null;
  }
}

export async function setActiveLanguage(lang: LearningLanguage): Promise<void> {
  return AsyncStorage.setItem(KEYS.ACTIVE_LANGUAGE, JSON.stringify(lang));
}

export async function clearAll(): Promise<void> {
  return AsyncStorage.multiRemove([KEYS.PROFILE_ID, KEYS.PROFILE, KEYS.ACTIVE_LANGUAGE]);
}
