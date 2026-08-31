import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ResponsiveDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  side?: 'left' | 'right';
  width?: string;
  children: React.ReactNode;
  'aria-label'?: string;
  triggerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export const ResponsiveDrawer: React.FC<ResponsiveDrawerProps> = ({
  isOpen,
  onClose,
  title,
  side = 'right',
  width = 'w-80 sm:w-96',
  children,
  'aria-label': ariaLabel,
  triggerRef,
  className = '',
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Focus trap & Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element to restore upon close
    if (document.activeElement instanceof HTMLElement) {
      previouslyFocusedElementRef.current = document.activeElement;
    }

    const drawerEl = drawerRef.current;
    if (!drawerEl) return;

    // Auto-focus first focusable element or drawer itself
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusables = drawerEl.querySelectorAll<HTMLElement>(focusableSelector);
    if (focusables.length > 0) {
      focusables[0]?.focus();
    } else {
      drawerEl.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const currentFocusables = drawerEl.querySelectorAll<HTMLElement>(focusableSelector);
        if (currentFocusables.length === 0) return;

        const firstElement = currentFocusables[0]!;
        const lastElement = currentFocusables[currentFocusables.length - 1]!;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Restore focus
      if (triggerRef?.current) {
        triggerRef.current.focus();
      } else if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const sideClasses =
    side === 'left'
      ? 'left-0 border-r animate-in slide-in-from-left duration-200'
      : 'right-0 border-l animate-in slide-in-from-right duration-200';

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title || '抽屉面板'}
        tabIndex={-1}
        className={`fixed inset-y-0 ${sideClasses} ${width} max-w-full bg-[#FAF9F6] dark:bg-[#121316] border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col z-50 focus:outline-none ${className}`}
      >
        {/* Header */}
        <div className="h-12 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white/60 dark:bg-[#17181D]/60 backdrop-blur-md">
          <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
            {title || '面板详情'}
          </h3>
          <button
            onClick={onClose}
            aria-label="关闭抽屉"
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer min-touch-target flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};
