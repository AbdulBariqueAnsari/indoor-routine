/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Classroom, ClassSlot, DailyRoutine, Paper, Teacher } from '../types';
import { PERIOD_TIMINGS } from '../data/initialData';
import { AlertCircle, AlertTriangle, Check, Info, Sparkles, Trash2, UserCheck, X } from 'lucide-react';

interface SlotEditModalProps {
  slot: ClassSlot | null;
  routine: DailyRoutine;
  classrooms: Classroom[];
  papers: Paper[];
  teachers: Teacher[];
  onClose: () => void;
  onSave: (updatedSlot: ClassSlot) => void;
}

export const SlotEditModal: React.FC<SlotEditModalProps> = ({
  slot,
  routine,
  classrooms,
  papers,
  teachers,
  onClose,
  onSave,
}) => {
  if (!slot) return null;

  const room = classrooms.find((c) => c.id === slot.roomId);
  const timing = PERIOD_TIMINGS.find((p) => p.period === slot.period);

  const [selectedPaperId, setSelectedPaperId] = useState<string>(slot.paperId);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(slot.teacherId);
  const [substituteReason, setSubstituteReason] = useState<string>(slot.substituteReason || '');
  const [isPriority, setIsPriority] = useState<boolean>(slot.isPriority || false);

  // Calculate busy teachers in this exact period across other rooms
  const otherSlotsInPeriod = routine.slots.filter(
    (s) => s.period === slot.period && s.roomId !== slot.roomId
  );
  const busyTeacherToRoom = new Map<string, string>();
  for (const s of otherSlotsInPeriod) {
    if (s.teacherId) {
      busyTeacherToRoom.set(s.teacherId, s.roomId);
    }
  }

  const selectedPaper = papers.find((p) => p.id === selectedPaperId);
  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  // Helper to format teacher's main subject label
  const getTeacherMainSubject = (t: Teacher): string => {
    const primary = t.primaryPaperIds
      .map((pid) => papers.find((p) => p.id === pid))
      .filter(Boolean);
    if (primary.length > 0) {
      return primary.map((p) => `${p?.code} ${p?.title}`).join(', ');
    }
    return 'Flexible / General';
  };

  // Check if chosen teacher is busy elsewhere
  const conflictRoomId = busyTeacherToRoom.get(selectedTeacherId);
  const conflictRoom = conflictRoomId ? classrooms.find((c) => c.id === conflictRoomId) : null;
  const isSelectedAbsent = routine.absentTeacherIds.includes(selectedTeacherId);

  // Check if chosen teacher is primary or nearest
  const isPrimary = selectedPaper?.primaryTeacherIds.includes(selectedTeacherId) ?? false;
  const isNearest =
    !isPrimary &&
    (selectedPaper?.nearestPaperIds.some((npId) => {
      const np = papers.find((p) => p.id === npId);
      return np?.primaryTeacherIds.includes(selectedTeacherId);
    }) ??
      false);

  const handleSave = () => {
    const isSub = !isPrimary;
    const originalTeacherId = isSub ? selectedPaper?.primaryTeacherIds[0] : undefined;

    let reason = substituteReason;
    if (isSub && !reason) {
      reason = isNearest
        ? 'Nearest Related Subject Substitute Instructor'
        : 'Emergency / Qualified Substitute Instructor';
    }

    const updated: ClassSlot = {
      ...slot,
      paperId: selectedPaperId,
      teacherId: selectedTeacherId,
      isSubstitute: isSub,
      originalTeacherId: isSub ? originalTeacherId : undefined,
      substituteReason: isSub ? reason : undefined,
      isPriority: isPriority,
    };

    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Edit Routine Slot (Admin Modification)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-semibold text-slate-800">{room?.name}</span> ({room?.code}) ·{' '}
              <span>{timing?.label} ({timing?.time})</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Conflict warnings */}
          {conflictRoom && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Double-Booking Conflict Warning!</span>
              </div>
              <p>
                <strong>{selectedTeacher?.name}</strong> is already assigned to teach in{' '}
                <strong>{conflictRoom.name}</strong> during {timing?.label}!
              </p>
            </div>
          )}

          {isSelectedAbsent && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Instructor Absence Alert!</span>
              </div>
              <p>
                <strong>{selectedTeacher?.name}</strong> is marked as ABSENT / ON LEAVE for this day.
              </p>
            </div>
          )}

          {/* 1. Subject / Paper Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Subject / Paper
            </label>
            <select
              value={selectedPaperId}
              onChange={(e) => {
                const newPaperId = e.target.value;
                setSelectedPaperId(newPaperId);
                const p = papers.find((x) => x.id === newPaperId);
                if (p && p.primaryTeacherIds.length > 0) {
                  // Prefer a primary teacher who is free
                  const freePrimary = p.primaryTeacherIds.find((tId) => !busyTeacherToRoom.has(tId));
                  setSelectedTeacherId(freePrimary || p.primaryTeacherIds[0]);
                } else if (!newPaperId) {
                  setSelectedTeacherId('');
                }
              }}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- No Subject (Blank / Clear Slot) --</option>
              {papers.map((p) => {
                const teacherCodes = p.primaryTeacherIds.map((tid) => teachers.find((t) => t.id === tid)?.code || tid).join(', ');
                return (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.title} {teacherCodes ? `(Main: ${teacherCodes})` : ''}
                  </option>
                );
              })}
            </select>
            {selectedPaper && (
              <p className="text-[11px] text-slate-500 mt-1 italic">
                Category: {selectedPaper.category} · {selectedPaper.description}
              </p>
            )}
          </div>

          {/* 2. Instructor Selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Select Instructor
              </label>
              {isPrimary && (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Primary Subject Instructor
                </span>
              )}
              {isNearest && (
                <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Nearest Related Subject Backup
                </span>
              )}
              {!isPrimary && !isNearest && (
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Cross-Subject / Emergency Substitute
                </span>
              )}
            </div>

            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className={`w-full text-xs rounded-lg border px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                conflictRoom
                  ? 'border-rose-400 bg-rose-50/40'
                  : 'border-slate-300'
              }`}
            >
              <option value="">-- No Instructor (Leave Blank / Vacant) --</option>
              <optgroup label="Primary Instructors for this Paper">
                {teachers
                  .filter((t) => selectedPaper?.primaryTeacherIds.includes(t.id))
                  .map((t) => {
                    const isBusy = busyTeacherToRoom.has(t.id);
                    const bRoom = isBusy ? classrooms.find((c) => c.id === busyTeacherToRoom.get(t.id)) : null;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.code} - {t.name} [Main: {getTeacherMainSubject(t)}] {isBusy ? `⚠️ BUSY in ${bRoom?.name}` : '✓ FREE'}
                      </option>
                    );
                  })}
              </optgroup>

              <optgroup label="All Other Available Instructors (T1–T26)">
                {teachers
                  .filter((t) => !selectedPaper?.primaryTeacherIds.includes(t.id))
                  .map((t) => {
                    const isBusy = busyTeacherToRoom.has(t.id);
                    const bRoom = isBusy ? classrooms.find((c) => c.id === busyTeacherToRoom.get(t.id)) : null;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.code} - {t.name} [Main: {getTeacherMainSubject(t)}] {isBusy ? `⚠️ BUSY in ${bRoom?.name}` : '✓ FREE'}
                      </option>
                    );
                  })}
              </optgroup>
            </select>

            {/* Selected Instructor Profile & Main Subject Badge */}
            {selectedTeacher && (
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    {selectedTeacher.name} ({selectedTeacher.code})
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {selectedTeacher.designation}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700">
                    Main Subject: {getTeacherMainSubject(selectedTeacher)}
                  </span>
                  {selectedTeacher.backupPaperIds && selectedTeacher.backupPaperIds.length > 0 && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
                      Backup: {selectedTeacher.backupPaperIds.map(pid => papers.find(p => p.id === pid)?.code || pid).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Priority Flag */}
          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <input
              type="checkbox"
              id="isPriorityCheck"
              checked={isPriority}
              onChange={(e) => setIsPriority(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <label htmlFor="isPriorityCheck" className="text-xs text-slate-800 cursor-pointer flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-semibold">Mark as Priority Syllabus Session</span>
              <span className="text-[11px] text-slate-500">(Highlights on timetable)</span>
            </label>
          </div>

          {/* 4. Substitute Reason if not primary */}
          {!isPrimary && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Substitute Engagement Justification
              </label>
              <input
                type="text"
                value={substituteReason}
                onChange={(e) => setSubstituteReason(e.target.value)}
                placeholder="e.g. Primary instructor busy/on leave; nearest qualified instructor assigned"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            * Changes update the active daily routine immediately.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors ${
                conflictRoom
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-xs'
              }`}
            >
              {conflictRoom ? 'Save with Conflict (Warning)' : 'Save Modification'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
