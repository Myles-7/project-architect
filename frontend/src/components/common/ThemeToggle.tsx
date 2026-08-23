import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  darkMode: boolean;
  setDarkMode: (val: boolean | ((prev: boolean) => boolean)) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ darkMode, setDarkMode }) => {
  return (
    <button
      onClick={() => setDarkMode((prev) => !prev)}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-md transition-all"
      title={darkMode ? '切换到暖白中性主题 (Linear Teardown Light)' : '切换到暗色工作台主题 (Linear Dark)'}
    >
      {darkMode ? (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px]">暖白浅色</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-zinc-600" />
          <span className="text-[11px]">暗色模式</span>
        </>
      )}
    </button>
  );
};
