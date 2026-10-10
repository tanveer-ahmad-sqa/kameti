import { Contact, ContactField, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, EmptyState, ErrorState, LoadingState, Screen, TextField } from '@/components/ui';
import { useCommittee } from '@/features/committees/api';
import { errorKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryKeys';
import { MIN_TAP_TARGET, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatPkMobile } from '@shared/schemas/phone';

import { useAddMembers, useMembers } from './api';
import { buildContactRows, filterContactRows, type ContactRow } from './contactRows';

/**
 * Reads names and numbers from the device. Kept in memory only while the screen is open:
 * `device` queries are excluded from the persisted offline cache and garbage-collected at once.
 */
function useDeviceContacts() {
  return useQuery({
    queryKey: queryKeys.device.contacts,
    queryFn: () => Contact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES]),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    networkMode: 'always',
  });
}

type PermissionState = 'checking' | 'undetermined' | 'denied' | 'blocked' | 'granted';

export function ContactsPickerScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [permission, setPermission] = useState<PermissionState>('checking');

  useEffect(() => {
    void getPermissionsAsync().then((result) => {
      if (result.granted) setPermission('granted');
      else if (!result.canAskAgain) setPermission('blocked');
      else setPermission(result.status === 'denied' ? 'denied' : 'undetermined');
    });
  }, []);

  const request = async () => {
    const result = await requestPermissionsAsync();
    setPermission(result.granted ? 'granted' : result.canAskAgain ? 'denied' : 'blocked');
  };

  if (permission === 'checking') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (permission !== 'granted') {
    const blocked = permission === 'blocked';
    // Explain first, then ask: the system dialog only appears after the user taps "Allow".
    return (
      <Screen>
        <EmptyState
          title={blocked ? t('contacts.permissionDeniedTitle') : t('contacts.permissionTitle')}
          body={blocked ? t('contacts.permissionDeniedBody') : t('contacts.permissionBody')}
          action={
            <View style={styles.permissionActions}>
              <Button
                testID="contacts-allow"
                label={blocked ? t('common.openSettings') : t('contacts.permissionAllow')}
                onPress={() => void (blocked ? Linking.openSettings() : request())}
              />
              <Button variant="ghost" label={t('common.notNow')} onPress={() => router.back()} />
            </View>
          }
        />
      </Screen>
    );
  }

  return <ContactsList committeeId={id} />;
}

function ContactsList({ committeeId }: { committeeId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const committee = useCommittee(committeeId);
  const members = useMembers(committeeId);
  const add = useAddMembers(committeeId);

  const deviceContacts = useDeviceContacts();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Map<string, ContactRow>>(new Map());

  const existingPhones = useMemo(
    () => new Set((members.data ?? []).flatMap((member) => (member.phone ? [member.phone] : []))),
    [members.data],
  );

  const contacts = useMemo(
    () =>
      deviceContacts.data && members.data
        ? buildContactRows(deviceContacts.data, existingPhones, t('contacts.unnamed'))
        : null,
    [deviceContacts.data, members.data, existingPhones, t],
  );

  const remaining = committee.data ? committee.data.member_count - (members.data?.length ?? 0) : 0;
  const filtered = useMemo(() => filterContactRows(contacts ?? [], query), [contacts, query]);

  const toggle = (row: ContactRow) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(row.phone)) next.delete(row.phone);
      else if (next.size < remaining) next.set(row.phone, row);
      return next;
    });
  };

  const submit = () => {
    const values = [...selected.values()].map((row) => ({
      displayName: row.name.slice(0, 60),
      phone: row.phone,
    }));
    add.mutate(values, { onSuccess: () => router.back() });
  };

  if (deviceContacts.isError) {
    return (
      <Screen>
        <ErrorState
          error={{ code: 'P0001', message: 'contacts_failed' }}
          onRetry={() => void deviceContacts.refetch()}
        />
      </Screen>
    );
  }
  if (!contacts || !committee.data) {
    return (
      <Screen>
        {committee.isError || members.isError ? (
          <ErrorState error={committee.error ?? members.error} onRetry={() => void members.refetch()} />
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }

  return (
    <Screen
      scroll={false}
      footer={
        <>
          {add.isError ? (
            <AppText tone="danger" accessibilityRole="alert">
              {t(errorKey(add.error))}
            </AppText>
          ) : null}
          <AppText variant="caption" tone="muted" accessibilityLiveRegion="polite">
            {t('contacts.selectionLimit', { count: Math.max(remaining - selected.size, 0) })}
          </AppText>
          <Button
            testID="contacts-submit"
            label={t('contacts.addSelected', { count: selected.size })}
            disabled={selected.size === 0}
            loading={add.isPending}
            onPress={submit}
          />
        </>
      }
    >
      <View style={styles.search}>
        <TextField
          label={t('contacts.search')}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      {contacts.length === 0 ? (
        <EmptyState title={t('contacts.emptyTitle')} body={t('contacts.emptyBody')} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(row) => row.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<AppText tone="muted">{t('contacts.noResults')}</AppText>}
          renderItem={({ item }) => {
            const checked = selected.has(item.phone);
            const disabled = item.alreadyAdded || (!checked && selected.size >= remaining);
            const phone = formatPkMobile(item.phone);
            return (
              <Pressable
                onPress={() => toggle(item)}
                disabled={disabled}
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled }}
                accessibilityLabel={t('contacts.selectA11y', { name: item.name, phone })}
                accessibilityHint={item.alreadyAdded ? t('contacts.alreadyAdded') : undefined}
                style={[
                  styles.row,
                  {
                    borderColor: checked ? colors.primary : colors.border,
                    backgroundColor: checked ? colors.primarySoft : colors.surfaceRaised,
                    opacity: disabled && !checked ? 0.5 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: checked ? colors.primary : colors.textMuted },
                    checked && { backgroundColor: colors.primary },
                  ]}
                >
                  {checked ? <AppText style={{ color: colors.primaryText }}>✓</AppText> : null}
                </View>
                <View style={styles.rowText}>
                  <AppText variant="bodyStrong">{item.name}</AppText>
                  <AppText tone="muted">
                    {item.alreadyAdded ? `${phone} · ${t('contacts.alreadyAdded')}` : phone}
                  </AppText>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  permissionActions: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  search: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
});
