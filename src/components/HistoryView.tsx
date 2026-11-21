/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DailyRoutine, Paper, Teacher } from '../types';
import { ConfirmModal } from './ConfirmModal';
import {
  Calendar,
  Eye,
  Lock,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Unlock,
} from 'lucide-react';

interface HistoryViewProps {
  allRoutines: DailyRoutine[];
  currentRoutine: DailyRoutine | null;
  teachers: Teacher[];
  papers: Paper[];
  onSelectRoutine: (routineId: string) => void;
  onResetData: () => void;
  onToggleLockRoutine?: (routineId: string) => void;
  onDeleteRoutine?: (routineId: string) => void;
  isAdmin: boolean;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  allRoutines,
  currentRoutine,
  teachers,
  papers,
  onSelectRoutine,
  onResetData,
  onToggleLockRoutine,
  onDeleteRoutine,
  isAdmin,
}) => {
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  } | null>(null);

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const paperMap = new Map(papers.map((p) => [p.id, p]));

  const sorted = [...allRoutines].sort((a, b) => b.dayNumber - a.dayNumber);

  return (
    <div className="space-y-4">
      {/* Policy Explanation Banner */}
      <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs space-y-1 text-slate-700">
        <div className="font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <span>Audit Trail & Routine Locking:</span>
        </div>
        <p className="text-slate-600">
          Daily routines are saved in historical logs. By default, older routines are locked to preserve cumulative quota integrity, but Administrators can toggle the lock status to make corrections or delete routines.
        </p>
      </div>

      {/* Routine Log Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Daily Routine Historical Logs
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {allRoutines.length} routine(s) generated and archived
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: 'Reset Demo Data Confirmation',
                  message: 'Are you sure you want to reset all routine data back to default demo state? Any unsaved changes in current routines will be restored.',
                  confirmText: 'Reset Demo Data',
                  variant: 'warning',
                  onConfirm: () => {
                    onResetData();
                    setConfirmModal(null);
                  },
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Demo Data</span>
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-200">
          {sorted.map((r) => {
            const isCurrentViewing = currentRoutine?.id === r.id;
            const subCount = r.slots.filter((s) => s.isSubstitute).length;
            const absentNames = r.absentTeacherIds
              .map((id) => teacherMap.get(id)?.name || id)
              .join(', ');

            const priorityTitles = r.priorityPaperIds
              .map((id) => paperMap.get(id)?.code)
              .filter(Boolean)
              .join(', ');

            return (
              <div
                key={r.id}
                className={`p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
                  isCurrentViewing ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'
                }`}
              >
                {/* Details */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      Day {r.dayNumber}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-xs text-slate-600 font-mono flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {r.date}
                    </span>

                    {/* Lock Status */}
                    {!r.isLocked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        <Unlock className="w-3 h-3 text-amber-700" />
                        <span>Editable Mode (Hidden from Users)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                        <Lock className="w-3 h-3 text-emerald-700" />
                        <span>Locked (Published to Users)</span>
                      </span>
                    )}

                    {isCurrentViewing && (
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                        Currently Selected
                      </span>
                    )}
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <div>
                      <span className="font-medium text-slate-500">Slots:</span>{' '}
                      <span className="font-bold text-slate-800 font-mono tabular-nums">{r.slots.length}</span> (15 rooms × 5 periods)
                    </div>
                    <span>·</span>
                    <div>
                      <span className="font-medium text-slate-500">Substitutes:</span>{' '}
                      <span className="font-bold text-amber-700 font-mono tabular-nums">{subCount}</span>
                    </div>
                    <span>·</span>
                    <div>
                      <span className="font-medium text-slate-500">Instructors on Leave:</span>{' '}
                      <span className="font-medium text-slate-800">
                        {r.absentTeacherIds.length > 0 ? absentNames : 'None'}
                      </span>
                    </div>
                  </div>

                  {priorityTitles && (
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <span className="font-medium text-amber-700">★ Priority Papers:</span>
                      <span className="font-mono font-semibold text-slate-800">{priorityTitles}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {isAdmin && onToggleLockRoutine && (
                    <button
                      onClick={() => onToggleLockRoutine(r.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                        r.isLocked
                          ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                      title={r.isLocked ? 'Unlock routine to allow editing (will hide from users while unlocked)' : 'Lock routine and publish to users'}
                    >
                      {r.isLocked ? (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Unlock (Edit)</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Lock & Publish</span>
                        </>
                      )}
                    </button>
                  )}

                  {isAdmin && onDeleteRoutine && allRoutines.length > 1 && (
                    <button
                      onClick={() => {
                        setConfirmModal({
                          isOpen: true,
                          title: 'Delete Routine Confirmation',
                          message: `Are you sure you want to permanently delete Day ${r.dayNumber} routine (${r.date})? This action cannot be undone.`,
                          confirmText: 'Delete Routine',
                          variant: 'danger',
                          onConfirm: () => {
                            onDeleteRoutine(r.id);
                            setConfirmModal(null);
                          },
                        });
                      }}
                      className="p-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete routine"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => onSelectRoutine(r.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      isCurrentViewing
                        ? 'bg-slate-200 text-slate-700 cursor-default'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Timetable</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          variant={confirmModal.variant}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
};
