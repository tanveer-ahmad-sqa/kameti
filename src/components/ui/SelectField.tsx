import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { MIN_TAP_TARGET, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';
import { Button } from './Button';

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
};

export type SelectFieldProps<T extends string | number> = {
  label: string;
  value: T | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  error?: string;
  hint?: string;
  testID?: string;
};

/**
 * A field that opens a full-screen list of options. Used instead of native pickers so it
 * looks and behaves the same on Android and iOS and works with large fonts and screen readers.
 */
export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  error,
  hint,
  testID,
}: SelectFieldProps<T>) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.container}>
      <AppText variant="bodyStrong">{label}</AppText>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? t('common.select')}`}
        accessibilityHint={error ?? hint}
        style={[
          styles.field,
          { backgroundColor: colors.surfaceRaised, borderColor: error ? colors.danger : colors.border },
        ]}
      >
        <AppText style={styles.fieldText} tone={selected ? 'default' : 'muted'}>
          {selected?.label ?? t('common.select')}
        </AppText>
        <AppText tone="muted" importantForAccessibility="no" accessibilityElementsHidden>
          ▾
        </AppText>
      </Pressable>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <AppText variant="heading" style={styles.modalTitle}>
              {label}
            </AppText>
            <Button variant="ghost" label={t('common.cancel')} onPress={() => setOpen(false)} />
          </View>
          <FlatList
            data={options}
            keyExtractor={(option) => String(option.value)}
            // Option lists are short (days, months): render all so screen readers can reach every row.
            initialNumToRender={Math.min(options.length, 60)}
            initialScrollIndex={selected ? Math.max(options.indexOf(selected) - 3, 0) : 0}
            getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={item.label}
                  style={[
                    styles.option,
                    {
                      borderColor: colors.border,
                      backgroundColor: isSelected ? colors.primarySoft : 'transparent',
                    },
                  ]}
                >
                  <AppText variant={isSelected ? 'bodyStrong' : 'body'} style={styles.fieldText}>
                    {item.label}
                  </AppText>
                  {isSelected ? <AppText tone="primary">✓</AppText> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const ROW_HEIGHT = MIN_TAP_TARGET + spacing.sm;

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  field: {
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  fieldText: {
    flex: 1,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: spacing.md,
    paddingEnd: spacing.sm,
    paddingVertical: spacing.sm,
  },
  modalTitle: {
    flex: 1,
  },
  option: {
    minHeight: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
});
