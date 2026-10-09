import { forwardRef, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { MAX_FONT_SCALE, MIN_TAP_TARGET, radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  hint?: string;
  /** Rendered before the input, e.g. a fixed "+92" prefix. */
  prefix?: ReactNode;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, prefix, ...inputProps },
  ref,
) {
  const { colors } = useTheme();
  const describedBy = error ?? hint;

  return (
    <View style={styles.container}>
      <AppText variant="bodyStrong" nativeID={`${label}-label`}>
        {label}
      </AppText>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      >
        {prefix}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={describedBy}
          aria-invalid={Boolean(error)}
          placeholderTextColor={colors.textMuted}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.input, { color: colors.text }]}
          {...inputProps}
        />
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  inputRow: {
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.sm,
    textAlign: 'auto',
  },
});
