/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Classroom, DailyRoutine, Paper, RoutineRuleConfig, SubjectPriorityTier, Teacher } from '../types';
import { calculateCumulativeStats, generateDailyRoutine } from '../utils/scheduler';
import { DEFAULT_ROUTINE_RULES } from '../data/initialData';
import {
  AlertCircle,
  Ban,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  Info,
  Layers,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  UserX,
  X,
} from 'lucide-react';

interface RoutineGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoutineGenerated: (newRoutine: DailyRoutine) => void;
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

  const [localRules, setLocalRules] = useState<RoutineRuleConfig>(rules || DEFAULT_ROUTINE_RULES);
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
        `STC, SAP 4th Bn Day ${dayNumber} Routine (${date}) - ${absentTeacherIds.length} instructors on leave, ${derivedExcluded.length} subjects excluded`,
    });

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
          {/* Day & Date info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Training Day:
              </label>
              <div className="font-bold text-sm text-indigo-700">
                Day {dayNumber} {isRecreating && <span className="text-xs text-amber-700 font-semibold">(Current Active Routine)</span>}
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Routine Date:
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white font-medium text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Section 1: Instructor Absences */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <UserX className="w-4 h-4 text-rose-600" />
                <label className="text-xs font-bold text-slate-800">
                  1. Mark Instructor Absences / Leave:
                </label>
              </div>
              <span className="text-[11px] font-semibold text-slate-600">
                {availableTeachersCount}/26 Available · {absentTeacherIds.length} On Leave
              </span>
            </div>

            <p className="text-[11px] text-slate-500 mb-2">
              Instructors marked on leave are 100% excluded from today's routine. Qualified substitutes will automatically step in without timetable clashes.
            </p>

            <input
              type="text"
              placeholder="Search instructor by name or code..."
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 mb-2 bg-slate-50 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50">
              {filteredTeachers.map((t) => {
                const isAbsent = absentTeacherIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleAbsentTeacher(t.id)}
                    className={`p-1.5 rounded-lg text-left text-xs transition-colors border flex items-center justify-between gap-1 ${
                      isAbsent
                        ? 'bg-rose-100 border-rose-300 text-rose-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium">{t.name}</p>
                      <p className="text-[9px] text-slate-500 font-mono">{t.code}</p>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        isAbsent ? 'bg-rose-200 text-rose-900' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isAbsent ? 'Leave' : 'Active'}
                    </span>
                  </button>
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
                            {/* Segmented Tier Buttons */}
                            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[10px] font-bold shrink-0">
                              <button
                                type="button"
                                onClick={() => setPaperTier(p.id, 'HIGH')}
                                className={`px-2 py-1 rounded transition-all ${
                                  currentTier === 'HIGH'
                                    ? 'bg-amber-500 text-white shadow-2xs font-extrabold'
                                    : 'text-slate-600 hover:text-amber-800'
                                }`}
                                title="+50% more subject detailment than baseline (max 15 classrooms)"
                              >
                                High (+50%)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaperTier(p.id, 'NORMAL')}
                                className={`px-2 py-1 rounded transition-all ${
                                  currentTier === 'NORMAL'
                                    ? 'bg-slate-300 text-slate-900 shadow-2xs font-bold'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                                title="Standard baseline proportional to remaining session percentage"
                              >
                                Normal
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaperTier(p.id, 'LOW')}
                                className={`px-2 py-1 rounded transition-all ${
                                  currentTier === 'LOW'
                                    ? 'bg-teal-600 text-white shadow-2xs font-extrabold'
                                    : 'text-slate-600 hover:text-teal-800'
                                }`}
                                title="-50% less subject detailment than baseline"
                              >
                                Low (-50%)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaperTier(p.id, 'EXCLUDE')}
                                className={`px-2 py-1 rounded transition-all ${
                                  currentTier === 'EXCLUDE'
                                    ? 'bg-rose-600 text-white shadow-2xs font-extrabold'
                                    : 'text-slate-600 hover:text-rose-800'
                                }`}
                                title="Completely omitted from routine (0 classes)"
                              >
                                Exclude (0)
                              </button>
                            </div>

                            {/* Guaranteed Minimum Periods Stepper for Priority Subjects */}
                            {['HIGH', 'MEDIUM', 'LOW'].includes(currentTier) && (
                              <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-lg px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow-2xs">
                                <span className="text-[9px] text-amber-700 uppercase tracking-wider font-semibold">Min:</span>
                                <button
                                  type="button"
                                  onClick={() => updateMinPeriods(p.id, -1)}
                                  className="w-4 h-4 rounded bg-white hover:bg-amber-100 border border-amber-300 flex items-center justify-center font-bold text-amber-900 leading-none"
                                  title="Decrease guaranteed minimum periods"
                                >
                                  -
                                </button>
                                <span className="w-5 text-center font-mono font-extrabold text-amber-900">
                                  {subjectMinPeriods[p.id] ?? (currentTier === 'HIGH' ? 15 : currentTier === 'MEDIUM' ? 9 : 3)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateMinPeriods(p.id, 1)}
                                  className="w-4 h-4 rounded bg-white hover:bg-amber-100 border border-amber-300 flex items-center justify-center font-bold text-amber-900 leading-none"
                                  title="Increase guaranteed minimum periods"
                                >
                                  +
                                </button>
                                <span className="text-[9px] text-amber-600 font-normal">periods</span>
                              </div>
                            )}
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
                    {Object.values(localRules).filter(Boolean).length}/{Object.keys(localRules).length} Active
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
              <div className="p-3.5 pt-0 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {[
                  { key: 'enableWorkloadEqualization', label: 'Workload & Session Equalization' },
                  { key: 'enablePaperRotationalFlow', label: 'Subject / Paper Rotational Caravan Flow' },
                  { key: 'enableCaravanFlow', label: 'Instructor Caravan Flow (Default: OFF)' },
                  { key: 'enableBuildingChangeGap', label: '1-Period Gap on Building Shift' },
                  { key: 'enableDayToDayProgression', label: 'Day-to-Day Room Carryover' },
                  { key: 'enableZeroDoubleBooking', label: 'Strict Zero Double-Booking' },
                  { key: 'enableStrictAbsenteeExclusion', label: 'Strict Absentee Exclusion' },
                  { key: 'enableDesignatedBackup', label: 'Designated Backup Substitution' },
                  { key: 'enableCrossMutualBackup', label: 'Cross-Subject Mutual Backup' },
                  { key: 'enableSubjectPriorityTiers', label: 'Percentage-Based Priority Scaling (High: +50%, Low: -50%)' },
                  { key: 'enableProportionalRemainingRatio', label: 'Proportional Remaining Quota Fill-Up (75 Sessions)' },
                  { key: 'enableGuaranteedPriorityPeriods', label: 'Guaranteed Priority Minimum Periods Delivery' },
                  { key: 'enableClassroomSubjectEqualization', label: 'Classroom Subject Quota % Equalization' },
                  { key: 'enableRoomQuotaCompletionLock', label: 'Classroom 100% Quota Completion Lock' },
                  { key: 'enableMaxRoomDailyLimit', label: 'Max 2 Periods/Subject in Room' },
                  { key: 'enableDailyWorkloadSoftCap', label: 'Daily Load Soft-Cap (<= 3 Periods)' },
                  { key: 'enablePracticalFlexible', label: 'Flexible Practical Staffing' },
                ].map((rule) => {
                  const isChecked = Boolean(localRules[rule.key as keyof RoutineRuleConfig]);
                  return (
                    <label
                      key={rule.key}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer select-none transition ${
                        isChecked
                          ? 'bg-white border-blue-200 text-slate-900 font-medium shadow-2xs'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    >
                      <span>{rule.label}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          setLocalRules((prev) => ({
                            ...prev,
                            [rule.key]: !prev[rule.key as keyof RoutineRuleConfig],
                          }))
                        }
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  );
                })}
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
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isRecreating ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isRecreating ? `Regenerate & Overwrite Day ${dayNumber}` : 'Generate & Save Routine'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
