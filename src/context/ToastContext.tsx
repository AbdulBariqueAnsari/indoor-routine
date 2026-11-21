/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  title: string;
  caption?: string;
  type?: ToastType;
  duration?: number; // ms, default 3800
}

interface ToastItem extends ToastOptions {
  id: string;
  isDismissing?: boolean;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  dismissToast: (id?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentToast, setCurrentToast] = useState<ToastItem | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  const dismissToast = useCallback((id?: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    setCurrentToast((prev) => {
      if (!prev) return null;
      if (id && prev.id !== id) return prev;
      return { ...prev, isDismissing: true };
    });

    exitTimerRef.current = setTimeout(() => {
      setCurrentToast(null);
      exitTimerRef.current = null;
    }, 220);
  }, []);

  const showToast = useCallback(
    ({ title, caption, type = 'success', duration = 3800 }: ToastOptions) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }

      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, title, caption, type, duration, isDismissing: false };

      setCurrentToast(newToast);

      timerRef.current = setTimeout(() => {
        dismissToast(id);
      }, duration);
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}

      {/* Floating Bottom Caption Notification */}
      {currentToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 z-[999999] pointer-events-auto flex flex-col items-center max-w-[94%] sm:max-w-lg w-full px-2 ${
            currentToast.isDismissing ? 'toast-animate-out' : 'toast-animate-in'
          }`}
        >
          <div className="w-full relative overflow-hidden flex items-center gap-3.5 px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-900/95 text-white border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md">
            {/* Left Status Icon */}
            <div className="shrink-0">
              {currentToast.type === 'success' && (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              {currentToast.type === 'info' && (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Info className="w-5 h-5" />
                </div>
              )}
              {currentToast.type === 'warning' && (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              {currentToast.type === 'error' && (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <AlertCircle className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* Middle Content: Title & Caption */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                  {currentToast.title}
                </h4>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  SQL DB Live
                </span>
              </div>
              {currentToast.caption && (
                <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                  {currentToast.caption}
                </p>
              )}
            </div>

            {/* Right Dismiss Button */}
            <button
              onClick={() => dismissToast(currentToast.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer shrink-0"
              title="Close notification"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Subtle bottom animated border accent */}
            <div
              className={`absolute bottom-0 left-0 right-0 h-[2.5px] ${
                currentToast.type === 'success'
                  ? 'bg-emerald-500'
                  : currentToast.type === 'info'
                  ? 'bg-blue-500'
                  : currentToast.type === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
            />
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
