/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ConflictInfo, DailyRoutine } from '../types';
import { BuildingConflictInfo } from '../utils/routineValidator';
import { AlertCircle, AlertTriangle, Building2, Lock, Printer, ShieldCheck, UserCheck, UserMinus, UserX } from 'lucide-react';

interface ConflictBannerProps {
  routine: DailyRoutine;
  conflicts: ConflictInfo[];
  buildingConflicts?: BuildingConflictInfo[];
  absentViolations: { teacherId: string; teacherName: string; period: number; roomId: string }[];
  isEditable: boolean;
  isAdmin: boolean;
  onOpenLeaveManager?: () => void;
  onPrint?: () => void;
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({
  routine,
  conflicts,
  buildingConflicts = [],
  absentViolations,
  isEditable,
  isAdmin,
  onOpenLeaveManager,
  onPrint,
}) => {
  const hasErrors = conflicts.length > 0 || absentViolations.length > 0 || buildingConflicts.length > 0;
  const absentCount = routine.absentTeacherIds.length;
  const activeCount = 26 - absentCount;

  return (
    <div className="space-y-2 mb-4">
      {/* Primary Verification Status Bar */}
      <div
        className={`rounded-lg border px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
          hasErrors
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}
      >
        <div className="flex items-start sm:items-center gap-2.5">
          {hasErrors ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
          )}
          <div>
            <div className="font-semibold flex items-center gap-2">
              <span>
                {hasErrors
                  ? '⚠️ Technical Double-Booking Conflicts Detected'
                  : 'Verified: 0 Conflicts · All 75 Slots Validated'}
              </span>
              <span className="text-slate-400 font-normal">·</span>
              <span className="font-normal text-slate-700">
                Day {routine.dayNumber} ({routine.date})
              </span>
              <span className="text-slate-400 font-normal">·</span>
              <span className="font-mono text-emerald-700 font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                5 Periods × 40 min (09:40 - 13:30)
              </span>
            </div>
            <p className="text-slate-600 mt-0.5">
              {hasErrors
                ? `${conflicts.length} instructor(s) scheduled in multiple rooms simultaneously.`
                : `All 15 rooms operating with zero double-bookings. ${activeCount} instructors active, ${absentCount} on leave.`}
            </p>
          </div>
        </div>

        {/* Action Controls & Badges */}
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
          {/* Quick Print Button */}
          {onPrint && (
            <button
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold shadow-2xs transition-colors"
              title="Print Timetable Sheet / Save PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Timetable</span>
            </button>
          )}

          {/* Admin Emergency Leave & Substitute Manager */}
          {isAdmin && onOpenLeaveManager && (
            <button
              onClick={onOpenLeaveManager}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 font-semibold shadow-xs transition-colors"
              title="Mark teachers on leave, view available pool, and reassign substitutes"
            >
              <UserMinus className="w-3.5 h-3.5" />
              <span>Manage Leave & Substitutes</span>
            </button>
          )}

          {/* Lock / Editable Status */}
          {isAdmin ? (
            isEditable ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 font-medium border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                <span>Active (Editable)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-200 text-slate-700 font-medium">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Locked Audit</span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-600 font-medium">
              <span>Public Timetable (Read-Only)</span>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Conflict List if any */}
      {conflicts.length > 0 && (
        <div className="rounded-lg border border-rose-300 bg-rose-100/70 p-3 text-xs text-rose-950 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Conflict Details:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-rose-900">
            {conflicts.map((c, i) => (
              <li key={i}>
                <span className="font-semibold">{c.teacherName}</span> is assigned in Period {c.period} simultaneously to rooms:{' '}
                <span className="font-semibold underline">{c.roomNames.join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Absent Violations if any */}
      {absentViolations.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <UserX className="w-4 h-4 text-amber-700" />
            <span>Absent Instructors Assigned:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-900">
            {absentViolations.map((v, i) => (
              <li key={i}>
                <span className="font-semibold">{v.teacherName}</span> (Period {v.period}, Room {v.roomId}) is marked on leave today.
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Campus Building Transition Violations if any */}
      {buildingConflicts.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-amber-700" />
            <span>Campus Building Transition Conflict (Mandatory 1-Period Gap Required):</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-900">
            {buildingConflicts.map((b, i) => (
              <li key={i}>
                <span className="font-semibold">{b.teacherName}</span> switches from {b.fromBuilding} Building ({b.fromRoomName}, Period {b.fromPeriod}) to {b.toBuilding} Building ({b.toRoomName}, Period {b.toPeriod}) without the mandatory 1-period transition gap.
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
