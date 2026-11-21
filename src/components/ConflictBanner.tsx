/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ConflictInfo, DailyRoutine } from '../types';
import { BuildingConflictInfo } from '../utils/routineValidator';
import { AlertCircle, AlertTriangle, Building2, ChevronDown, UserX } from 'lucide-react';

interface ConflictBannerProps {
  routine: DailyRoutine;
  conflicts: ConflictInfo[];
  buildingConflicts?: BuildingConflictInfo[];
  absentViolations: { teacherId: string; teacherName: string; period: number; roomId: string }[];
  isEditable?: boolean;
  isAdmin?: boolean;
  totalTeachers?: number;
  onOpenLeaveManager?: () => void;
  onPrint?: () => void;
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({
  routine,
  conflicts,
  buildingConflicts = [],
  absentViolations,
}) => {
  // Building change allowed between Period 3 and Period 4 (recess break)
  const validBuildingConflicts = buildingConflicts.filter(
    (b) => !(b.fromPeriod === 3 && b.toPeriod === 4)
  );

  const hasDoubleBooking = conflicts.length > 0;
  const hasAbsentViolations = absentViolations.length > 0;
  const hasBuildingConflicts = validBuildingConflicts.length > 0;
  const hasErrors = hasDoubleBooking || hasAbsentViolations || hasBuildingConflicts;

  const [isDoubleBookingExpanded, setIsDoubleBookingExpanded] = useState(true);
  const [isAbsentExpanded, setIsAbsentExpanded] = useState(true);
  const [isTransitionExpanded, setIsTransitionExpanded] = useState(false);

  // If zero errors, banner does NOT appear at all
  if (!hasErrors) {
    return null;
  }

  return (
    <div className="space-y-1.5 mb-3 animate-fade-in-up">
      {/* Primary Warning Status Bar (Compact, No bulky buttons) */}
      <div className="rounded-lg border border-rose-200 bg-rose-50/90 px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] text-rose-950">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <div className="font-semibold flex flex-wrap items-center gap-1.5">
            <span className="text-rose-900 font-bold">
              ⚠️ Technical Conflicts Detected:
            </span>
            {hasDoubleBooking && (
              <span className="bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded border border-rose-300 font-medium">
                {conflicts.length} Double-Booking{conflicts.length > 1 ? 's' : ''}
              </span>
            )}
            {hasBuildingConflicts && (
              <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-300 font-medium">
                {validBuildingConflicts.length} Transit Gap{validBuildingConflicts.length > 1 ? 's' : ''}
              </span>
            )}
            {hasAbsentViolations && (
              <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-300 font-medium">
                {absentViolations.length} Absent Assigned
              </span>
            )}
            <span className="text-slate-400">·</span>
            <span className="font-normal text-slate-700">
              Day {routine.dayNumber} ({routine.date})
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Double Booking Conflict List (Animated Accordion) */}
      {hasDoubleBooking && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 text-[11px] text-rose-950 overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setIsDoubleBookingExpanded(!isDoubleBookingExpanded)}
            className="w-full px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-rose-100/70 transition-colors cursor-pointer text-left font-bold text-rose-900"
            title="Click to toggle simultaneous double booking conflict list"
          >
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Simultaneous Double-Booking Details ({conflicts.length}):</span>
            </div>
            <div className="flex items-center gap-1 text-rose-700 text-[10px] shrink-0 font-medium">
              <span>{isDoubleBookingExpanded ? 'Hide' : 'Show details'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-300 ${
                  isDoubleBookingExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              isDoubleBookingExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="px-3 pb-2 pt-1 border-t border-rose-200 bg-rose-50/70">
                <ul className="list-disc list-inside space-y-0.5 text-rose-900 pl-1">
                  {conflicts.map((c, i) => (
                    <li key={i}>
                      <span className="font-semibold">{c.teacherName}</span> is assigned in Period {c.period} simultaneously to rooms:{' '}
                      <span className="font-semibold underline">{c.roomNames.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Absent Violations if any (Animated Accordion) */}
      {hasAbsentViolations && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 text-[11px] text-amber-950 overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setIsAbsentExpanded(!isAbsentExpanded)}
            className="w-full px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-amber-100/70 transition-colors cursor-pointer text-left font-bold text-amber-900"
            title="Click to toggle absent instructor conflict list"
          >
            <div className="flex items-center gap-1.5">
              <UserX className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Absent Instructors Assigned ({absentViolations.length}):</span>
            </div>
            <div className="flex items-center gap-1 text-amber-700 text-[10px] shrink-0 font-medium">
              <span>{isAbsentExpanded ? 'Hide' : 'Show details'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-300 ${
                  isAbsentExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              isAbsentExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="px-3 pb-2 pt-1 border-t border-amber-200 bg-amber-50/70">
                <ul className="list-disc list-inside space-y-0.5 text-amber-900 pl-1">
                  {absentViolations.map((v, i) => (
                    <li key={i}>
                      <span className="font-semibold">{v.teacherName}</span> (Period {v.period}, Room {v.roomId}) is marked on leave today.
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campus Building Transition Violations (Animated Accordion with Smooth Expand/Contract) */}
      {hasBuildingConflicts && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/90 text-[11px] text-amber-950 overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setIsTransitionExpanded(!isTransitionExpanded)}
            className="w-full px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-amber-100/70 transition-colors cursor-pointer text-left font-semibold text-amber-900"
            title="Click to toggle campus building transition conflict list"
          >
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 shrink-0 text-amber-700" />
              <span>Campus Building Transition Conflict ({validBuildingConflicts.length} instructor{validBuildingConflicts.length > 1 ? 's' : ''}):</span>
              <span className="text-[10px] font-normal text-amber-700 hidden sm:inline">
                Mandatory 1-Period Gap required between Old & New Buildings
              </span>
            </div>
            <div className="flex items-center gap-1 text-amber-700 text-[10px] shrink-0 font-medium">
              <span>{isTransitionExpanded ? 'Hide' : 'Show details'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-300 ${
                  isTransitionExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          <div
            className={`grid transition-all duration-300 ease-in-out ${
              isTransitionExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="px-3 pb-2 pt-1 border-t border-amber-200 bg-amber-50/50">
                <ul className="list-disc list-inside space-y-0.5 text-amber-900 pl-1">
                  {validBuildingConflicts.map((b, i) => (
                    <li key={i}>
                      <span className="font-semibold">{b.teacherName}</span> switches from {b.fromBuilding} Building ({b.fromRoomName}, Period {b.fromPeriod}) to {b.toBuilding} Building ({b.toRoomName}, Period {b.toPeriod}) without a transition gap.
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
