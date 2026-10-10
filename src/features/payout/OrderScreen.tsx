import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SelectField,
  type SelectOption,
} from '@/components/ui';
import { useUserId } from '@/features/auth/authStore';
import { useCommittee, type Committee } from '@/features/committees/api';
import { useMembers, type Member } from '@/features/members/api';
import { confirm } from '@/lib/confirm';
import { addCalendarMonths, formatMonth, formatTimestamp } from '@/lib/dates';
import { errorKey } from '@/lib/errors';
import { MIN_TAP_TARGET, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { useAssignTurn, useChooseTurn, useDraws, useRunDraw, useSetPayoutOrder } from './api';

export function OrderScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const committee = useCommittee(id);
  const members = useMembers(id);

  const refresh = () => {
    void committee.refetch();
    void members.refetch();
  };

  return (
    <Screen onRefresh={refresh} refreshing={members.isRefetching}>
      {committee.data && members.data ? (
        <OrderContent committee={committee.data} members={members.data} />
      ) : committee.data === null ? (
        <EmptyState title={t('committee.detail.notFound')} />
      ) : committee.isError || members.isError ? (
        <ErrorState error={committee.error ?? members.error} onRetry={refresh} />
      ) : (
        <LoadingState />
      )}
    </Screen>
  );
}

function monthLabel(t: ReturnType<typeof useTranslation>['t'], committee: Committee, turn: number) {
  return t('order.monthLabel', {
    number: turn,
    month: formatMonth(addCalendarMonths(committee.start_month, turn - 1)),
  });
}

function OrderContent({ committee, members }: { committee: Committee; members: Member[] }) {
  const { t } = useTranslation();
  const userId = useUserId();
  const isOrganizer = committee.organizer_id === userId;
  const isDraft = committee.status === 'draft';
  const assigned = members.filter((m) => m.turn_number !== null).length;
  const missingMembers = committee.member_count - members.length;
  const freeMonths = committee.member_count - assigned;

  return (
    <>
      <View style={styles.summary}>
        <AppText variant="heading">
          {t('order.progress', { assigned, total: committee.member_count })}
        </AppText>
        <AppText tone={freeMonths === 0 ? 'success' : 'muted'}>
          {freeMonths === 0 ? t('order.allAssigned') : t('order.freeMonths', { count: freeMonths })}
        </AppText>
        {!isDraft ? (
          <AppText variant="caption" tone="muted">
            {t('order.locked')}
          </AppText>
        ) : missingMembers > 0 ? (
          <AppText variant="caption" tone="warning">
            {t('order.waitingForMembers', { count: missingMembers })}
          </AppText>
        ) : null}
      </View>

      {!isDraft ? (
        <ReadOnlyOrder committee={committee} members={members} />
      ) : committee.payout_order_method === 'random' ? (
        <RandomOrder committee={committee} members={members} isOrganizer={isOrganizer} />
      ) : committee.payout_order_method === 'manual' ? (
        isOrganizer ? (
          <ManualOrder committee={committee} members={members} />
        ) : (
          <ReadOnlyOrder committee={committee} members={members} />
        )
      ) : (
        <ChoiceOrder committee={committee} members={members} isOrganizer={isOrganizer} />
      )}
    </>
  );
}

function memberName(
  t: ReturnType<typeof useTranslation>['t'],
  member: Member | undefined,
  userId: string | null,
) {
  if (!member) return t('order.empty');
  const name = member.is_former_user ? t('members.formerName') : member.display_name;
  return member.user_id && member.user_id === userId ? `${name} (${t('order.you')})` : name;
}

/** Month-by-month list without actions. */
function ReadOnlyOrder({ committee, members }: { committee: Committee; members: Member[] }) {
  const { t } = useTranslation();
  const userId = useUserId();
  return (
    <View style={styles.list}>
      {Array.from({ length: committee.member_count }, (_, i) => {
        const turn = i + 1;
        const holder = members.find((m) => m.turn_number === turn);
        return (
          <MonthRow
            key={turn}
            label={monthLabel(t, committee, turn)}
            holder={memberName(t, holder, userId)}
            free={!holder}
            mine={Boolean(holder?.user_id && holder.user_id === userId)}
          />
        );
      })}
    </View>
  );
}

function MonthRow({
  label,
  holder,
  free,
  mine,
  children,
}: {
  label: string;
  holder: string;
  free: boolean;
  mine: boolean;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Card
      accessibilityLabel={t('order.choice.monthA11y', {
        month: label,
        holder: free ? t('order.free') : holder,
      })}
    >
      <View style={styles.monthHeader}>
        <AppText variant="bodyStrong" style={styles.flex}>
          {label}
        </AppText>
        {free ? (
          <Badge label={t('order.free')} tone="warning" />
        ) : mine ? (
          <Badge label={t('order.you')} tone="primary" />
        ) : null}
      </View>
      <AppText tone={free ? 'muted' : 'default'}>{free ? t('order.empty') : holder}</AppText>
      {children}
    </Card>
  );
}

/** Random draw: run on the server; every draw stays visible in the history. */
function RandomOrder({
  committee,
  members,
  isOrganizer,
}: {
  committee: Committee;
  members: Member[];
  isOrganizer: boolean;
}) {
  const { t } = useTranslation();
  const draws = useDraws(committee.id);
  const runDraw = useRunDraw(committee.id);
  const hasOrder = members.some((m) => m.turn_number !== null);
  const allMembersAdded = members.length === committee.member_count;
  const drawCount = draws.data?.length ?? 0;

  const onDraw = async () => {
    const again = drawCount > 0;
    const ok = await confirm({
      title: again ? t('order.random.rerunConfirmTitle') : t('order.random.confirmTitle'),
      message: again ? t('order.random.rerunConfirmBody') : t('order.random.confirmBody'),
      confirmLabel: again ? t('order.random.rerun') : t('order.random.run'),
      cancelLabel: t('common.cancel'),
    });
    if (ok) runDraw.mutate();
  };

  return (
    <>
      <AppText tone="muted">{t('order.random.intro')}</AppText>
      {isOrganizer ? (
        <>
          {runDraw.isError ? (
            <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {t(errorKey(runDraw.error))}
            </AppText>
          ) : null}
          <Button
            testID="order-run-draw"
            label={drawCount > 0 ? t('order.random.rerun') : t('order.random.run')}
            variant={drawCount > 0 ? 'secondary' : 'primary'}
            disabled={!allMembersAdded}
            loading={runDraw.isPending}
            onPress={() => void onDraw()}
          />
        </>
      ) : null}

      <AppText variant="heading">{t('order.random.latest')}</AppText>
      {hasOrder ? (
        <ReadOnlyOrder committee={committee} members={members} />
      ) : (
        <AppText tone="muted">{t('order.random.notYet')}</AppText>
      )}

      {drawCount > 0 ? (
        <Card>
          <AppText variant="bodyStrong">{t('order.random.history')}</AppText>
          {draws.data?.map((draw, index) => (
            <AppText key={draw.id} tone="muted">
              {t('order.random.historyItem', { number: index + 1, time: formatTimestamp(draw.created_at) })}
            </AppText>
          ))}
        </Card>
      ) : null}
    </>
  );
}

/** Organizer arranges members with up/down buttons (accessible alternative to drag and drop). */
function ManualOrder({ committee, members }: { committee: Committee; members: Member[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const save = useSetPayoutOrder(committee.id);
  const initial = [...members]
    .sort((a, b) => (a.turn_number ?? Number.MAX_SAFE_INTEGER) - (b.turn_number ?? Number.MAX_SAFE_INTEGER))
    .map((m) => m.id);
  const [order, setOrder] = useState<string[]>(initial);
  // Members added or removed since the screen opened: start again from the server order.
  const sameMembers =
    order.length === initial.length && initial.every((memberId) => order.includes(memberId));
  const current = sameMembers ? order : initial;
  const dirty = current.some(
    (memberId, index) => members.find((m) => m.id === memberId)?.turn_number !== index + 1,
  );
  const byId = new Map(members.map((m) => [m.id, m]));

  const move = (index: number, delta: -1 | 1) => {
    const next = [...current];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target] as string, next[index] as string];
    setOrder(next);
  };

  return (
    <>
      <AppText tone="muted">{t('order.manual.intro')}</AppText>
      <View style={styles.list}>
        {current.map((memberId, index) => {
          const member = byId.get(memberId);
          const name = member?.display_name ?? '';
          return (
            <View
              key={memberId}
              style={[styles.manualRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <View style={styles.flex}>
                <AppText variant="caption" tone="muted">
                  {monthLabel(t, committee, index + 1)}
                </AppText>
                <AppText variant="bodyStrong">{name}</AppText>
              </View>
              <ArrowButton
                label="↑"
                a11y={t('order.manual.moveUp', { name })}
                disabled={index === 0}
                onPress={() => move(index, -1)}
              />
              <ArrowButton
                label="↓"
                a11y={t('order.manual.moveDown', { name })}
                disabled={index === current.length - 1}
                onPress={() => move(index, 1)}
              />
            </View>
          );
        })}
      </View>
      {dirty ? (
        <AppText tone="warning" accessibilityLiveRegion="polite">
          {t('order.manual.unsaved')}
        </AppText>
      ) : null}
      {save.isError ? (
        <AppText tone="danger" accessibilityRole="alert">
          {t(errorKey(save.error))}
        </AppText>
      ) : null}
      <Button
        testID="order-save"
        label={t('order.manual.save')}
        disabled={!dirty || current.length === 0}
        loading={save.isPending}
        onPress={() => save.mutate(current)}
      />
    </>
  );
}

function ArrowButton({
  label,
  a11y,
  disabled,
  onPress,
}: {
  label: string;
  a11y: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.arrow,
        { borderColor: colors.border, opacity: disabled ? 0.3 : pressed ? 0.7 : 1 },
      ]}
    >
      <AppText variant="heading" tone="primary" importantForAccessibility="no">
        {label}
      </AppText>
    </Pressable>
  );
}

/** Members pick free months; the organizer can assign or clear any month. */
function ChoiceOrder({
  committee,
  members,
  isOrganizer,
}: {
  committee: Committee;
  members: Member[];
  isOrganizer: boolean;
}) {
  const { t } = useTranslation();
  const userId = useUserId();
  const assign = useAssignTurn(committee.id);
  const choose = useChooseTurn(committee.id);
  const me = members.find((m) => m.user_id === userId);
  const error = assign.error ?? choose.error;

  const memberOptions: SelectOption<string>[] = [
    { value: '', label: t('order.choice.clear') },
    ...members.map((m) => ({
      value: m.id,
      label: m.turn_number
        ? `${m.display_name} (${monthLabel(t, committee, m.turn_number)})`
        : m.display_name,
    })),
  ];

  const assignMonth = async (turn: number, memberId: string) => {
    const holder = members.find((m) => m.turn_number === turn);
    if (holder?.id === memberId) return;
    // Free the month first if someone else holds it, then give it to the chosen member.
    if (holder) await assign.mutateAsync({ memberId: holder.id, turn: null });
    if (memberId) await assign.mutateAsync({ memberId, turn });
  };

  return (
    <>
      <AppText tone="muted">{isOrganizer ? t('order.choice.intro') : t('order.choice.introMember')}</AppText>
      {!isOrganizer && !me ? <AppText tone="warning">{t('order.choice.notMember')}</AppText> : null}
      {error ? (
        <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {t(errorKey(error))}
        </AppText>
      ) : null}
      <View style={styles.list}>
        {Array.from({ length: committee.member_count }, (_, i) => {
          const turn = i + 1;
          const holder = members.find((m) => m.turn_number === turn);
          const mine = Boolean(me && holder?.id === me.id);
          const label = monthLabel(t, committee, turn);
          return (
            <MonthRow
              key={turn}
              label={label}
              holder={memberName(t, holder, userId)}
              free={!holder}
              mine={mine}
            >
              {isOrganizer ? (
                <SelectField
                  testID={`order-assign-${turn}`}
                  label={t('order.choice.assignTitle', { month: label })}
                  value={holder?.id ?? ''}
                  options={memberOptions}
                  onChange={(memberId) => void assignMonth(turn, memberId).catch(() => undefined)}
                />
              ) : me && !holder ? (
                <Button
                  testID={`order-pick-${turn}`}
                  variant="secondary"
                  label={t('order.choice.pick')}
                  loading={choose.isPending && choose.variables === turn}
                  onPress={() => choose.mutate(turn)}
                />
              ) : mine ? (
                <Button
                  variant="ghost"
                  label={t('order.choice.release')}
                  loading={choose.isPending && choose.variables === null}
                  onPress={() => choose.mutate(null)}
                />
              ) : null}
            </MonthRow>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: spacing.xs,
  },
  list: {
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  manualRow: {
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  arrow: {
    width: MIN_TAP_TARGET,
    height: MIN_TAP_TARGET,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
