import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';

/**
 * All user-facing strings live in locales/<lang>.json. To add Urdu later:
 *  1. add locales/ur.json with the same keys,
 *  2. add it to `resources` and SUPPORTED_LANGUAGES,
 *  3. RTL: call I18nManager.forceRTL(isRTL) on language change and reload.
 * Components already use start/end (not left/right) so layouts flip automatically.
 */
export const resources = { en: { translation: en } } as const;
export const SUPPORTED_LANGUAGES = ['en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return SUPPORTED_LANGUAGES.find((lang) => lang === code) ?? 'en';
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
