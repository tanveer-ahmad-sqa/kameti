import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui';
import { formatTimestamp } from '@/lib/dates';

import type { Payment } from './api';
import type { PaymentStatus } from './stats';

export const STATUS_TONE: Record<PaymentStatus, 'neutral' | 'warning' | 'success' | 'danger'> = {
  pending: 'neutral',
  awaiting_confirmation: 'warning',
  paid: 'success',
  late: 'danger',
};

/** "Paid on … via … \"note\"" under a payment row. */
export function PaymentDetailsLine({ payment }: { payment: Payment }) {
  const { t } = useTranslation();
  const parts: string[] = [];
  if (payment.paid_at) parts.push(t('payments.paidOn', { date: formatTimestamp(payment.paid_at) }));
  else if (payment.claimed_at)
    parts.push(t('payments.claimedOn', { date: formatTimestamp(payment.claimed_at) }));
  if (payment.method) parts.push(t('payments.via', { method: t(`paymentMethod.${payment.method}`) }));
  if (parts.length === 0 && !payment.note) return null;
  return (
    <>
      {parts.length > 0 ? (
        <AppText variant="caption" tone="muted">
          {parts.join(' · ')}
        </AppText>
      ) : null}
      {payment.note ? (
        <AppText variant="caption" tone="muted">
          “{payment.note}”
        </AppText>
      ) : null}
    </>
  );
}
