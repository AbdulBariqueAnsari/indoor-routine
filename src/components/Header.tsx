/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { DailyRoutine } from '../types';
import {
  Calendar,
  ChevronDown,
  Database,
  Eye,
  Lock,
  LogIn,
  LogOut,
  PlusCircle,
  Printer,
  RefreshCw,
  Shield,
  Sliders,
  Unlock,
  UserCheck,
  UserX,
  Wrench,
} from 'lucide-react';

interface HeaderProps {
  currentRoutine: DailyRoutine | null;
  allRoutines: DailyRoutine[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSelectRoutine: (routineId: string) => void;
  isAdmin: boolean;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenGenerator: () => void;
  onRecreateRoutine?: () => void;
  onOpenMasterData?: () => void;
  onOpenLeaveManager?: () => void;
  onOpenRulesModal?: () => void;
  onPrint: () => void;
  isCurrentEditable: boolean;
  onToggleLockRoutine?: (routineId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRoutine,
  allRoutines,
  activeTab,
  setActiveTab,
  onSelectRoutine,
  isAdmin,
  onOpenLogin,
  onLogout,
  onOpenGenerator,
  onRecreateRoutine,
  onOpenMasterData,
  onOpenLeaveManager,
  onOpenRulesModal,
  onPrint,
  isCurrentEditable,
  onToggleLockRoutine,
}) => {
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setIsAdminMenuOpen(false);
      }
    };
    if (isAdminMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isAdminMenuOpen]);

  // Navigation tabs for Public & Admin
  const publicNavItems = [
    { id: 'matrix', label: 'Daily Routine Matrix' },
    { id: 'tracker', label: 'Instructor Deployment Tracker' },
  ];

  const adminNavItems = [
    { id: 'matrix', label: 'Daily Routine Matrix' },
    { id: 'tracker', label: 'Instructor Deployment Tracker' },
    { id: 'progress', label: 'Session Counter' },
    { id: 'ledger', label: 'Instructor Ledger' },
    { id: 'teachers', label: 'Instructor Duty' },
    { id: 'mapping', label: 'Instructor Mapping (T1–T26)' },
    { id: 'history', label: 'History & Audit' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs no-print">
      {/* Tier 1: Brand & Control Action Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          {/* Brand Identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-700 flex items-center justify-center text-white font-bold shadow-xs shrink-0">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-slate-900 leading-tight truncate">
                  STC, SAP 4th Bn
                </h1>
                {!isAdmin ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                    <Eye className="w-2.5 h-2.5 text-slate-500" />
                    <span>Public</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                    <Shield className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Admin</span>
                  </span>
                )}
                <span className="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  <Database className="w-2.5 h-2.5 text-blue-600" />
                  <span>DB: Active</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden lg:block truncate">
                Daily Indoor Class Routine Scheduler · 15 Rooms · 26 Instructors
              </p>
            </div>
          </div>

          {/* Action Tools (Right Zone) - Responsive & Non-Overflowing */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Day Selector */}
            {allRoutines.length > 0 && currentRoutine && (
              <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 text-xs">
                <span className="font-semibold text-slate-500 hidden sm:inline">
                  Day:
                </span>
                <select
                  value={currentRoutine.id}
                  onChange={(e) => onSelectRoutine(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-hidden cursor-pointer max-w-[130px] sm:max-w-none truncate"
                  aria-label="Select Routine Day"
                >
                  {allRoutines
                    .sort((a, b) => b.dayNumber - a.dayNumber)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Day {r.dayNumber} ({r.date}) {r.isLocked ? '🔒 [Locked]' : '✏️ [Editable]'}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Admin Quick Lock / Unlock Toggle Button */}
            {isAdmin && currentRoutine && onToggleLockRoutine && (
              <button
                onClick={() => onToggleLockRoutine(currentRoutine.id)}
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg border transition-colors shadow-2xs ${
                  currentRoutine.isLocked
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
                title={
                  currentRoutine.isLocked
                    ? 'Locked & Published to normal users. Click to Unlock for editing (will hide from normal users while unlocked).'
                    : 'Editable / Unlocked Mode (HIDDEN from normal users). Click to Lock and publish to normal users.'
                }
              >
                {currentRoutine.isLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden md:inline">Locked (Published)</span>
                    <span className="md:hidden">Locked</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-amber-700" />
                    <span className="hidden md:inline">Editable (Hidden)</span>
                    <span className="md:hidden">Draft</span>
                  </>
                )}
              </button>
            )}

            {/* Print Action */}
            <button
              onClick={onPrint}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shadow-2xs transition-colors"
              title="Print Timetable Sheet / Save PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Admin Actions */}
            {isAdmin ? (
              <>
                {/* Primary Action: New Routine */}
                <button
                  onClick={onOpenGenerator}
                  className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs transition-colors shrink-0"
                  title="Generate New Daily Routine"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>New Routine</span>
                </button>

                {/* Collapsible Admin Tools Menu */}
                <div className="relative" ref={adminMenuRef}>
                  <button
                    onClick={() => setIsAdminMenuOpen((prev) => !prev)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors shadow-2xs ${
                      isAdminMenuOpen
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                    title="Administrative Tools & Settings"
                  >
                    <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="hidden md:inline">Admin Tools</span>
                    <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isAdminMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Popover */}
                  {isAdminMenuOpen && (
                    <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Management Tools
                      </div>

                      {/* Recreate Routine */}
                      {onRecreateRoutine && (
                        <button
                          onClick={() => {
                            setIsAdminMenuOpen(false);
                            onRecreateRoutine();
                          }}
                          disabled={!isCurrentEditable}
                          className={`w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-amber-50/70 transition-colors ${
                            !isCurrentEditable ? 'opacity-50 cursor-not-allowed' : 'text-slate-800'
                          }`}
                          title={
                            isCurrentEditable
                              ? 'Recreate current active day routine with modified leaves or exclusions'
                              : 'Recreate is only available when the active routine is in Editable/Unlocked mode'
                          }
                        >
                          <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-900">Recreate Routine</div>
                            <div className="text-[10px] text-slate-500">
                              {isCurrentEditable ? 'Re-run constraint solver on active day' : 'Unlocked routine only'}
                            </div>
                          </div>
                        </button>
                      )}

                      {/* Unavailable Register */}
                      {onOpenLeaveManager && (
                        <button
                          onClick={() => {
                            setIsAdminMenuOpen(false);
                            onOpenLeaveManager();
                          }}
                          className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-rose-50/70 text-slate-800 transition-colors"
                        >
                          <UserX className="w-4 h-4 text-rose-600 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-900">Unavailable Register</div>
                            <div className="text-[10px] text-slate-500">Absent / Leave / Duty / Sick status</div>
                          </div>
                        </button>
                      )}

                      {/* Master Setup */}
                      {onOpenMasterData && (
                        <button
                          onClick={() => {
                            setIsAdminMenuOpen(false);
                            onOpenMasterData();
                          }}
                          className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-indigo-50/70 text-slate-800 transition-colors"
                        >
                          <Database className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-900">Master Data Setup</div>
                            <div className="text-[10px] text-slate-500">Rooms, Instructors & Syllabus</div>
                          </div>
                        </button>
                      )}

                      {/* Rules & Checks */}
                      {onOpenRulesModal && (
                        <button
                          onClick={() => {
                            setIsAdminMenuOpen(false);
                            onOpenRulesModal();
                          }}
                          className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-blue-50/70 text-slate-800 transition-colors border-t border-slate-100"
                        >
                          <Sliders className="w-4 h-4 text-blue-600 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-900">Rules & Checks</div>
                            <div className="text-[10px] text-slate-500">24 Rules in 3 Priority Tiers</div>
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Logout Button */}
                <button
                  onClick={onLogout}
                  className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-rose-700 hover:bg-rose-50 transition-colors shrink-0"
                  title="Log out from Admin"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors shadow-2xs"
                title="Login with administrator credentials to make modifications"
              >
                <LogIn className="w-3.5 h-3.5 text-indigo-600" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tier 2: Tab Navigation Bar (Available for BOTH Public and Admin) */}
      <div className="border-t border-slate-200 bg-slate-50/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between overflow-x-auto py-1.5 gap-2 scrollbar-none">
            <nav className="flex items-center gap-1 sm:gap-2">
              {(isAdmin ? adminNavItems : publicNavItems).map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};
