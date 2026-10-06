import { useSettings } from '@/features/tasks/store';

import { THEMES, type Theme } from './tokens';

/**
 * Resolves the active theme. Falls back to Midnight if persisted settings carry
 * a theme name this build does not know about (e.g. after a rename), so a bad
 * value can never render an unstyled app.
 */
export function useTheme(): Theme {
  const settings = useSettings();
  return THEMES[settings.theme] ?? THEMES.midnight;
}
