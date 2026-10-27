/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Classroom, ClassSlot, DailyRoutine, Paper, Teacher, UnavailableInstructor, UnavailabilityType } from '../types';
import { PERIOD_TIMINGS } from '../data/initialData';
import {
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  HeartPulse,
  Info,
  Search,
  Sparkles,
  UserCheck,
  UserMinus,
  Users,
  UserX,
  X,
} from 'lucide-react';

interface UnavailableRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  routine: DailyRoutine;
  teachers: Teacher[];
  classrooms: Classroom[];
  papers: Paper[];
  onUpdateRoutine: (updatedRoutine: DailyRoutine) => void;
}

export const UnavailableRegisterModal: React.FC<UnavailableRegisterModalProps> = ({
  isOpen,
  onClose,
  routine,
  teachers,
  classrooms,
  papers,
  onUpdateRoutine,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'register' | 'period_matrix'>('register');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | UnavailabilityType>('ALL');
  const [successMsg, setSuccessMsg] = useState('');
  const [editingRemarkTid, setEditingRemarkTid] = useState<string | null>(null);
  const [remarkInput, setRemarkInput] = useState<string>('');

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const roomMap = new Map(classrooms.map((r) => [r.id, r]));
  const paperMap = new Map(papers.map((p) => [p.id, p]));

  // Current unavailable map: teacherId -> { type, remark }
  const unavailableMap = new Map<string, UnavailableInstructor>();
  if (routine.unavailableTeachers) {
    for (const item of routine.unavailableTeachers) {
      unavailableMap.set(item.teacherId, item);
    }
  }
  // Ensure any teacher in absentTeacherIds is represented
  for (const tid of routine.absentTeacherIds) {
    if (!unavailableMap.has(tid)) {
      unavailableMap.set(tid, { teacherId: tid, type: 'ABSENT', remark: 'Marked Absent' });
    }
  }

  // Calculate busy teachers for each period
  const periodBusyTeachers = new Map<number, Set<string>>();
  for (let p = 1; p <= 5; p++) {
    const busySet = new Set<string>();
    routine.slots
      .filter((s) => s.period === p && s.teacherId)
      .forEach((s) => busySet.add(s.teacherId));
    periodBusyTeachers.set(p, busySet);
  }

  // Count by status
  const counts = {
    AVAILABLE: teachers.filter((t) => !unavailableMap.has(t.id)).length,
    ABSENT: teachers.filter((t) => unavailableMap.get(t.id)?.type === 'ABSENT').length,
    LEAVE: teachers.filter((t) => unavailableMap.get(t.id)?.type === 'LEAVE').length,
    DUTY: teachers.filter((t) => unavailableMap.get(t.id)?.type === 'DUTY').length,
    SICK: teachers.filter((t) => unavailableMap.get(t.id)?.type === 'SICK').length,
  };

  // Set instructor status (AVAILABLE, ABSENT, LEAVE, DUTY, SICK)
  const handleSetStatus = (teacher: Teacher, newStatus: 'AVAILABLE' | UnavailabilityType, customRemark?: string) => {
    let newUnavailableList = [...(routine.unavailableTeachers || [])];
    let newAbsentTeacherIds = [...routine.absentTeacherIds];

    if (newStatus === 'AVAILABLE') {
      // Remove from unavailable list and absentTeacherIds
      newUnavailableList = newUnavailableList.filter((u) => u.teacherId !== teacher.id);
      newAbsentTeacherIds = newAbsentTeacherIds.filter((id) => id !== teacher.id);

      const updated: DailyRoutine = {
        ...routine,
        absentTeacherIds: newAbsentTeacherIds,
        unavailableTeachers: newUnavailableList,
        updatedAt: new Date().toISOString(),
      };
      onUpdateRoutine(updated);
      setSuccessMsg(`${teacher.code} - ${teacher.name} marked AVAILABLE on campus duty.`);
    } else {
      // Mark as unavailable with chosen type
      const defaultRemarks: Record<UnavailabilityType, string> = {
        ABSENT: 'Uninformed / Absent',
        LEAVE: 'Sanctioned Casual / Privilege Leave',
        DUTY: 'Special / Law & Order / Campus Duty',
        SICK: 'Medical / Sick Leave',
      };

      const finalRemark = customRemark !== undefined ? customRemark : (unavailableMap.get(teacher.id)?.remark || defaultRemarks[newStatus]);

      newUnavailableList = newUnavailableList.filter((u) => u.teacherId !== teacher.id);
      newUnavailableList.push({
        teacherId: teacher.id,
        type: newStatus,
        remark: finalRemark,
        date: routine.date,
      });

      if (!newAbsentTeacherIds.includes(teacher.id)) {
        newAbsentTeacherIds.push(teacher.id);
      }

      // Check if teacher has slots assigned today
      const affectedSlots = routine.slots.filter((s) => s.teacherId === teacher.id);

      if (affectedSlots.length === 0) {
        const updated: DailyRoutine = {
          ...routine,
          absentTeacherIds: newAbsentTeacherIds,
          unavailableTeachers: newUnavailableList,
          updatedAt: new Date().toISOString(),
        };
        onUpdateRoutine(updated);
        setSuccessMsg(`${teacher.code} - ${teacher.name} marked as ${newStatus} (${finalRemark}). No active slots today.`);
      } else {
        // Teacher had slots assigned today! Reassign substitute or clear slot
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

            // Find best available substitute
            let bestSub: Teacher | null = null;
            let subReason = '';

            // 1. Primary teachers of this paper
            const primarySubs = (paper?.primaryTeacherIds || [])
              .filter((id) => id !== teacher.id && !newAbsentTeacherIds.includes(id) && !busyInPeriod.has(id))
              .map((id) => teacherMap.get(id)!)
              .filter(Boolean);

            if (primarySubs.length > 0) {
              bestSub = primarySubs[0];
              subReason = `Reassigned from ${teacher.code} (${newStatus}): Co-primary instructor [${bestSub.code}] ${bestSub.name}`;
            }

            // 2. Backup instructors
            if (!bestSub) {
              const backupSubs = teachers.filter(
                (t) =>
                  t.id !== teacher.id &&
                  !newAbsentTeacherIds.includes(t.id) &&
                  !busyInPeriod.has(t.id) &&
                  ((t.backupPaperIds && t.backupPaperIds.includes(slot.paperId)) ||
                    (t.secondaryPaperIds && t.secondaryPaperIds.includes(slot.paperId)))
              );
              if (backupSubs.length > 0) {
                bestSub = backupSubs[0];
                subReason = `Reassigned from ${teacher.code} (${newStatus}): Designated Backup instructor [${bestSub.code}] ${bestSub.name}`;
              }
            }

            // 3. Any free instructor
            if (!bestSub) {
              const anyFree = teachers.filter(
                (t) => t.id !== teacher.id && !newAbsentTeacherIds.includes(t.id) && !busyInPeriod.has(t.id)
              );
              if (anyFree.length > 0) {
                bestSub = anyFree[0];
                subReason = `Reassigned from ${teacher.code} (${newStatus}): Available faculty [${bestSub.code}] ${bestSub.name}`;
              }
            }

            if (bestSub) {
              updatedSlots[i] = {
                ...slot,
                teacherId: bestSub.id,
                isSubstitute: true,
                originalTeacherId: teacher.id,
                substituteReason: subReason,
              };
              reassignedCount++;
            } else {
              // Leave slot unassigned
              updatedSlots[i] = {
                ...slot,
                teacherId: '',
                isSubstitute: false,
                originalTeacherId: teacher.id,
                substituteReason: `Faculty ${teacher.code} is ${newStatus} (${finalRemark}) - Slot left unallocated`,
              };
            }
          }
        }

        const updated: DailyRoutine = {
          ...routine,
          slots: updatedSlots,
          absentTeacherIds: newAbsentTeacherIds,
          unavailableTeachers: newUnavailableList,
          updatedAt: new Date().toISOString(),
        };
        onUpdateRoutine(updated);
        setSuccessMsg(
          `${teacher.code} - ${teacher.name} marked ${newStatus}. Reassigned ${reassignedCount} active teaching slot(s).`
        );
      }
    }
  };

  const filteredTeachers = teachers.filter((t) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      t.name.toLowerCase().includes(q) ||
      t.code.toLowerCase().includes(q) ||
      t.designation.toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (statusFilter === 'ALL') return true;
    const item = unavailableMap.get(t.id);
    if (statusFilter === 'AVAILABLE') return !item;
    return item?.type === statusFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center font-bold text-white shadow-xs">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Faculty Unavailability Register</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                  Day {routine.dayNumber} · {routine.date}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Mark instructors as Absent, on Leave, on Special Duty, or Sick / Medical
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Count Summary Cards */}
        <div className="p-4 bg-slate-100/70 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Available</div>
              <div className="text-base font-bold text-emerald-700">{counts.AVAILABLE} / {teachers.length}</div>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-rose-200 shadow-2xs flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Absent</div>
              <div className="text-base font-bold text-rose-700">{counts.ABSENT}</div>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-amber-200 shadow-2xs flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <UserMinus className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Leave</div>
              <div className="text-base font-bold text-amber-700">{counts.LEAVE}</div>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-blue-200 shadow-2xs flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Duty</div>
              <div className="text-base font-bold text-blue-700">{counts.DUTY}</div>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-purple-200 shadow-2xs flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <HeartPulse className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Sick / Med</div>
              <div className="text-base font-bold text-purple-700">{counts.SICK}</div>
            </div>
          </div>
        </div>

        {/* Tab Switcher & Filters */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab('register')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Faculty Status List ({teachers.length})
            </button>
            <button
              onClick={() => setActiveTab('period_matrix')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'period_matrix'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Period Availability Matrix (P1–P5)
            </button>
          </div>

          {activeTab === 'register' && (
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search faculty by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                <option value="ALL">All Status ({teachers.length})</option>
                <option value="AVAILABLE">Available ({counts.AVAILABLE})</option>
                <option value="ABSENT">Absent ({counts.ABSENT})</option>
                <option value="LEAVE">On Leave ({counts.LEAVE})</option>
                <option value="DUTY">On Duty ({counts.DUTY})</option>
                <option value="SICK">Sick ({counts.SICK})</option>
              </select>
            </div>
          )}
        </div>

        {/* Success Alert Banner */}
        {successMsg && (
          <div className="mx-5 my-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg('')}
              className="text-emerald-600 hover:text-emerald-900"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto">
          {activeTab === 'register' ? (
            <div className="space-y-2.5">
              {filteredTeachers.map((teacher) => {
                const unavail = unavailableMap.get(teacher.id);
                const isUnavailable = !!unavail;
                const statusType: 'AVAILABLE' | UnavailabilityType = unavail ? unavail.type : 'AVAILABLE';

                // Today slots assigned to this teacher
                const assignedSlots = routine.slots.filter((s) => s.teacherId === teacher.id);

                return (
                  <div
                    key={teacher.id}
                    className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      !isUnavailable
                        ? 'bg-white border-slate-200 hover:border-slate-300'
                        : statusType === 'ABSENT'
                        ? 'bg-rose-50/70 border-rose-200'
                        : statusType === 'LEAVE'
                        ? 'bg-amber-50/70 border-amber-200'
                        : statusType === 'DUTY'
                        ? 'bg-blue-50/70 border-blue-200'
                        : 'bg-purple-50/70 border-purple-200'
                    }`}
                  >
                    {/* Left: Teacher Info & Badge */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold font-mono text-xs shrink-0 ${
                          !isUnavailable
                            ? 'bg-emerald-100 text-emerald-800'
                            : statusType === 'ABSENT'
                            ? 'bg-rose-100 text-rose-800'
                            : statusType === 'LEAVE'
                            ? 'bg-amber-100 text-amber-800'
                            : statusType === 'DUTY'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {teacher.code}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs text-slate-900 truncate">
                            {teacher.name}
                          </h4>
                          <span className="text-[11px] text-slate-500">
                            {teacher.designation}
                          </span>

                          {/* Current Status Pill */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              !isUnavailable
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : statusType === 'ABSENT'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : statusType === 'LEAVE'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : statusType === 'DUTY'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-purple-100 text-purple-800 border border-purple-300'
                            }`}
                          >
                            {!isUnavailable ? 'Available' : statusType}
                          </span>
                        </div>

                        {/* Remark Note */}
                        {unavail?.remark && (
                          <p className="text-[11px] text-slate-600 mt-0.5 italic flex items-center gap-1">
                            <Info className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{unavail.remark}</span>
                          </p>
                        )}

                        {/* Assigned periods warning if any */}
                        {assignedSlots.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-indigo-700 font-semibold mt-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              Assigned in {assignedSlots.length} period(s):{' '}
                              {assignedSlots.map((s) => `P${s.period} (${s.roomId})`).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Quick Action Status Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleSetStatus(teacher, 'AVAILABLE')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                          !isUnavailable
                            ? 'bg-emerald-600 text-white shadow-2xs ring-1 ring-emerald-700'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-800'
                        }`}
                        title="Mark faculty available on campus"
                      >
                        Available
                      </button>

                      <button
                        onClick={() => handleSetStatus(teacher, 'ABSENT')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                          isUnavailable && statusType === 'ABSENT'
                            ? 'bg-rose-600 text-white shadow-2xs ring-1 ring-rose-700'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-rose-50 hover:text-rose-800'
                        }`}
                        title="Mark absent"
                      >
                        Absent
                      </button>

                      <button
                        onClick={() => handleSetStatus(teacher, 'LEAVE')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                          isUnavailable && statusType === 'LEAVE'
                            ? 'bg-amber-600 text-white shadow-2xs ring-1 ring-amber-700'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-amber-50 hover:text-amber-800'
                        }`}
                        title="Mark sanctioned leave"
                      >
                        Leave
                      </button>

                      <button
                        onClick={() => handleSetStatus(teacher, 'DUTY')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                          isUnavailable && statusType === 'DUTY'
                            ? 'bg-blue-600 text-white shadow-2xs ring-1 ring-blue-700'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-800'
                        }`}
                        title="Mark special duty / law & order / camp"
                      >
                        Duty
                      </button>

                      <button
                        onClick={() => handleSetStatus(teacher, 'SICK')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                          isUnavailable && statusType === 'SICK'
                            ? 'bg-purple-600 text-white shadow-2xs ring-1 ring-purple-700'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-purple-50 hover:text-purple-800'
                        }`}
                        title="Mark sick / medical leave"
                      >
                        Sick
                      </button>

                      {/* Custom Remark Button */}
                      {isUnavailable && (
                        <button
                          onClick={() => {
                            if (editingRemarkTid === teacher.id) {
                              setEditingRemarkTid(null);
                            } else {
                              setEditingRemarkTid(teacher.id);
                              setRemarkInput(unavail?.remark || '');
                            }
                          }}
                          className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 ml-1"
                        >
                          {editingRemarkTid === teacher.id ? 'Cancel' : 'Note'}
                        </button>
                      )}
                    </div>

                    {/* Inline Remark Edit Box */}
                    {editingRemarkTid === teacher.id && (
                      <div className="w-full flex items-center gap-2 pt-2 border-t border-slate-200 mt-1">
                        <input
                          type="text"
                          value={remarkInput}
                          onChange={(e) => setRemarkInput(e.target.value)}
                          placeholder="Enter reason or remark (e.g. VIP Duty, Court, Medical)..."
                          className="flex-1 px-3 py-1 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                        <button
                          onClick={() => {
                            handleSetStatus(teacher, statusType as UnavailabilityType, remarkInput);
                            setEditingRemarkTid(null);
                          }}
                          className="px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded hover:bg-slate-800"
                        >
                          Save Note
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Tab 2: Period Availability Matrix */
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Period-wise faculty deployment overview. Instructors unavailable are highlighted with their status.
              </p>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                      <th className="p-2.5 border-r border-slate-200 w-44">Faculty</th>
                      {PERIOD_TIMINGS.map((p) => (
                        <th key={p.period} className="p-2.5 border-r border-slate-200 last:border-r-0 text-center">
                          <div>{p.label}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{p.time}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {teachers.map((teacher) => {
                      const unavail = unavailableMap.get(teacher.id);

                      return (
                        <tr key={teacher.id} className="hover:bg-slate-50/70">
                          <td className="p-2.5 border-r border-slate-200">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span className="font-mono text-indigo-700">{teacher.code}</span>
                              <span className="truncate">{teacher.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">{teacher.designation}</div>
                          </td>

                          {PERIOD_TIMINGS.map((p) => {
                            if (unavail) {
                              const badgeStyle =
                                unavail.type === 'ABSENT'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : unavail.type === 'LEAVE'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : unavail.type === 'DUTY'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : 'bg-purple-100 text-purple-800 border-purple-300';

                              return (
                                <td
                                  key={p.period}
                                  className="p-2 border-r border-slate-200 last:border-r-0 text-center"
                                >
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeStyle}`}
                                    title={unavail.remark || unavail.type}
                                  >
                                    {unavail.type}
                                  </span>
                                </td>
                              );
                            }

                            // Check if teaching in this period
                            const slot = routine.slots.find(
                              (s) => s.period === p.period && s.teacherId === teacher.id
                            );

                            if (slot) {
                              const room = roomMap.get(slot.roomId);
                              const paper = paperMap.get(slot.paperId);

                              return (
                                <td
                                  key={p.period}
                                  className="p-2 border-r border-slate-200 last:border-r-0 text-center bg-indigo-50/50"
                                >
                                  <div className="font-bold text-indigo-900 text-[11px]">
                                    {room?.code || slot.roomId}
                                  </div>
                                  <div className="text-[10px] text-indigo-700 truncate max-w-[120px]">
                                    {paper?.code || slot.paperId}
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td
                                key={p.period}
                                className="p-2 border-r border-slate-200 last:border-r-0 text-center text-slate-400 font-mono text-[11px]"
                              >
                                Standby
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Changes to the Unavailability Register immediately update the active routine and substitute staffing.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs"
          >
            Close Register
          </button>
        </div>
      </div>
    </div>
  );
};
