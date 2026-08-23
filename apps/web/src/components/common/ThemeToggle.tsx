import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { state, setTheme } = useProjectSession();
  const isDark = state.uiState.theme === 'dark';

  const toggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggle}
      className={`p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${className}`}
      title={isDark ? '切换至亮色模式' : '切换至暗色模式'}
      aria-label="切换界面主题"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};
