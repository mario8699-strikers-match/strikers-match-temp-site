'use client';

import { useTranslation } from 'react-i18next';

interface LocalizedTextProps {
  i18nKey: string;
  namespace?: string;
  values?: Record<string, string | number>;
}

export function LocalizedText({ i18nKey, namespace = 'common', values }: LocalizedTextProps) {
  const { t } = useTranslation(namespace);
  return <>{t(i18nKey, values)}</>;
}
