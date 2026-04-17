import type { ThemeMode } from '../stores/theme'

export function resolveTheme(
  mode: ThemeMode,
  colorScheme: 'light' | 'dark' | null | undefined,
): 'light' | 'dark' {
  return mode === 'system' ? (colorScheme === 'dark' ? 'dark' : 'light') : mode
}
