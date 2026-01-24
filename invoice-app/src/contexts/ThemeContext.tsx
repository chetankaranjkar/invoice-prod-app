import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type ThemeColor = 'violet' | 'navy' | 'green';

interface ThemeContextType {
  theme: ThemeColor;
  setTheme: (theme: ThemeColor) => void;
  themeColors: {
    primary: string;
    primaryHover: string;
    primaryLight: string;
    primaryDark: string;
    secondary: string;
    accent: string;
    success: string;
    successHover: string;
    successLight: string;
    danger: string;
    dangerHover: string;
    dangerLight: string;
    info: string;
    infoHover: string;
    infoLight: string;
  };
  focusRing: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const themeConfig: Record<ThemeColor, ThemeContextType['themeColors']> = {
  violet: {
    primary: 'bg-violet-600',
    primaryHover: 'hover:bg-violet-700',
    primaryLight: 'bg-violet-50',
    primaryDark: 'bg-violet-800',
    secondary: 'bg-violet-100',
    accent: 'text-violet-600',
    success: 'bg-green-600',
    successHover: 'hover:bg-green-700',
    successLight: 'bg-green-100',
    danger: 'bg-red-500',
    dangerHover: 'hover:bg-red-600',
    dangerLight: 'bg-red-50',
    info: 'bg-blue-600',
    infoHover: 'hover:bg-blue-700',
    infoLight: 'bg-blue-100',
  },
  navy: {
    primary: 'bg-blue-900',
    primaryHover: 'hover:bg-blue-950',
    primaryLight: 'bg-blue-50',
    primaryDark: 'bg-blue-950',
    secondary: 'bg-blue-100',
    accent: 'text-blue-900',
    success: 'bg-green-600',
    successHover: 'hover:bg-green-700',
    successLight: 'bg-green-100',
    danger: 'bg-red-500',
    dangerHover: 'hover:bg-red-600',
    dangerLight: 'bg-red-50',
    info: 'bg-blue-600',
    infoHover: 'hover:bg-blue-700',
    infoLight: 'bg-blue-100',
  },
  green: {
    primary: 'bg-green-600',
    primaryHover: 'hover:bg-green-700',
    primaryLight: 'bg-green-50',
    primaryDark: 'bg-green-800',
    secondary: 'bg-green-100',
    accent: 'text-green-600',
    success: 'bg-emerald-600',
    successHover: 'hover:bg-emerald-700',
    successLight: 'bg-emerald-100',
    danger: 'bg-red-500',
    dangerHover: 'hover:bg-red-600',
    dangerLight: 'bg-red-50',
    info: 'bg-blue-600',
    infoHover: 'hover:bg-blue-700',
    infoLight: 'bg-blue-100',
  },
};

// Focus ring classes for each theme
const focusRingClasses: Record<ThemeColor, string> = {
  violet: 'focus:ring-violet-500 focus:border-violet-500',
  navy: 'focus:ring-blue-900 focus:border-blue-900',
  green: 'focus:ring-green-500 focus:border-green-500',
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeColor>(() => {
    // Load theme from localStorage or default to violet
    const savedTheme = localStorage.getItem('theme') as ThemeColor;
    return savedTheme && ['violet', 'navy', 'green'].includes(savedTheme)
      ? savedTheme
      : 'violet';
  });

  const setTheme = (newTheme: ThemeColor) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    // Update document class for CSS variables
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    // Apply theme on mount
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const value: ThemeContextType = {
    theme,
    setTheme,
    themeColors: themeConfig[theme],
    focusRing: focusRingClasses[theme],
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

