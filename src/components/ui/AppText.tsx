import { Text, type TextProps } from 'react-native';

import { MAX_FONT_SCALE, typography, type TypographyVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Tone = 'default' | 'muted' | 'primary' | 'danger' | 'success' | 'warning';

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  tone?: Tone;
};

/** All text goes through this so dynamic type, colors and RTL alignment stay consistent. */
export function AppText({ variant = 'body', tone = 'default', style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const color = {
    default: colors.text,
    muted: colors.textMuted,
    primary: colors.primary,
    danger: colors.danger,
    success: colors.success,
    warning: colors.warning,
  }[tone];

  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      accessibilityRole={variant === 'title' || variant === 'heading' ? 'header' : undefined}
      style={[typography[variant], { color, textAlign: 'auto' }, style]}
      {...rest}
    />
  );
}
