import React, { useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColor } from '../contexts/ThemeContext';
import { cn } from '../lib/cn';

interface ThemeSelectorProps {
  isCollapsed?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ isCollapsed = false }) => {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themes: { value: ThemeColor; label: string; swatch: string }[] = [
    { value: 'violet', label: 'Violet',    swatch: 'bg-violet-600' },
    { value: 'navy',   label: 'Navy Blue', swatch: 'bg-blue-900' },
    { value: 'green',  label: 'Green',     swatch: 'bg-emerald-600' },
  ];

  const currentSwatch = themes.find(t => t.value === theme)?.swatch || 'bg-indigo-500';

  return (
    <div className="relative w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center rounded-lg text-sm transition-colors text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          isCollapsed ? 'justify-center p-1.5' : 'px-3 py-2'
        )}
        title={isCollapsed ? 'Change theme' : ''}
      >
        <span className="relative inline-flex items-center justify-center">
          <Palette className="h-[18px] w-[18px]" />
          <span className={cn('absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white', currentSwatch)} />
        </span>
        {!isCollapsed && <span className="ml-3 font-medium">Theme</span>}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className={cn(
            'absolute w-52 bg-white rounded-xl shadow-xl border border-slate-200 z-20 overflow-hidden animate-scale-in',
            isCollapsed ? 'left-full ml-2 bottom-0' : 'left-0 right-0 bottom-full mb-2'
          )}>
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Color Theme</p>
            </div>
            <div className="p-1.5">
              {themes.map((opt) => {
                const active = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setTheme(opt.value); setIsOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors',
                      active ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <span className={cn('h-4 w-4 rounded-full ring-2 ring-white shadow-sm', opt.swatch)} />
                    <span className="flex-1 text-left font-medium">{opt.label}</span>
                    {active && <Check className="h-4 w-4 text-emerald-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
