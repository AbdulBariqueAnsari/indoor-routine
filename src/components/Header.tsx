/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DailyRoutine } from '../types';
import {
  Calendar,
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
  UserCheck,
  UserX,
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
}) => {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
          {/* Brand Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-700 flex items-center justify-center text-white font-bold shadow-xs">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-slate-900 leading-tight">
                  STC, SAP 4th Bn
                </h1>
                {!isAdmin ? (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    <Eye className="w-3 h-3 text-slate-500" />
                    <span>Public View</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <Shield className="w-3 h-3 text-emerald-600" />
                    <span>Admin Mode</span>
                  </span>
                )}
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <Database className="w-2.5 h-2.5 text-blue-600" />
                  <span>Server DB: Active</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Daily Indoor Class Routine Scheduler · 15 Classrooms · 26 Instructors
              </p>
            </div>
          </div>

          {/* Action Tools (Right Zone) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Day Selector */}
            {allRoutines.length > 0 && currentRoutine && (
              <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 text-xs">
                <span className="font-semibold text-slate-500 hidden md:inline">
                  Day:
                </span>
                <select
                  value={currentRoutine.id}
                  onChange={(e) => onSelectRoutine(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                  aria-label="Select Routine Day"
                >
                  {allRoutines
                    .sort((a, b) => b.dayNumber - a.dayNumber)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Day {r.dayNumber} ({r.date}) {r.isLocked ? '🔒' : '✏️'}
                      </option>
                    ))}
                </select>
              </div>
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

            {/* Admin Quick Action Buttons */}
            {isAdmin ? (
              <>
                {/* Recreate Active Routine Button */}
                {isCurrentEditable && onRecreateRoutine && (
                  <button
                    onClick={onRecreateRoutine}
                    className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-2xs transition-colors"
                    title="Recreate current active day routine with modified leaves or exclusions"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                    <span>Recreate Routine</span>
                  </button>
                )}

                {onOpenLeaveManager && (
                  <button
                    onClick={onOpenLeaveManager}
                    className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100 transition-colors"
                    title="Faculty Unavailability Register (Absent / Leave / Duty / Sick)"
                  >
                    <UserX className="w-3.5 h-3.5 text-rose-700" />
                    <span>Unavailable Register</span>
                  </button>
                )}

                {onOpenMasterData && (
                  <button
                    onClick={onOpenMasterData}
                    className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                    title="Master Data Setup (Rooms, Instructors, Papers)"
                  >
                    <Database className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Master Setup</span>
                  </button>
                )}

                {onOpenRulesModal && (
                  <button
                    onClick={onOpenRulesModal}
                    className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                    title="Routine Preparation Checks (Enable / Disable 12 Conditions)"
                  >
                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                    <span>Rules & Checks</span>
                  </button>
                )}

                <button
                  onClick={onOpenGenerator}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs transition-colors"
                  title="Generate New Daily Routine"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>New Routine</span>
                </button>

                <button
                  onClick={onLogout}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-rose-700 hover:bg-rose-50 transition-colors"
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

              {/* Mobile Quick links for Recreate, Leave & Master Setup */}
              <div className="flex items-center gap-1 lg:hidden shrink-0">
                {isCurrentEditable && onRecreateRoutine && (
                  <button
                    onClick={onRecreateRoutine}
                    className="px-2 py-0.5 text-[11px] font-bold rounded border border-amber-300 bg-amber-50 text-amber-900 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3 text-amber-700" />
                    <span>Recreate</span>
                  </button>
                )}
                {onOpenLeaveManager && (
                  <button
                    onClick={onOpenLeaveManager}
                    className="px-2 py-0.5 text-[11px] font-semibold rounded border border-rose-300 bg-rose-50 text-rose-800"
                  >
                    Unavailable
                  </button>
                )}
                {onOpenMasterData && (
                  <button
                    onClick={onOpenMasterData}
                    className="px-2 py-0.5 text-[11px] font-medium rounded border border-slate-300 text-slate-700 bg-white"
                  >
                    Setup
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
    </header>
  );
};
