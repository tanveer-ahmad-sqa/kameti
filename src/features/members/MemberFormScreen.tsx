import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AppText, Button, ErrorState, LoadingState, Screen, TextField } from '@/components/ui';
import { errorKey } from '@/lib/errors';
import { translateValidation } from '@/lib/validation';
import { formatPkMobile } from '@shared/schemas/phone';
import { memberFormSchema, type MemberFormInput, type MemberFormOutput } from '@shared/schemas/member';

import { useAddMembers, useMembers, useUpdateMember, type Member } from './api';

/** Add a member, or edit one when `memberId` is given. */
export function MemberFormScreen() {
  const { id, memberId } = useLocalSearchParams<{ id: string; memberId?: string }>();
  const members = useMembers(id);

  if (!memberId) {
    return <MemberForm committeeId={id} />;
  }
  const member = members.data?.find((m) => m.id === memberId);
  if (member) {
    return <MemberForm committeeId={id} member={member} />;
  }
  return (
    <Screen>
      {members.isError ? (
        <ErrorState error={members.error} onRetry={() => void members.refetch()} />
      ) : (
        <LoadingState />
      )}
    </Screen>
  );
}

function MemberForm({ committeeId, member }: { committeeId: string; member?: Member }) {
  const { t } = useTranslation();
  const add = useAddMembers(committeeId);
  const update = useUpdateMember(committeeId);
  const mutation = member ? update : add;

  const { control, handleSubmit, formState } = useForm<MemberFormInput, unknown, MemberFormOutput>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      displayName: member?.display_name ?? '',
      phone: member?.phone ? formatPkMobile(member.phone) : '',
    },
  });

  const onSubmit = handleSubmit((values) => {
    const done = { onSuccess: () => router.back() };
    if (member) {
      update.mutate({ memberId: member.id, values }, done);
    } else {
      add.mutate([values], done);
    }
  });

  return (
    <>
      <Stack.Screen options={{ title: member ? t('members.form.editTitle') : t('members.form.addTitle') }} />
      <Screen
        footer={
          <>
            {mutation.isError ? (
              <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
                {t(errorKey(mutation.error))}
              </AppText>
            ) : null}
            <Button
              testID="member-form-submit"
              label={member ? t('members.form.save') : t('members.form.add')}
              onPress={() => void onSubmit()}
              loading={mutation.isPending}
            />
          </>
        }
      >
        <Controller
          control={control}
          name="displayName"
          render={({ field }) => (
            <TextField
              testID="member-name"
              label={t('members.form.name')}
              placeholder={t('members.form.namePlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="words"
              autoComplete="name"
              maxLength={60}
              autoFocus={!member}
              error={translateValidation(t, formState.errors.displayName?.message)}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextField
              testID="member-phone"
              label={t('members.form.phone')}
              hint={t('members.form.phoneHint')}
              placeholder={t('auth.signIn.phonePlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="done"
              onSubmitEditing={() => void onSubmit()}
              error={translateValidation(t, formState.errors.phone?.message)}
            />
          )}
        />
      </Screen>
    </>
  );
}
