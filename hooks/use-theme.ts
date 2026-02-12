'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme: Theme = stored === 'dark' ? 'dark' : 'light';
    setTheme(nextTheme);
    applyThemeClass(nextTheme);
  }, []);

  const setAndPersistTheme = useCallback((nextTheme: Theme) => {
    setTheme(nextTheme);
    applyThemeClass(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setAndPersistTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setAndPersistTheme, theme]);

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
  };
}
