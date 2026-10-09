import 'i18next';

import type { resources } from './index';

// Makes t('some.key') type-checked against en.json.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: (typeof resources)['en'];
  }
}
