import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [chartColorScheme, setChartColorScheme] = useState<'green-red' | 'blue-orange' | 'purple-yellow'>('green-red');

  // Load theme from settings on mount
  useEffect(() => {
    try {
      const settings = localStorage.getItem('smarttrade_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        if (parsed.appearance?.theme) {
          setTheme(parsed.appearance.theme);
        }
        if (parsed.appearance?.chartColorScheme) {
          setChartColorScheme(parsed.appearance.chartColorScheme);
        }
      }
    } catch (error) {
      console.error('Error loading theme settings:', error);
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Get chart colors based on scheme
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

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
