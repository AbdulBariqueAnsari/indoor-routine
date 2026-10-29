/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Classroom,
  ClassSlot,
  DailyRoutine,
  Paper,
  RoutineRuleConfig,
  SubjectPriorityTier,
  Teacher,
  UnavailableInstructor,
  UnavailabilityType,
} from '../types';
import { calculateCumulativeStats, generateDailyRoutine } from '../utils/scheduler';
import { DEFAULT_ROUTINE_RULES, MASTER_ROUTINE_RULES, isRuleDisabled, normalizeRuleConfig } from '../data/initialData';
import {
  AlertCircle,
  Ban,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  FilePlus,
  Filter,
  HeartPulse,
  Info,
  Layers,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  UserCheck,
  UserMinus,
  Users,
  UserX,
  X,
} from 'lucide-react';

interface RoutineGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoutineGenerated: (newRoutine: DailyRoutine | DailyRoutine[]) => void;
  classrooms: Classroom[];
  papers: Paper[];
  teachers: Teacher[];
  historicalRoutines: DailyRoutine[];
  recreatingRoutine?: DailyRoutine | null;
  rules?: RoutineRuleConfig;
}

export const RoutineGeneratorModal: React.FC<RoutineGeneratorModalProps> = ({
  isOpen,
  onClose,
  onRoutineGenerated,
  classrooms,
  papers,
  teachers,
  historicalRoutines,
  recreatingRoutine,
  rules,
}) => {
  if (!isOpen) return null;

  const [localRules, setLocalRules] = useState<RoutineRuleConfig>(
    normalizeRuleConfig(rules || DEFAULT_ROUTINE_RULES)
  );
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);

  const isRecreating = !!recreatingRoutine;

  // Day number
  const dayNumber = isRecreating
    ? recreatingRoutine.dayNumber
    : historicalRoutines.length > 0
    ? Math.max(...historicalRoutines.map((r) => r.dayNumber)) + 1
    : 1;

  // Calculate default date
  const getDefaultDate = () => {
    if (isRecreating && recreatingRoutine) return recreatingRoutine.date;
    if (historicalRoutines.length === 0) return new Date().toISOString().split('T')[0];
    const sorted = [...historicalRoutines].sort((a, b) => b.dayNumber - a.dayNumber);
    const lastDate = new Date(sorted[0].date);
    lastDate.setDate(lastDate.getDate() + 1);
    return lastDate.toISOString().split('T')[0];
  };

  const [date, setDate] = useState<string>(getDefaultDate());
  const [absentTeacherIds, setAbsentTeacherIds] = useState<string[]>(
    recreatingRoutine?.absentTeacherIds || []
  );

  // New Generation Mode: 'single' | 'multiple' | 'blank'
  const [generationMode, setGenerationMode] = useState<'single' | 'multiple' | 'blank'>('single');
  const [multiDayCount, setMultiDayCount] = useState<number>(3);

  // Unavailable Register remarks: map teacherId -> type ('ABSENT' | 'LEAVE' | 'DUTY' | 'SICK')
  const [unavailableTypes, setUnavailableTypes] = useState<Record<string, UnavailabilityType>>(() => {
    const map: Record<string, UnavailabilityType> = {};
    if (recreatingRoutine?.unavailableTeachers) {
      for (const u of recreatingRoutine.unavailableTeachers) {
        map[u.teacherId] = u.type;
      }
    }
    for (const tid of recreatingRoutine?.absentTeacherIds || []) {
      if (!map[tid]) map[tid] = 'ABSENT';
    }
    return map;
  });

  const [unavailableRemarks, setUnavailableRemarks] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (recreatingRoutine?.unavailableTeachers) {
      for (const u of recreatingRoutine.unavailableTeachers) {
        if (u.remark) map[u.teacherId] = u.remark;
      }
    }
    return map;
  });

  const handleSetTeacherStatus = (teacherId: string, status: 'AVAILABLE' | UnavailabilityType) => {
    if (status === 'AVAILABLE') {
      setAbsentTeacherIds((prev) => prev.filter((id) => id !== teacherId));
      setUnavailableTypes((prev) => {
        const copy = { ...prev };
        delete copy[teacherId];
        return copy;
      });
    } else {
      setAbsentTeacherIds((prev) => (prev.includes(teacherId) ? prev : [...prev, teacherId]));
      setUnavailableTypes((prev) => ({ ...prev, [teacherId]: status }));
      if (!unavailableRemarks[teacherId]) {
        const defaultNotes: Record<UnavailabilityType, string> = {
          ABSENT: 'Absent',
          LEAVE: 'Sanctioned Leave',
          DUTY: 'Special Duty',
          SICK: 'Medical / Sick',
        };
        setUnavailableRemarks((prev) => ({ ...prev, [teacherId]: defaultNotes[status] }));
      }
    }
  };

  // Priority tiers per paper: 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL' | 'EXCLUDE'
  const [subjectTiers, setSubjectTiers] = useState<Record<string, SubjectPriorityTier>>(() => {
    const initial: Record<string, SubjectPriorityTier> = {};
    if (recreatingRoutine?.subjectPriorityTiers) {
      return { ...recreatingRoutine.subjectPriorityTiers };
    }
    for (const p of papers) {
      if (recreatingRoutine?.excludedPaperIds?.includes(p.id)) {
        initial[p.id] = 'EXCLUDE';
      } else if (recreatingRoutine?.priorityPaperIds?.includes(p.id)) {
        initial[p.id] = 'HIGH';
      } else {
        initial[p.id] = 'NORMAL';
      }
    }
    return initial;
  });

  // Guaranteed minimum periods per prioritized paper
  const [subjectMinPeriods, setSubjectMinPeriods] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    if (recreatingRoutine?.prioritySubjectMinPeriods) {
      return { ...recreatingRoutine.prioritySubjectMinPeriods };
    }
    for (const p of papers) {
      const tier = recreatingRoutine?.subjectPriorityTiers?.[p.id];
      if (tier === 'HIGH') initial[p.id] = 15;
      else if (tier === 'MEDIUM') initial[p.id] = 9;
      else if (tier === 'LOW') initial[p.id] = 3;
    }
    return initial;
  });

  const [notes, setNotes] = useState<string>(recreatingRoutine?.notes || '');
  const [teacherSearch, setTeacherSearch] = useState<string>('');
  const [subjectSearch, setSubjectSearch] = useState<string>('');
  const [priorityMode, setPriorityMode] = useState<'tiers' | 'roomWise'>('tiers');
  const [roomPriorityMap, setRoomPriorityMap] = useState<Record<string, string[]>>(
    recreatingRoutine?.roomPriorityPaperIds || {}
  );
  const [selectedRoomIdForPriority, setSelectedRoomIdForPriority] = useState<string>(
    classrooms.length > 0 ? classrooms[0].id : ''
  );

  // History excluding current one if recreating
  const effectiveHistory = isRecreating
    ? historicalRoutines.filter((r) => r.id !== recreatingRoutine.id)
    : historicalRoutines;

  // Calculate cumulative stats to guide deficit scheduling
  const cumulativeStats = calculateCumulativeStats(papers, effectiveHistory, []);

  const toggleAbsentTeacher = (teacherId: string) => {
    setAbsentTeacherIds((prev) =>
      prev.includes(teacherId) ? prev.filter((id) => id !== teacherId) : [...prev, teacherId]
    );
  };

  const setPaperTier = (paperId: string, tier: SubjectPriorityTier) => {
    setSubjectTiers((prev) => ({
      ...prev,
      [paperId]: tier,
    }));
    setSubjectMinPeriods((prev) => {
      const updated = { ...prev };
      if (tier === 'HIGH') updated[paperId] = 15;
      else if (tier === 'MEDIUM') updated[paperId] = 9;
      else if (tier === 'LOW') updated[paperId] = 3;
      else delete updated[paperId];
      return updated;
    });
  };

  const updateMinPeriods = (paperId: string, delta: number) => {
    setSubjectMinPeriods((prev) => {
      const current = prev[paperId] ?? (subjectTiers[paperId] === 'HIGH' ? 15 : subjectTiers[paperId] === 'MEDIUM' ? 9 : 3);
      const nextVal = Math.max(1, Math.min(30, current + delta));
      return { ...prev, [paperId]: nextVal };
    });
  };

  const resetAllTiers = () => {
    const reset: Record<string, SubjectPriorityTier> = {};
    for (const p of papers) {
      reset[p.id] = 'NORMAL';
    }
    setSubjectTiers(reset);
    setSubjectMinPeriods({});
  };

  const toggleRoomPriorityPaper = (paperId: string) => {
    if (!selectedRoomIdForPriority) return;
    setRoomPriorityMap((prev) => {
      const currentList = prev[selectedRoomIdForPriority] || [];
      const updated = currentList.includes(paperId)
        ? currentList.filter((id) => id !== paperId)
        : [...currentList, paperId];
      return { ...prev, [selectedRoomIdForPriority]: updated };
    });
  };

  const copyPriorityToAllRooms = (sourceRoomId: string) => {
    const sourcePapers = roomPriorityMap[sourceRoomId] || [];
    const updated: Record<string, string[]> = {};
    for (const r of classrooms) {
      updated[r.id] = [...sourcePapers];
    }
    setRoomPriorityMap(updated);
  };

  const copyPriorityToBuilding = (sourceRoomId: string, building: 'OLD' | 'NEW') => {
    const sourcePapers = roomPriorityMap[sourceRoomId] || [];
    setRoomPriorityMap((prev) => {
      const updated = { ...prev };
      for (const r of classrooms) {
        if (r.building === building) {
          updated[r.id] = [...sourcePapers];
        }
      }
      return updated;
    });
  };

  const clearAllRoomPriorities = () => {
    setRoomPriorityMap({});
  };

  const filteredTeachers = teachers.filter((t) => {
    const q = teacherSearch.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.code.toLowerCase().includes(q) ||
      t.designation.toLowerCase().includes(q)
    );
  });

  const handleGenerate = () => {
    const derivedExcluded = Object.entries(subjectTiers)
      .filter(([_, t]) => t === 'EXCLUDE')
      .map(([id]) => id);

    const derivedHighPriority = Object.entries(subjectTiers)
      .filter(([_, t]) => t === 'HIGH')
      .map(([id]) => id);

    const unavailableTeachersList: UnavailableInstructor[] = absentTeacherIds.map((tid) => ({
      teacherId: tid,
      type: unavailableTypes[tid] || 'ABSENT',
      remark: unavailableRemarks[tid] || (unavailableTypes[tid] === 'LEAVE' ? 'Sanctioned Leave' : unavailableTypes[tid] === 'DUTY' ? 'Special Duty' : unavailableTypes[tid] === 'SICK' ? 'Sick' : 'Absent'),
      date,
    }));

    // 1. BLANK ROUTINE CREATION
    if (generationMode === 'blank') {
      const blankSlots: ClassSlot[] = [];
      for (const room of classrooms) {
        for (let p = 1; p <= 5; p++) {
          blankSlots.push({
            id: `slot-${dayNumber}-${room.id}-P${p}`,
            roomId: room.id,
            period: p,
            paperId: '',
            teacherId: '',
            isSubstitute: false,
            isPriority: false,
          });
        }
      }

      const blankRoutine: DailyRoutine = {
        id: isRecreating && recreatingRoutine ? recreatingRoutine.id : `routine-day-${dayNumber}-${Date.now()}`,
        dayNumber,
        date,
        absentTeacherIds,
        unavailableTeachers: unavailableTeachersList,
        priorityPaperIds: [],
        slots: blankSlots,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLocked: false,
        status: 'draft',
        notes: notes || `Manual Blank Routine for Day ${dayNumber} (${date}) - ready for slot assignment`,
      };

      onRoutineGenerated(blankRoutine);
      return;
    }

    // 2. MULTIPLE DAYS BATCH CREATION
    if (generationMode === 'multiple') {
      const generatedBatch: DailyRoutine[] = [];
      let currentHistory = [...effectiveHistory];

      for (let d = 0; d < multiDayCount; d++) {
        const currentDayNumber = dayNumber + d;
        const dDate = new Date(date);
        dDate.setDate(dDate.getDate() + d);
        const dateStr = dDate.toISOString().split('T')[0];

        const r = generateDailyRoutine({
          classrooms,
          papers,
          teachers,
          absentTeacherIds,
          priorityPaperIds: derivedHighPriority,
          roomPriorityPaperIds: priorityMode === 'roomWise' ? roomPriorityMap : {},
          subjectPriorityTiers: subjectTiers,
          prioritySubjectMinPeriods: subjectMinPeriods,
          excludedPaperIds: derivedExcluded,
          rules: localRules,
          historicalRoutines: currentHistory,
          targetDayNumber: currentDayNumber,
          targetDate: dateStr,
          notes:
            notes ||
            `STC, SAP 4th Bn Day ${currentDayNumber} Routine (${dateStr}) - Batch generated (${multiDayCount} days)`,
        });

        r.unavailableTeachers = unavailableTeachersList.map((u) => ({ ...u, date: dateStr }));
        generatedBatch.push(r);
        currentHistory.push(r);
      }

      onRoutineGenerated(generatedBatch);
      return;
    }

    // 3. SINGLE DAY STANDARD GENERATION
    const newRoutine = generateDailyRoutine({
      classrooms,
      papers,
      teachers,
      absentTeacherIds,
      priorityPaperIds: derivedHighPriority,
      roomPriorityPaperIds: priorityMode === 'roomWise' ? roomPriorityMap : {},
      subjectPriorityTiers: subjectTiers,
      prioritySubjectMinPeriods: subjectMinPeriods,
      excludedPaperIds: derivedExcluded,
      rules: localRules,
      historicalRoutines: effectiveHistory,
      targetDayNumber: dayNumber,
      targetDate: date,
      notes:
        notes ||
        `STC, SAP 4th Bn Day ${dayNumber} Routine (${date}) - ${absentTeacherIds.length} instructors unavailable, ${derivedExcluded.length} subjects excluded`,
    });

    newRoutine.unavailableTeachers = unavailableTeachersList;

    if (isRecreating && recreatingRoutine) {
      newRoutine.id = recreatingRoutine.id;
    }

    onRoutineGenerated(newRoutine);
  };

  const availableTeachersCount = teachers.length - absentTeacherIds.length;

  // Counts of tiers
  const tierCounts = {
    HIGH: Object.values(subjectTiers).filter((t) => t === 'HIGH').length,
    MEDIUM: Object.values(subjectTiers).filter((t) => t === 'MEDIUM').length,
    LOW: Object.values(subjectTiers).filter((t) => t === 'LOW').length,
    EXCLUDE: Object.values(subjectTiers).filter((t) => t === 'EXCLUDE').length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white ${
              isRecreating ? 'bg-amber-600' : 'bg-indigo-600'
            }`}>
              {isRecreating ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isRecreating
                  ? `Recreate / Overwrite Routine for Day ${dayNumber}`
                  : `Generate Daily Routine for Day ${dayNumber}`}
              </h2>
              <p className="text-xs text-slate-500">
                STC, SAP 4th Bn · 15 Classrooms · 5 Periods × 40 min (75 Total Sessions)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Generation Mode Selector */}
          {!isRecreating && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-indigo-950">
                Routine Creation Mode:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setGenerationMode('single')}
                  className={`p-2.5 rounded-lg border font-semibold flex items-center gap-2 transition-all text-left ${
                    generationMode === 'single'
                      ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs ring-2 ring-indigo-500/20'
                      : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div className="font-bold">Single Day Routine</div>
                    <div className="text-[10px] text-slate-500 font-normal">Generate Day {dayNumber}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setGenerationMode('multiple')}
                  className={`p-2.5 rounded-lg border font-semibold flex items-center gap-2 transition-all text-left ${
                    generationMode === 'multiple'
                      ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs ring-2 ring-indigo-500/20'
                      : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div className="font-bold">Multiple Days (Batch)</div>
                    <div className="text-[10px] text-slate-500 font-normal">Generate {multiDayCount} days together</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setGenerationMode('blank')}
                  className={`p-2.5 rounded-lg border font-semibold flex items-center gap-2 transition-all text-left ${
                    generationMode === 'blank'
                      ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs ring-2 ring-indigo-500/20'
                      : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <FilePlus className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div className="font-bold">New Blank Routine</div>
                    <div className="text-[10px] text-slate-500 font-normal">75 empty slots for manual edit</div>
                  </div>
                </button>
              </div>

              {generationMode === 'multiple' && (
                <div className="pt-2 border-t border-indigo-100 flex items-center justify-between text-xs">
                  <span className="text-indigo-900 font-medium">
                    Consecutive Days to Generate:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[2, 3, 4, 5, 6, 7].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setMultiDayCount(num)}
                        className={`w-7 h-7 rounded-md font-bold text-xs transition-colors ${
                          multiDayCount === num
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                    <span className="text-[11px] text-indigo-700 font-semibold ml-1">
                      (Day {dayNumber} to Day {dayNumber + multiDayCount - 1})
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Day & Date info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Training Day:
              </label>
              <div className="font-bold text-sm text-indigo-700">
                Day {dayNumber} {generationMode === 'multiple' && `to Day ${dayNumber + multiDayCount - 1}`}{' '}
                {isRecreating && <span className="text-xs text-amber-700 font-semibold">(Current Active Routine)</span>}
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {generationMode === 'multiple' ? 'Start Date:' : 'Routine Date:'}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white font-medium text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Section 1: Instructor Absences & Unavailability */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <UserX className="w-4 h-4 text-rose-600" />
                <label className="text-xs font-bold text-slate-800">
                  1. Instructor Unavailability & Leave Remarks:
                </label>
              </div>
              <span className="text-[11px] font-semibold text-slate-600">
                {availableTeachersCount}/26 Available · {absentTeacherIds.length} Unavailable
              </span>
            </div>

            <p className="text-[11px] text-slate-500 mb-2">
              Mark instructors as Absent, on Leave, on Special Duty, or Sick / Medical. Unavailable instructors are strictly excluded from generation.
            </p>

            <input
              type="text"
              placeholder="Search instructor by name or code..."
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 mb-2 bg-slate-50 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50">
              {filteredTeachers.map((t) => {
                const isAbsent = absentTeacherIds.includes(t.id);
                const currentType = unavailableTypes[t.id] || 'ABSENT';

                return (
                  <div
                    key={t.id}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-1 transition-colors ${
                      isAbsent
                        ? currentType === 'ABSENT'
                          ? 'bg-rose-50 border-rose-300 text-rose-900'
                          : currentType === 'LEAVE'
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : currentType === 'DUTY'
                          ? 'bg-blue-50 border-blue-300 text-blue-900'
                          : 'bg-purple-50 border-purple-300 text-purple-900'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold">{t.name}</p>
                      <p className="text-[9px] text-slate-500 font-mono">
                        {t.code} · {t.designation}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSetTeacherStatus(t.id, 'AVAILABLE')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                          !isAbsent
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-white text-slate-600 hover:bg-emerald-50'
                        }`}
                      >
                        Avail
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetTeacherStatus(t.id, 'ABSENT')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                          isAbsent && currentType === 'ABSENT'
                            ? 'bg-rose-600 text-white font-bold'
                            : 'bg-white text-slate-600 hover:bg-rose-50'
                        }`}
                      >
                        Abs
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetTeacherStatus(t.id, 'LEAVE')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                          isAbsent && currentType === 'LEAVE'
                            ? 'bg-amber-600 text-white font-bold'
                            : 'bg-white text-slate-600 hover:bg-amber-50'
                        }`}
                      >
                        Leave
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetTeacherStatus(t.id, 'DUTY')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                          isAbsent && currentType === 'DUTY'
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-white text-slate-600 hover:bg-blue-50'
                        }`}
                      >
                        Duty
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetTeacherStatus(t.id, 'SICK')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                          isAbsent && currentType === 'SICK'
                            ? 'bg-purple-600 text-white font-bold'
                            : 'bg-white text-slate-600 hover:bg-purple-50'
                        }`}
                      >
                        Sick
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Subject Priority Tiers & Inclusions Controller */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <label className="text-xs font-bold text-slate-900">
                  2. Subject Priority & Inclusion Tiers:
                </label>
              </div>

              {/* Mode Toggle: Priority Tiers vs Room-wise */}
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPriorityMode('tiers')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                    priorityMode === 'tiers'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Priority Tiers (High / Low / Exclude)
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityMode('roomWise')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1.5 ${
                    priorityMode === 'roomWise'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Room-Wise Option</span>
                  {Object.values(roomPriorityMap).some((arr) => arr.length > 0) && (
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  )}
                </button>
              </div>
            </div>

            {/* Explanation of the tiers */}
            {priorityMode === 'tiers' && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
                  <div className="p-1.5 rounded bg-amber-50 border border-amber-200 text-amber-900">
                    <span className="font-bold">High (+50%):</span> +50% more subject allocation (max 15 classes)
                  </div>
                  <div className="p-1.5 rounded bg-teal-50 border border-teal-200 text-teal-900">
                    <span className="font-bold">Low (-50%):</span> -50% less subject allocation
                  </div>
                  <div className="p-1.5 rounded bg-rose-50 border border-rose-200 text-rose-900">
                    <span className="font-bold">Exclude (0%):</span> Completely omitted from routine
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    <span className="text-slate-500">Configured:</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                      {tierCounts.HIGH} High (+50%)
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                      {tierCounts.LOW} Low (-50%)
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                      {tierCounts.EXCLUDE} Excluded
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={resetAllTiers}
                    className="text-[10px] text-slate-500 hover:text-slate-800 underline font-semibold"
                  >
                    Reset all to Normal
                  </button>
                </div>

                {/* Search subjects */}
                <input
                  type="text"
                  placeholder="Filter subjects by paper code or name..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />

                {/* Subject tiers list */}
                <div className="space-y-1.5 max-h-56 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                  {papers
                    .filter(
                      (p) =>
                        p.code.toLowerCase().includes(subjectSearch.toLowerCase()) ||
                        p.title.toLowerCase().includes(subjectSearch.toLowerCase())
                    )
                    .map((p) => {
                      const currentTier = subjectTiers[p.id] || 'NORMAL';
                      const stat = cumulativeStats.find((s) => s.paperId === p.id);
                      return (
                        <div
                          key={p.id}
                          className={`p-2 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${
                            currentTier === 'HIGH'
                              ? 'bg-amber-50/70 border-amber-300'
                              : currentTier === 'MEDIUM'
                              ? 'bg-blue-50/70 border-blue-300'
                              : currentTier === 'LOW'
                              ? 'bg-teal-50/70 border-teal-300'
                              : currentTier === 'EXCLUDE'
                              ? 'bg-rose-50/70 border-rose-300 opacity-80'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: p.color }}
                            ></span>
                            <div className="truncate">
                              <p className="font-bold text-xs text-slate-900 truncate">
                                {p.code}: {p.title}
                              </p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                15-Classroom Target: {stat?.targetSessions || p.totalTargetSessions * 15} · Completed: {stat?.completedSessions || 0}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto shrink-0">
                            {/* Segmented Tier Buttons: High (1.50x), Medium (1.00x), Low (0.50x), Exclude (0.00x) */}
                            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[10px] font-bold shrink-0">
                              <button
                                type="button"
                                onClick={() => setPaperTier(p.id, 'HIGH')}
                                className={`px-2 py-1 rounded transition-all ${
                                  currentTier === 'HIGH'
                                    ? 'bg-amber-500 text-white shadow-2xs font-extrabold'
                                    : 'text-slate-600 hover:text-amber-800'
                                }`}
                                title="High Priority (1.50x multiplier: +50% allocation)"
                              >
                                High (1.50x)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaperTier(p.id, 'MEDIUM')}
                                className={`px-2 py-1 rounded transition-all ${
                                  currentTier === 'MEDIUM' || currentTier === 'NORMAL'
                                    ? 'bg-slate-300 text-slate-900 shadow-2xs font-bold'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                                title="Medium Priority (1.00x multiplier: baseline remaining demand)"
                              >
                                Medium (1.00x)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaperTier(p.id, 'LOW')}
                                className={`px-2 py-1 rounded transition-all ${
                                  currentTier === 'LOW'
                                    ? 'bg-teal-600 text-white shadow-2xs font-extrabold'
                                    : 'text-slate-600 hover:text-teal-800'
                                }`}
                                title="Low Priority (0.50x multiplier: -50% allocation)"
                              >
                                Low (0.50x)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaperTier(p.id, 'EXCLUDE')}
                                className={`px-2 py-1 rounded transition-all ${
                                  currentTier === 'EXCLUDE'
                                    ? 'bg-rose-600 text-white shadow-2xs font-extrabold'
                                    : 'text-slate-600 hover:text-rose-800'
                                }`}
                                title="Exclude (0.00x multiplier: completely omitted from routine)"
                              >
                                Exclude (0)
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Room-Wise Classroom Selector Strip */}
            {priorityMode === 'roomWise' && (
              <div className="space-y-2 bg-slate-100/70 p-2.5 rounded-lg border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-700">
                    Active Room:{' '}
                    <strong className="text-indigo-700">
                      {classrooms.find((c) => c.id === selectedRoomIdForPriority)?.name || 'Select Room'}
                    </strong>{' '}
                    ({classrooms.find((c) => c.id === selectedRoomIdForPriority)?.building === 'OLD' ? 'Old Bldg' : 'New Bldg'})
                  </span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => copyPriorityToAllRooms(selectedRoomIdForPriority)}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-50 font-semibold text-slate-700 shadow-2xs"
                    >
                      Copy to All 15 Rooms
                    </button>
                    <button
                      type="button"
                      onClick={() => copyPriorityToBuilding(selectedRoomIdForPriority, 'OLD')}
                      className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 font-semibold text-amber-800"
                    >
                      Copy to Old Bldg
                    </button>
                    <button
                      type="button"
                      onClick={() => copyPriorityToBuilding(selectedRoomIdForPriority, 'NEW')}
                      className="px-2 py-0.5 bg-sky-50 border border-sky-200 rounded hover:bg-sky-100 font-semibold text-sky-800"
                    >
                      Copy to New Bldg
                    </button>
                    <button
                      type="button"
                      onClick={clearAllRoomPriorities}
                      className="px-2 py-0.5 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 font-semibold text-rose-700"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {classrooms.map((r) => {
                    const isSelected = r.id === selectedRoomIdForPriority;
                    const count = (roomPriorityMap[r.id] || []).length;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRoomIdForPriority(r.id)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                            : count > 0
                            ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{r.building === 'OLD' ? 'Old' : 'New'}: {r.name}</span>
                        {count > 0 && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Papers list for room-wise selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-white">
                  {papers.map((p) => {
                    const isSelected = (roomPriorityMap[selectedRoomIdForPriority] || []).includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleRoomPriorityPaper(p.id)}
                        className={`p-2 rounded-lg text-left text-xs transition-colors border flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-amber-50 border-amber-400 text-amber-950 font-semibold ring-1 ring-amber-300'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: p.color }}
                          ></span>
                          <div className="truncate">
                            <p className="font-semibold text-[11px] truncate">
                              {p.code}: {p.title}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold shrink-0">
                            ★ Priority
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Routine Generation Constraint Checks */}
          <div className="border border-slate-200 rounded-xl bg-slate-50/70 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsRulesExpanded(!isRulesExpanded)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    4. Routine Generation Rules & Constraint Checks
                  </span>
                  <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {MASTER_ROUTINE_RULES.filter((r) => Boolean(localRules[r.key])).length}/{MASTER_ROUTINE_RULES.length} Active
                  </span>
                </div>
              </div>
              {isRulesExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {isRulesExpanded && (
              <div className="p-3.5 pt-0 border-t border-slate-200/80 space-y-3 mt-2">
                {/* Priority Hierarchy notice */}
                <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                  <strong>Priority Hierarchy:</strong> Tier 1 (Hard Rules: 1, 2, 3, 4, 5, 6, 6A, 6B, 7) &gt; Tier 2 (Curriculum Rules 10–16) &gt; Tier 3 (Staffing Rules 17–24). Any conflict is resolved in favor of the higher tier.
                </div>

                {[
                  {
                    tier: 'Tier 1: Inviolable Operational Constraints (Hard Rules: 1, 2, 3, 4, 5, 6, 6A, 6B, 7)',
                    rules: MASTER_ROUTINE_RULES.filter((r) => r.tierNumber === 1),
                  },
                  {
                    tier: 'Tier 2: Curriculum Progression & Subject Detailment (Moto I & IV: Rules 10–16)',
                    rules: MASTER_ROUTINE_RULES.filter((r) => r.tierNumber === 2),
                  },
                  {
                    tier: 'Tier 3: Faculty Staffing & Workload Management (Moto III: Rules 17–24)',
                    rules: MASTER_ROUTINE_RULES.filter((r) => r.tierNumber === 3),
                  },
                ].map((tierGroup, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100/70 px-2 py-0.5 rounded">
                      {tierGroup.tier}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {tierGroup.rules.map((rule) => {
                        const disabled = isRuleDisabled(rule.key as keyof RoutineRuleConfig, localRules);
                        const isChecked = !disabled && Boolean(localRules[rule.key as keyof RoutineRuleConfig]);
                        return (
                          <label
                            key={rule.key}
                            title={disabled ? (rule.disabledHint || 'Disabled by rule dependency') : rule.description}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs select-none transition ${
                              disabled
                                ? 'bg-slate-100/50 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
                                : isChecked
                                ? 'bg-white border-blue-200 text-slate-900 font-medium shadow-2xs cursor-pointer'
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-pointer'
                            }`}
                          >
                            <span className="truncate pr-2">
                              {rule.title}
                              {disabled && <span className="block text-[10px] text-amber-700 font-normal">↳ {rule.disabledHint}</span>}
                            </span>
                            <input
                              type="checkbox"
                              disabled={disabled}
                              checked={isChecked}
                              onChange={() => {
                                if (disabled) return;
                                setLocalRules((prev) =>
                                  normalizeRuleConfig({
                                    ...prev,
                                    [rule.key]: !prev[rule.key as keyof RoutineRuleConfig],
                                  })
                                );
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optional Directive Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Routine Reference / Directive (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. Special training routine, scenario drills, or firing range session..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg text-white shadow-xs flex items-center gap-1.5 ${
              isRecreating
                ? 'bg-amber-600 hover:bg-amber-700'
                : generationMode === 'blank'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isRecreating ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : generationMode === 'blank' ? (
              <FilePlus className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>
              {isRecreating
                ? `Regenerate & Overwrite Day ${dayNumber}`
                : generationMode === 'blank'
                ? `Create Blank Routine (Day ${dayNumber})`
                : generationMode === 'multiple'
                ? `Generate Batch (${multiDayCount} Days)`
                : `Generate & Save Day ${dayNumber} Routine`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
