import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { THEME_STORAGE_KEY } from '../../state/projectSessionReducer.js';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { state, setTheme } = useProjectSession();
  const theme = state.uiState.theme;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const toggle = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      }
    } catch {
      // Ignore localStorage access failures
    }
    setTheme(nextTheme);
  };

  return (
    <button
      onClick={toggle}
      className={`p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${className}`}
      title={isDark ? '切换至浅色模式' : '切换至深色模式'}
      aria-label="切换界面主题"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};
