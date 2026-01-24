import React, { useState } from 'react';
import { Palette } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColor } from '../contexts/ThemeContext';

interface ThemeSelectorProps {
  isCollapsed?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ isCollapsed = false }) => {
  const { theme, setTheme, themeColors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themes: { value: ThemeColor; label: string; color: string }[] = [
    { value: 'violet', label: 'Violet', color: 'bg-violet-600' },
    { value: 'navy', label: 'Navy Blue', color: 'bg-blue-900' },
    { value: 'green', label: 'Green', color: 'bg-green-600' },
  ];

  return (
    <div className="relative w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 ${themeColors.primary} ${themeColors.primaryHover} text-white rounded-lg text-sm font-medium transition-colors`}
        title={isCollapsed ? 'Change Theme' : ''}
      >
        <Palette className="h-5 w-5" />
        {!isCollapsed && <span className="ml-3">Theme</span>}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className={`absolute ${isCollapsed ? 'right-full mr-2 bottom-0' : 'left-0 bottom-full mb-2'} w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20`}>
            <div className="p-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 py-1 mb-1">
                Color Theme
              </div>
              {themes.map((themeOption) => (
                <button
                  key={themeOption.value}
                  onClick={() => {
                    setTheme(themeOption.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center px-3 py-2 rounded-md text-sm transition-colors ${
                    theme === themeOption.value
                      ? `${themeColors.primaryLight} ${themeColors.accent} font-medium`
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full ${themeOption.color} mr-3 ${
                      theme === themeOption.value ? `ring-2 ring-offset-2 ${themeColors.accent.replace('text-', 'ring-')}` : ''
                    }`}
                  />
                  {themeOption.label}
                  {theme === themeOption.value && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

