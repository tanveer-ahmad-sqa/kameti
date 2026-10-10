import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TAP_TARGET, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';

export type RadioOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

export type RadioGroupProps<T extends string> = {
  label: string;
  value: T;
  options: RadioOption<T>[];
  onChange: (value: T) => void;
  testID?: string;
};

/** Large, card-style radio options with an explanation under each choice. */
export function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  testID,
}: RadioGroupProps<T>) {
  const { colors } = useTheme();

  return (
    <View style={styles.container} accessibilityRole="radiogroup" accessibilityLabel={label} testID={testID}>
      <AppText variant="bodyStrong">{label}</AppText>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            accessibilityLabel={option.label}
            accessibilityHint={option.description}
            style={[
              styles.option,
              {
                borderColor: checked ? colors.primary : colors.border,
                backgroundColor: checked ? colors.primarySoft : colors.surfaceRaised,
              },
            ]}
          >
            <View
              style={[styles.dot, { borderColor: checked ? colors.primary : colors.textMuted }]}
              importantForAccessibility="no-hide-descendants"
            >
              {checked ? <View style={[styles.dotInner, { backgroundColor: colors.primary }]} /> : null}
            </View>
            <View style={styles.text}>
              <AppText variant="bodyStrong">{option.label}</AppText>
              {option.description ? (
                <AppText variant="caption" tone="muted">
                  {option.description}
                </AppText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  option: {
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
