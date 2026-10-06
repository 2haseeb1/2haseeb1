/**
 * Design tokens for Blink.
 *
 * Deliberately dependency-free: no theme library, no context provider boilerplate
 * beyond a tiny hook. Blink ships dark-first with three accents plus one light
 * theme, because "dark mode" is part of the product promise, not an afterthought.
 */

export type ThemeName = 'midnight' | 'forest' | 'ember' | 'paper';

export interface Theme {
  name: ThemeName;
  label: string;
  isDark: boolean;
  /** App background */
  bg: string;
  /** Cards sitting on the background */
  surface: string;
  /** Cards sitting on top of other cards (e.g. Now Card) */
  surfaceRaised: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  /** Low-contrast accent wash used for selected chips / icon backgrounds */
  accentSoft: string;
  onAccent: string;
  success: string;
  danger: string;
  warning: string;
  shadow: string;
}

export const THEMES: Record<ThemeName, Theme> = {
  midnight: {
    name: 'midnight',
    label: 'Midnight',
    isDark: true,
    bg: '#0A0D14',
    surface: '#131824',
    surfaceRaised: '#1B2131',
    border: '#262E42',
    text: '#F2F5FA',
    textDim: '#A7B1C6',
    textFaint: '#5D6784',
    accent: '#7C8CFF',
    accentSoft: '#212A4E',
    onAccent: '#080B11',
    success: '#4ADE80',
    danger: '#FF6B6B',
    warning: '#FBBF24',
    shadow: '#000000',
  },
  forest: {
    name: 'forest',
    label: 'Forest',
    isDark: true,
    bg: '#07110D',
    surface: '#0E1C16',
    surfaceRaised: '#15271F',
    border: '#1F3A2E',
    text: '#EFF7F2',
    textDim: '#9DBBAD',
    textFaint: '#5A7A6B',
    accent: '#4ADE80',
    accentSoft: '#153425',
    onAccent: '#04120A',
    success: '#4ADE80',
    danger: '#FF7A6B',
    warning: '#FCD34D',
    shadow: '#000000',
  },
  ember: {
    name: 'ember',
    label: 'Ember',
    isDark: true,
    bg: '#120C08',
    surface: '#1D1410',
    surfaceRaised: '#2A1D15',
    border: '#3C2A1E',
    text: '#FBF4EE',
    textDim: '#C4A895',
    textFaint: '#84675A',
    accent: '#FF9F45',
    accentSoft: '#3A2413',
    onAccent: '#150C05',
    success: '#5CD68A',
    danger: '#FF7B6B',
    warning: '#FBBF24',
    shadow: '#000000',
  },
  paper: {
    name: 'paper',
    label: 'Paper',
    isDark: false,
    bg: '#F7F7F5',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    border: '#E4E4E0',
    text: '#14161A',
    textDim: '#5A5F6B',
    textFaint: '#9AA0AC',
    accent: '#4F46E5',
    accentSoft: '#E8E7FD',
    onAccent: '#FFFFFF',
    success: '#16A34A',
    danger: '#DC2626',
    warning: '#D97706',
    shadow: '#0A0D14',
  },
};

export const THEME_LIST: Theme[] = [
  THEMES.midnight,
  THEMES.forest,
  THEMES.ember,
  THEMES.paper,
];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

export const font = {
  display: 34,
  title: 26,
  h2: 20,
  body: 16,
  small: 14,
  caption: 12,
} as const;

/** Minimum tap target (Apple HIG 44pt / Material 48dp). */
export const HIT = 44;
