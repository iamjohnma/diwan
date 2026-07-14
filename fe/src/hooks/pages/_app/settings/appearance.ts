import { useCallback, useEffect, useMemo, useState } from 'react';
import { LANGUAGE_STORAGE_KEY } from '@/constants/core/i18n';
import {
  changeAppLanguage,
  resolveLanguagePreference
} from '@/integrations/i18n/config';
import {
  type AppearancePreferences,
  useUserPreferencesStore
} from '@/stores/user-preferences';
import { applyPrimaryColor } from '@/utils/common/apply-preferences';

function applyFontSize(fontSize: AppearancePreferences['fontSize']): void {
  document.documentElement.dataset.fontSize = fontSize;
}

async function applyLanguage(
  language: AppearancePreferences['language']
): Promise<void> {
  await changeAppLanguage(resolveLanguagePreference(language));
}

function persistLanguage(language: AppearancePreferences['language']): void {
  try {
    if (language === 'system') {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } else {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browsing modes.
  }
}

export function useAppearanceSettings() {
  const saved = useUserPreferencesStore((state) => state.appearance);
  const setAppearance = useUserPreferencesStore((state) => state.setAppearance);
  const setSidebarOpen = useUserPreferencesStore(
    (state) => state.setSidebarOpen
  );
  const [draft, setDraft] = useState(saved);
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved]
  );

  useEffect(() => {
    if (!isDirty) setDraft(saved);
  }, [isDirty, saved]);

  const update = useCallback((patch: Partial<AppearancePreferences>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (patch.primaryColor || patch.foregroundOverride) {
        applyPrimaryColor(next.primaryColor, next.foregroundOverride);
      }

      return next;
    });
    if (patch.fontSize) applyFontSize(patch.fontSize);
    if (patch.language) void applyLanguage(patch.language);
  }, []);

  const cancel = useCallback(() => {
    setDraft(saved);
    applyPrimaryColor(saved.primaryColor, saved.foregroundOverride);
    applyFontSize(saved.fontSize);
    void applyLanguage(saved.language);
  }, [saved]);

  const save = useCallback(() => {
    persistLanguage(draft.language);
    setAppearance(draft);
    applyPrimaryColor(draft.primaryColor, draft.foregroundOverride);
    applyFontSize(draft.fontSize);
    void applyLanguage(draft.language);

    if (draft.sidebar === 'open') setSidebarOpen(true);
    if (draft.sidebar === 'closed') setSidebarOpen(false);
  }, [draft, setAppearance, setSidebarOpen]);

  return { draft, update, isDirty, cancel, save };
}

export type AppearanceSettingsHook = ReturnType<typeof useAppearanceSettings>;
