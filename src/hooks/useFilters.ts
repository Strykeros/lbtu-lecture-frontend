import { useEffect, useState } from 'react';

const DIRECTION_KEY = 'lbtu-direction-filter';
const THEME_KEY = 'lbtu-theme';

export type ThemePreference = 'light' | 'dark' | 'system';
/** `all` or direction code (e.g. BiznVUzn) — scoped by selected program */
export type DirectionFilter = 'all' | string;

export function useFilters() {
  const [direction, setDirectionState] = useState<DirectionFilter>(() => {
    return localStorage.getItem(DIRECTION_KEY) ?? 'all';
  });

  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    return 'system';
  });

  const setDirection = (next: DirectionFilter) => {
    setDirectionState(next);
    localStorage.setItem(DIRECTION_KEY, next);
  };

  const setTheme = (next: ThemePreference) => {
    setThemeState(next);
    localStorage.setItem(THEME_KEY, next);
  };

  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) => {
      root.dataset.theme = dark ? 'dark' : 'light';
    };

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mq.matches);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    apply(theme === 'dark');
  }, [theme]);

  return {
    direction,
    setDirection,
    theme,
    setTheme,
  };
}
