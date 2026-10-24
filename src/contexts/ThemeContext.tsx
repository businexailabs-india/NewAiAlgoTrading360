import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface ThemeSettings {
  theme: 'dark' | 'light';
  chartColorScheme: 'green-red' | 'blue-orange' | 'purple-yellow';
}

interface ThemeContextType {
  theme: 'dark' | 'light';
  chartColorScheme: 'green-red' | 'blue-orange' | 'purple-yellow';
  setTheme: (theme: 'dark' | 'light') => void;
  setChartColorScheme: (scheme: 'green-red' | 'blue-orange' | 'purple-yellow') => void;
  getChartColors: () => { positive: string; negative: string };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const SETTINGS_KEY = 'smarttrade_settings_v2';
const LEGACY_SETTINGS_KEY = 'smarttrade_settings';

function readStoredAppearance(): Partial<ThemeSettings> {
  try {
    for (const key of [SETTINGS_KEY, LEGACY_SETTINGS_KEY]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const appearance = parsed?.appearance || {};
      return {
        theme: appearance.theme === 'dark' || appearance.theme === 'light' ? appearance.theme : undefined,
        chartColorScheme:
          appearance.chartColorScheme === 'blue-orange' ||
          appearance.chartColorScheme === 'purple-yellow' ||
          appearance.chartColorScheme === 'green-red'
            ? appearance.chartColorScheme
            : undefined
      };
    }
  } catch {
    /* ignore */
  }
  return {};
}

function persistAppearance(patch: Partial<ThemeSettings>) {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.appearance = { ...(parsed.appearance || {}), ...patch };
    parsed.lastUpdated = new Date().toISOString();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const stored = readStoredAppearance();
  const [theme, setThemeState] = useState<'dark' | 'light'>(stored.theme || 'light');
  const [chartColorScheme, setChartColorSchemeState] = useState<
    'green-red' | 'blue-orange' | 'purple-yellow'
  >(stored.chartColorScheme || 'green-red');

  const setTheme = useCallback((next: 'dark' | 'light') => {
    setThemeState(next);
    persistAppearance({ theme: next });
  }, []);

  const setChartColorScheme = useCallback((scheme: 'green-red' | 'blue-orange' | 'purple-yellow') => {
    setChartColorSchemeState(scheme);
    persistAppearance({ chartColorScheme: scheme });
  }, []);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const getChartColors = () => {
    switch (chartColorScheme) {
      case 'blue-orange':
        return { positive: '#3b82f6', negative: '#f97316' };
      case 'purple-yellow':
        return { positive: '#a855f7', negative: '#eab308' };
      case 'green-red':
      default:
        return { positive: '#10b981', negative: '#ef4444' };
    }
  };

  const value = {
    theme,
    chartColorScheme,
    setTheme,
    setChartColorScheme,
    getChartColors
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
