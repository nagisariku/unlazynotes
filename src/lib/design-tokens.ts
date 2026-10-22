/**
 * Ollama Design System Tokens
 * Source of truth: ollama.design.md
 * 
 * Strict Token Governance:
 * - Only use tokens defined in this file / DESIGN.md
 * - Do not add custom ad-hoc colors, radius, or styles
 */

export const colors = {
  primary: '#000000',
  'on-primary': '#ffffff',
  ink: '#000000',
  'ink-deep': '#090909',
  charcoal: '#525252',
  body: '#737373',
  mute: '#a3a3a3',
  canvas: '#ffffff',
  'surface-soft': '#fafafa',
  'surface-card': '#ffffff',
  hairline: '#e5e5e5',
  'hairline-strong': '#d4d4d4',
  'on-dark': '#ffffff',
  'on-dark-mute': 'rgba(255,255,255,0.7)',
  'surface-dark': '#171717',
  'focus-ring': 'rgba(59,130,246,0.5)',
  link: '#000000',
  'link-mute': '#737373',
  'terminal-red': '#ff5f56',
  'terminal-yellow': '#ffbd2e',
  'terminal-green': '#27c93f',
} as const;

export type ColorToken = keyof typeof colors;

export const fontFamilies = {
  display: 'SF Pro Rounded, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
} as const;

export const typography = {
  'display-xl': {
    fontFamily: fontFamilies.display,
    fontSize: '36px',
    fontWeight: 500,
    lineHeight: 1.11,
    letterSpacing: '0px',
  },
  'display-lg': {
    fontFamily: fontFamilies.display,
    fontSize: '30px',
    fontWeight: 500,
    lineHeight: 1.2,
    letterSpacing: '0px',
  },
  'heading-lg': {
    fontFamily: fontFamilies.display,
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: 1.33,
    letterSpacing: '0px',
  },
  'heading-md': {
    fontFamily: fontFamilies.sans,
    fontSize: '20px',
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: '0px',
  },
  'heading-sm': {
    fontFamily: fontFamilies.sans,
    fontSize: '18px',
    fontWeight: 500,
    lineHeight: 1.56,
    letterSpacing: '0px',
  },
  'body-md': {
    fontFamily: fontFamilies.sans,
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '0px',
  },
  'body-strong': {
    fontFamily: fontFamilies.sans,
    fontSize: '16px',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0px',
  },
  'body-sm': {
    fontFamily: fontFamilies.sans,
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.43,
    letterSpacing: '0px',
  },
  'body-sm-strong': {
    fontFamily: fontFamilies.sans,
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: 1.43,
    letterSpacing: '0px',
  },
  'caption-sm': {
    fontFamily: fontFamilies.sans,
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: 1.33,
    letterSpacing: '0px',
  },
  'code-md': {
    fontFamily: fontFamilies.mono,
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '0px',
  },
  'code-sm': {
    fontFamily: fontFamilies.mono,
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.43,
    letterSpacing: '0px',
  },
  'button-md': {
    fontFamily: fontFamilies.sans,
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: '0px',
  },
} as const;

export type TypographyToken = keyof typeof typography;

export const rounded = {
  none: '0px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  full: '9999px',
} as const;

export type RoundedToken = keyof typeof rounded;

export const spacing = {
  xxs: '2px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
  section: '88px',
} as const;

export type SpacingToken = keyof typeof spacing;

export const components = {
  'button-primary': {
    backgroundColor: colors.primary,
    textColor: colors['on-primary'],
    typography: typography['button-md'],
    rounded: rounded.full,
    padding: '8px 20px',
    height: '36px',
  },
  'button-primary-active': {
    backgroundColor: colors['ink-deep'],
    textColor: colors['on-primary'],
    typography: typography['button-md'],
    rounded: rounded.full,
  },
  'button-secondary': {
    backgroundColor: colors.canvas,
    textColor: colors.ink,
    typography: typography['button-md'],
    rounded: rounded.full,
    padding: '8px 20px',
    height: '36px',
  },
  'button-pill-on-dark': {
    backgroundColor: colors.canvas,
    textColor: colors.ink,
    typography: typography['button-md'],
    rounded: rounded.full,
    padding: '8px 20px',
  },
  'button-disabled': {
    backgroundColor: colors['surface-soft'],
    textColor: colors.mute,
    rounded: rounded.full,
  },
  'search-pill': {
    backgroundColor: colors['surface-soft'],
    textColor: colors.ink,
    typography: typography['body-sm'],
    rounded: rounded.full,
    padding: '8px 16px',
    height: '36px',
  },
  'search-pill-focused': {
    backgroundColor: colors.canvas,
    textColor: colors.ink,
    rounded: rounded.full,
  },
  'text-input': {
    backgroundColor: colors.canvas,
    textColor: colors.ink,
    typography: typography['body-md'],
    rounded: rounded.full,
    padding: '8px 16px',
    height: '40px',
  },
  'text-input-focused': {
    backgroundColor: colors.canvas,
    textColor: colors.ink,
    rounded: rounded.full,
  },
  'install-snippet': {
    backgroundColor: colors['surface-soft'],
    textColor: colors.ink,
    typography: typography['code-md'],
    rounded: rounded.full,
    padding: '12px 20px',
    height: '48px',
  },
  'command-tag': {
    backgroundColor: colors['surface-soft'],
    textColor: colors.ink,
    typography: typography['code-sm'],
    rounded: rounded.full,
    padding: '6px 12px',
  },
  'terminal-card': {
    backgroundColor: colors.canvas,
    textColor: colors.ink,
    typography: typography['code-sm'],
    rounded: rounded.lg,
    padding: '16px',
  },
  'terminal-traffic-lights': {
    rounded: rounded.full,
    size: '12px',
  },
  'pricing-card': {
    backgroundColor: colors.canvas,
    textColor: colors.ink,
    typography: typography['body-md'],
    rounded: rounded.lg,
    padding: '32px',
  },
  'pricing-card-dark': {
    backgroundColor: colors['surface-dark'],
    textColor: colors['on-dark'],
    typography: typography['body-md'],
    rounded: rounded.lg,
    padding: '32px',
  },
  'feature-bullet': {
    textColor: colors.charcoal,
    typography: typography['body-sm'],
  },
  'faq-row': {
    backgroundColor: colors.canvas,
    textColor: colors.ink,
    typography: typography['body-md'],
    rounded: rounded.none,
    padding: '16px 0px',
  },
  'link-inline': {
    textColor: colors.ink,
    typography: typography['body-md'],
  },
  'link-mute': {
    textColor: colors.body,
    typography: typography['body-sm'],
  },
  'primary-nav': {
    backgroundColor: colors.canvas,
    textColor: colors.ink,
    typography: typography['body-sm-strong'],
    rounded: rounded.none,
    height: '56px',
  },
  'footer-section': {
    backgroundColor: colors.canvas,
    textColor: colors.body,
    typography: typography['caption-sm'],
    rounded: rounded.none,
    padding: '32px 24px',
  },
  'cta-strip-dark': {
    backgroundColor: colors['surface-dark'],
    textColor: colors['on-dark'],
    typography: typography['heading-lg'],
    rounded: rounded.lg,
    padding: '24px 32px',
  },
} as const;
