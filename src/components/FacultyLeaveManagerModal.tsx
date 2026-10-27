/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Classroom, ClassSlot, DailyRoutine, Paper, Teacher } from '../types';
import { PERIOD_TIMINGS } from '../data/initialData';
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Clock, Sparkles, UserCheck, UserMinus, UserPlus, Users, UserX, X } from 'lucide-react';

interface FacultyLeaveManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  routine: DailyRoutine;
  teachers: Teacher[];
  classrooms: Classroom[];
  papers: Paper[];
  onUpdateRoutine: (updatedRoutine: DailyRoutine) => void;
}

export const FacultyLeaveManagerModal: React.FC<FacultyLeaveManagerModalProps> = ({
  isOpen,
  onClose,
  routine,
  teachers,
  classrooms,
  papers,
  onUpdateRoutine,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'leave' | 'available_matrix'>('leave');
  const [searchTerm, setSearchTerm] = useState('');
  const [suddenLeaveSuccessMsg, setSuddenLeaveSuccessMsg] = useState('');

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const roomMap = new Map(classrooms.map((r) => [r.id, r]));
  const paperMap = new Map(papers.map((p) => [p.id, p]));

  // Calculate busy teachers for each period in this routine
  const periodBusyTeachers = new Map<number, Set<string>>();
  for (let p = 1; p <= 5; p++) {
    const busySet = new Set<string>();
    routine.slots
      .filter((s) => s.period === p && s.teacherId)
      .forEach((s) => busySet.add(s.teacherId));
    periodBusyTeachers.set(p, busySet);
  }

  // Active vs On Leave counts
  const absentSet = new Set(routine.absentTeacherIds);
  const presentTeachers = teachers.filter((t) => !absentSet.has(t.id));
  const onLeaveTeachers = teachers.filter((t) => absentSet.has(t.id));

  // Handler to toggle leave for a teacher
  const handleToggleLeave = (teacher: Teacher) => {
    const isCurrentlyOnLeave = absentSet.has(teacher.id);

    if (isCurrentlyOnLeave) {
      // Mark teacher as active/available again
      const newAbsents = routine.absentTeacherIds.filter((id) => id !== teacher.id);
      const updated: DailyRoutine = {
        ...routine,
        absentTeacherIds: newAbsents,
        updatedAt: new Date().toISOString(),
      };
      onUpdateRoutine(updated);
      setSuddenLeaveSuccessMsg(`${teacher.name} has been marked back to ACTIVE duty.`);
    } else {
      // Mark teacher on leave
      const newAbsents = [...routine.absentTeacherIds, teacher.id];
      const affectedSlots = routine.slots.filter((s) => s.teacherId === teacher.id);

      if (affectedSlots.length === 0) {
        // No slots assigned, just mark absent
        const updated: DailyRoutine = {
          ...routine,
          absentTeacherIds: newAbsents,
          updatedAt: new Date().toISOString(),
        };
        onUpdateRoutine(updated);
        setSuddenLeaveSuccessMsg(`${teacher.name} marked on leave (no active periods assigned today).`);
      } else {
        // Teacher has active slots today! Automatically reassign available substitutes
        const updatedSlots = [...routine.slots];
        let reassignedCount = 0;

        for (let i = 0; i < updatedSlots.length; i++) {
          const slot = updatedSlots[i];
          if (slot.teacherId === teacher.id) {
            const period = slot.period;
            const paper = paperMap.get(slot.paperId);
            const busyInPeriod = new Set(
              updatedSlots
                .filter((s) => s.period === period && s.id !== slot.id && s.teacherId)
                .map((s) => s.teacherId)
            );

            // Find best available substitute who is NOT on leave and NOT busy in this period
            // 1. Same paper primary teachers
            let substitute = paper?.primaryTeacherIds
              .filter((tid) => !newAbsents.includes(tid) && !busyInPeriod.has(tid))
              .map((tid) => teacherMap.get(tid))
              .filter(Boolean)[0];

            // 2. Nearest paper teachers
            if (!substitute && paper?.nearestPaperIds) {
              for (const npId of paper.nearestPaperIds) {
                const np = paperMap.get(npId);
                const nearSub = np?.primaryTeacherIds
                  .filter((tid) => !newAbsents.includes(tid) && !busyInPeriod.has(tid))
                  .map((tid) => teacherMap.get(tid))
                  .filter(Boolean)[0];
                if (nearSub) {
                  substitute = nearSub;
                  break;
                }
              }
            }

            // 3. Any available qualified teacher free in this period
            if (!substitute) {
              substitute = teachers.find(
                (t) => !newAbsents.includes(t.id) && !busyInPeriod.has(t.id)
              );
            }

            if (substitute) {
              updatedSlots[i] = {
                ...slot,
                teacherId: substitute.id,
                isSubstitute: true,
                originalTeacherId: teacher.id,
                substituteReason: `Emergency Leave: ${teacher.name} suddenly unavailable - Substitute assigned`,
              };
              reassignedCount++;
            }
          }
        }

        const updated: DailyRoutine = {
          ...routine,
          absentTeacherIds: newAbsents,
          slots: updatedSlots,
          updatedAt: new Date().toISOString(),
        };

        onUpdateRoutine(updated);
        setSuddenLeaveSuccessMsg(
          `Sudden Leave Applied: ${teacher.name} marked on leave. ${reassignedCount} assigned slot(s) were automatically reassigned to available instructors without double-booking!`
        );
      }
    }
  };

  // Handler for manual single-slot reassignment
  const handleAssignSubstituteToSlot = (slotId: string, newTeacherId: string) => {
    const slotIndex = routine.slots.findIndex((s) => s.id === slotId);
    if (slotIndex === -1) return;

    const oldSlot = routine.slots[slotIndex];
    const newTeacher = teacherMap.get(newTeacherId);
    const updatedSlots = [...routine.slots];

    updatedSlots[slotIndex] = {
      ...oldSlot,
      teacherId: newTeacherId,
      isSubstitute: true,
      originalTeacherId: oldSlot.teacherId,
      substituteReason: `Admin Assigned Substitute: ${newTeacher?.name}`,
    };

    const updated: DailyRoutine = {
      ...routine,
      slots: updatedSlots,
      updatedAt: new Date().toISOString(),
    };

    onUpdateRoutine(updated);
  };

  // Filtered teachers list
  const filtered = teachers.filter((t) => {
    const q = searchTerm.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || t.designation.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Instructor Leave & Emergency Substitute Manager</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mark instructors on leave, view available instructors per period, and instantly reassign substitutes
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 pt-3 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('leave')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'leave'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <UserMinus className="w-4 h-4" />
              <span>Mark Instructors On Leave ({onLeaveTeachers.length} On Leave)</span>
            </button>

            <button
              onClick={() => setActiveTab('available_matrix')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'available_matrix'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Available Instructors by Period ({presentTeachers.length} Active)</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium pb-2 hidden sm:block">
            {presentTeachers.length} Available · {onLeaveTeachers.length} Leave
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Notification Message */}
          {suddenLeaveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{suddenLeaveSuccessMsg}</span>
              </div>
              <button
                onClick={() => setSuddenLeaveSuccessMsg('')}
                className="text-emerald-700 hover:text-emerald-950 font-bold"
              >
                ×
              </button>
            </div>
          )}

          {activeTab === 'leave' && (
            <div className="space-y-4">
              {/* Guidance box */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs text-indigo-950 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Instant Emergency Absence & Automatic Substitution:</span>
                </p>
                <p className="text-slate-600">
                  If any instructor suddenly reports sick or unavailable mid-day, toggle them to <strong>"On Leave"</strong> below. The system will automatically locate their assigned class slots for today and instantly substitute them with qualified free instructors without double-booking.
                </p>
              </div>

              {/* Search */}
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder="Search instructor by name, designation, or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-80 text-xs rounded border border-slate-300 px-3 py-1.5 bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  Showing {filtered.length} of 26 instructors
                </span>
              </div>

              {/* Instructor List with Active Duty / On Leave Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filtered.map((t) => {
                  const isOnLeave = absentSet.has(t.id);
                  const assignedSlotsToday = routine.slots.filter((s) => s.teacherId === t.id);

                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 transition-colors ${
                        isOnLeave
                          ? 'bg-rose-50/50 border-rose-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-slate-500 font-bold">{t.code}</span>
                          <span className="font-bold text-slate-900 truncate">{t.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{t.designation}</p>
                        <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-2">
                          <span>
                            Today: <strong>{assignedSlotsToday.length}</strong> period(s)
                          </span>
                          <span>·</span>
                          <span className="text-indigo-700 font-medium truncate">
                            Papers: {t.primaryPaperIds.join(', ')}
                          </span>
                        </div>
                      </div>

                      {/* Action Toggle Button */}
                      <div className="shrink-0">
                        {isOnLeave ? (
                          <button
                            type="button"
                            onClick={() => handleToggleLeave(t)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 shadow-2xs transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5 text-rose-600" />
                            <span>On Leave (Restore)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleLeave(t)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-100 border border-slate-300 text-slate-700 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 shadow-2xs transition-colors"
                            title="Mark this teacher on emergency leave and auto-reassign substitutes"
                          >
                            <UserMinus className="w-3.5 h-3.5 text-slate-500" />
                            <span>Mark On Leave</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'available_matrix' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Available Instructor Availability Pool:</span> In each of the 5 periods (40 min each), 15 classrooms are occupied. With 26 total instructors, approximately <strong>10–11 instructors are free and available</strong> on duty to handle any immediate substitute needs.
              </div>

              {/* 5 Period Columns of Available Teachers */}
              <div className="space-y-3">
                {PERIOD_TIMINGS.map((p) => {
                  const busyInPeriod = periodBusyTeachers.get(p.period) || new Set<string>();
                  const availableInThisPeriod = presentTeachers.filter((t) => !busyInPeriod.has(t.id));
                  const busyCount = busyInPeriod.size;

                  return (
                    <div
                      key={p.period}
                      className="border border-slate-200 rounded-lg p-3 bg-white shadow-2xs space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{p.label}</span>
                          <span className="font-mono text-slate-500 tabular-nums">({p.time} · {p.duration})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono text-[11px]">
                            {availableInThisPeriod.length} Free Teachers
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500">{busyCount} in class</span>
                        </div>
                      </div>

                      {/* Chips of available teachers in this period */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {availableInThisPeriod.map((t) => (
                          <div
                            key={t.id}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-800 text-[11px]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="font-medium">{t.name}</span>
                            <span className="text-slate-500 font-mono text-[10px]">({t.primaryPaperIds.join(',')})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            * Changes update the active routine immediately while preventing period double-booking.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
