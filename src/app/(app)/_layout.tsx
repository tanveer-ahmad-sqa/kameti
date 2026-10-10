import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function AppLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back'), headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ title: t('home.title') }} />
      <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
      <Stack.Screen name="committee/new" options={{ title: t('committee.newTitle') }} />
      <Stack.Screen name="committee/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="committee/[id]/edit" options={{ title: t('committee.editTitle') }} />
      <Stack.Screen name="committee/[id]/members" options={{ title: t('members.title') }} />
      <Stack.Screen name="committee/[id]/order" options={{ title: t('order.title') }} />
      <Stack.Screen name="committee/[id]/schedule" options={{ title: t('schedule.title') }} />
      <Stack.Screen name="committee/[id]/swap" options={{ title: t('swap.title'), presentation: 'modal' }} />
      <Stack.Screen
        name="committee/[id]/member-form"
        options={{ title: t('members.form.addTitle'), presentation: 'modal' }}
      />
      <Stack.Screen
        name="committee/[id]/contacts"
        options={{ title: t('contacts.title'), presentation: 'modal' }}
      />
    </Stack>
  );
}
