'use client';

import { useTheme } from '../hooks/use-theme';

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`theme-toggle${isDark ? ' active' : ''}`}
      onClick={toggleTheme}
      title="Toggle dark mode"
      aria-label="Toggle dark mode"
      aria-pressed={isDark}
    >
      {isDark ? '☀️' : '◐'}
    </button>
  );
}
