import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Card } from '@/components/ui';
import { MIN_TAP_TARGET, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatPkMobile } from '@shared/schemas/phone';

import type { Member } from './api';

export type MemberRowProps = {
  member: Member;
  /** Organizer view: phone numbers and invite actions. */
  showContact: boolean;
  /** Organizer in draft: edit and remove. */
  editable: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
  onWhatsApp?: () => void;
  onSms?: () => void;
};

export function MemberRow({
  member,
  showContact,
  editable,
  onEdit,
  onRemove,
  onWhatsApp,
  onSms,
}: MemberRowProps) {
  const { t } = useTranslation();
  const name = member.is_former_user ? t('members.formerName') : member.display_name;
  const status = member.is_former_user
    ? t('members.badgeFormer')
    : member.user_id
      ? t('members.badgeJoined')
      : t('members.badgePending');
  const canInvite = showContact && !member.user_id && !member.is_former_user && member.phone;

  return (
    <Card testID={`member-${member.id}`}>
      <View style={styles.header} accessible accessibilityLabel={t('members.memberA11y', { name, status })}>
        <View style={styles.headerText}>
          <AppText variant="bodyStrong">{name}</AppText>
          {showContact && member.phone ? (
            <AppText tone="muted">{formatPkMobile(member.phone)}</AppText>
          ) : null}
        </View>
        <View style={styles.badges}>
          {member.is_organizer ? <Badge label={t('members.badgeOrganizer')} tone="warning" /> : null}
          <Badge
            label={status}
            tone={member.is_former_user ? 'neutral' : member.user_id ? 'success' : 'neutral'}
          />
        </View>
      </View>

      {canInvite || editable ? (
        <View style={styles.actions}>
          {canInvite ? (
            <>
              <ActionChip
                label={t('members.inviteWhatsApp')}
                a11y={t('members.inviteWhatsAppA11y', { name })}
                onPress={onWhatsApp}
              />
              <ActionChip
                label={t('members.inviteSms')}
                a11y={t('members.inviteSmsA11y', { name })}
                onPress={onSms}
              />
            </>
          ) : null}
          {editable ? (
            <>
              <ActionChip label={t('common.edit')} a11y={t('members.editA11y', { name })} onPress={onEdit} />
              <ActionChip
                label={t('common.remove')}
                a11y={t('members.removeA11y', { name })}
                onPress={onRemove}
                danger
              />
            </>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function ActionChip({
  label,
  a11y,
  onPress,
  danger,
}: {
  label: string;
  a11y: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: danger ? colors.danger : colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <AppText
        variant="caption"
        style={{ color: danger ? colors.danger : colors.primary, fontWeight: '600' }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    minWidth: 140,
  },
  badges: {
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    minHeight: MIN_TAP_TARGET - 8,
    minWidth: MIN_TAP_TARGET,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
