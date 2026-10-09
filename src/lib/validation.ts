import type { TFunction } from 'i18next';

import type en from '@/i18n/locales/en.json';

type ValidationKey = `validation.${keyof (typeof en)['validation']}`;

function isValidationKey(value: string): value is ValidationKey {
  return value.startsWith('validation.');
}

/**
 * Zod schemas use i18n keys as error messages ('validation.phone_invalid') so the same
 * schemas work in edge functions. This turns such a message into translated text.
 */
export function translateValidation(t: TFunction, message: string | undefined): string | undefined {
  if (!message) return undefined;
  return isValidationKey(message) ? t(message) : message;
}
