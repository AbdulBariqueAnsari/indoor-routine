/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Classroom, DailyRoutine, Paper, Teacher } from '../types';
import {
  BookOpen,
  Building,
  CheckCircle2,
  Clock,
  Filter,
  GraduationCap,
  LayoutGrid,
  List,
  MapPin,
  Search,
  Sparkles,
  User,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';

interface TeacherDeploymentTrackerProps {
  teachers: Teacher[];
  papers: Paper[];
  classrooms: Classroom[];
  allRoutines: DailyRoutine[];
  currentRoutine: DailyRoutine | null;
}

export interface TeacherClassPaperDetail {
  roomId: string;
  roomName: string;
  building: string;
  paperId: string;
  paperCode: string;
  paperTitle: string;
  paperColor: string;
  pastSessions: number;
  todaySessions: number;
  totalSessions: number;
  periodsToday: number[]; // which periods today (1..5)
}

export interface TeacherTrackingStats {
  teacher: Teacher;
  primaryPaperNames: string;
  backupPaperNames: string;
  isOnLeaveToday: boolean;
  todayPeriodsCount: number;
  totalSessionsCount: number;
  // Today's period by period assignment (Period 1..5)
  todaySlots: {
    period: number;
    roomId: string;
    roomName: string;
    building: string;
    paperId: string;
    paperCode: string;
    paperTitle: string;
    paperColor: string;
    isSubstitute: boolean;
  }[];
  // Breakdown by classroom and paper
  classDeployments: TeacherClassPaperDetail[];
  // Summary rooms list
  visitedRoomNames: string[];
}

export const TeacherDeploymentTracker: React.FC<TeacherDeploymentTrackerProps> = ({
  teachers,
  papers,
  classrooms,
  allRoutines,
  currentRoutine,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectRef, setSelectedSubjectRef] = useState<string>('ALL');
  const [focusedTeacherId, setFocusedTeacherId] = useState<string>('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('ALL');
  const [selectedPaperFilter, setSelectedPaperFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LEAVE'>('ALL');

  const paperMap = useMemo(() => new Map(papers.map((p) => [p.id, p])), [papers]);
  const classroomMap = useMemo(() => new Map(classrooms.map((c) => [c.id, c])), [classrooms]);

  // Exclude currentRoutine from past routines to prevent double-counting
  const pastRoutines = useMemo(() => {
    if (!currentRoutine) return allRoutines;
    return allRoutines.filter((r) => r.id !== currentRoutine.id);
  }, [allRoutines, currentRoutine]);

  const currentSlots = useMemo(() => currentRoutine?.slots || [], [currentRoutine]);
  const absentSet = useMemo(
    () => new Set((currentRoutine?.absentTeacherIds || []).map((id) => id.replace(/^T0*/, 'T'))),
    [currentRoutine]
  );

  // Normalization helper (e.g. 'T01' -> 'T1')
  const norm = (id: string) => (id ? id.replace(/^T0*/, 'T') : '');

  // Compute full deployment stats for each instructor
  const trackingData: TeacherTrackingStats[] = useMemo(() => {
    return teachers.map((teacher) => {
      const tNormId = norm(teacher.id);
      const isOnLeaveToday = absentSet.has(tNormId);

      // Primary paper names
      const primaryPaperNames = teacher.primaryPaperIds
        .map((pid) => {
          const p = paperMap.get(pid);
          return p ? `${p.code} (${p.title})` : pid;
        })
        .join(', ') || 'General / Practical';

      // Backup paper names
      const backupPaperNames = (teacher.backupPaperIds || [])
        .map((pid) => {
          const p = paperMap.get(pid);
          return p ? `${p.code}` : pid;
        })
        .join(', ') || 'None';

      // Today's assigned slots for this teacher
      const todayTeacherSlots = currentSlots
        .filter((s) => norm(s.teacherId) === tNormId)
        .sort((a, b) => a.period - b.period)
        .map((s) => {
          const r = classroomMap.get(s.roomId);
          const p = paperMap.get(s.paperId);
          return {
            period: s.period,
            roomId: s.roomId,
            roomName: r?.name || s.roomId,
            building: r?.building || 'OLD',
            paperId: s.paperId,
            paperCode: p?.code || s.paperId,
            paperTitle: p?.title || 'Unknown Subject',
            paperColor: p?.color || '#4F46E5',
            isSubstitute: s.isSubstitute,
          };
        });

      // Track Room + Paper deployments across past routines + today
      // key: `${roomId}_${paperId}`
      const deploymentMap = new Map<string, TeacherClassPaperDetail>();

      // 1. Past routines
      for (const r of pastRoutines) {
        for (const s of r.slots) {
          if (norm(s.teacherId) === tNormId) {
            const key = `${s.roomId}_${s.paperId}`;
            const existing = deploymentMap.get(key);
            if (existing) {
              existing.pastSessions++;
              existing.totalSessions++;
            } else {
              const cl = classroomMap.get(s.roomId);
              const pp = paperMap.get(s.paperId);
              deploymentMap.set(key, {
                roomId: s.roomId,
                roomName: cl?.name || s.roomId,
                building: cl?.building || 'OLD',
                paperId: s.paperId,
                paperCode: pp?.code || s.paperId,
                paperTitle: pp?.title || 'Unknown Subject',
                paperColor: pp?.color || '#4F46E5',
                pastSessions: 1,
                todaySessions: 0,
                totalSessions: 1,
                periodsToday: [],
              });
            }
          }
        }
      }

      // 2. Today's routine
      for (const s of currentSlots) {
        if (norm(s.teacherId) === tNormId) {
          const key = `${s.roomId}_${s.paperId}`;
          const existing = deploymentMap.get(key);
          if (existing) {
            existing.todaySessions++;
            existing.totalSessions++;
            existing.periodsToday.push(s.period);
          } else {
            const cl = classroomMap.get(s.roomId);
            const pp = paperMap.get(s.paperId);
            deploymentMap.set(key, {
              roomId: s.roomId,
              roomName: cl?.name || s.roomId,
              building: cl?.building || 'OLD',
              paperId: s.paperId,
              paperCode: pp?.code || s.paperId,
              paperTitle: pp?.title || 'Unknown Subject',
              paperColor: pp?.color || '#4F46E5',
              pastSessions: 0,
              todaySessions: 1,
              totalSessions: 1,
              periodsToday: [s.period],
            });
          }
        }
      }

      const classDeployments = Array.from(deploymentMap.values()).sort((a, b) => {
        // Sort by room id, then paper code
        if (a.roomId !== b.roomId) return a.roomId.localeCompare(b.roomId);
        return a.paperCode.localeCompare(b.paperCode);
      });

      const visitedRoomNames = Array.from(new Set(classDeployments.map((d) => d.roomName)));
      const totalSessionsCount = classDeployments.reduce((acc, d) => acc + d.totalSessions, 0);

      return {
        teacher,
        primaryPaperNames,
        backupPaperNames,
        isOnLeaveToday,
        todayPeriodsCount: todayTeacherSlots.length,
        totalSessionsCount,
        todaySlots: todayTeacherSlots,
        classDeployments,
        visitedRoomNames,
      };
    });
  }, [teachers, currentSlots, pastRoutines, absentSet, classroomMap, paperMap]);

  // Filtered teachers list
  const filteredData = useMemo(() => {
    return trackingData.filter((item) => {
      // Search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchName = item.teacher.name.toLowerCase().includes(query);
        const matchCode = item.teacher.code.toLowerCase().includes(query);
        const matchSubject = item.primaryPaperNames.toLowerCase().includes(query);
        const matchRoom = item.visitedRoomNames.some((rn) => rn.toLowerCase().includes(query));
        if (!matchName && !matchCode && !matchSubject && !matchRoom) return false;
      }

      // Status filter
      if (statusFilter === 'ACTIVE' && item.isOnLeaveToday) return false;
      if (statusFilter === 'LEAVE' && !item.isOnLeaveToday) return false;

      // Room filter
      if (selectedRoomFilter !== 'ALL') {
        const hasRoom = item.classDeployments.some((d) => d.roomId === selectedRoomFilter);
        if (!hasRoom) return false;
      }

      // Paper filter
      if (selectedPaperFilter !== 'ALL') {
        const hasPaper = item.classDeployments.some((d) => d.paperId === selectedPaperFilter);
        if (!hasPaper) return false;
      }

      return true;
    });
  }, [trackingData, searchTerm, statusFilter, selectedRoomFilter, selectedPaperFilter]);

  // Total summary metrics
  const totalClassesConducted = useMemo(() => {
    return trackingData.reduce((acc, curr) => acc + curr.totalSessionsCount, 0);
  }, [trackingData]);

  const activeTodayCount = useMemo(() => {
    return trackingData.filter((t) => !t.isOnLeaveToday).length;
  }, [trackingData]);

  // Instructors filtered by main subject reference for the personal selector
  const instructorsForSubjectRef = useMemo(() => {
    if (selectedSubjectRef === 'ALL') return teachers;
    return teachers.filter(
      (t) => t.primaryPaperIds.includes(selectedSubjectRef) || (t.backupPaperIds || []).includes(selectedSubjectRef)
    );
  }, [teachers, selectedSubjectRef]);

  // Focused instructor details when an instructor selects their name
  const focusedItem = useMemo(() => {
    if (!focusedTeacherId) return null;
    return trackingData.find((t) => norm(t.teacher.id) === norm(focusedTeacherId)) || null;
  }, [focusedTeacherId, trackingData]);

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                <Users className="w-5 h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Instructor Class & Paper Deployment Tracker
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Public & Administrative transparency ledger: Track exactly which instructor has taught which paper in which classroom, up to each period today.
            </p>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0 text-xs font-semibold">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Instructor Cards</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'matrix'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Deployment Grid</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              Total Faculty
            </div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">26 Instructors</div>
            <div className="text-[10px] text-slate-500 mt-0.5">T1 to T26 (All Floating)</div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-lg">
            <div className="text-[11px] font-medium text-emerald-800 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              Active on Duty Today
            </div>
            <div className="text-xl font-bold text-emerald-950 mt-0.5">{activeTodayCount} Instructors</div>
            <div className="text-[10px] text-emerald-700 mt-0.5">
              {26 - activeTodayCount} on leave today
            </div>
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-200/80 rounded-lg">
            <div className="text-[11px] font-medium text-indigo-800 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
              Total Sessions Delivered
            </div>
            <div className="text-xl font-bold text-indigo-950 mt-0.5">{totalClassesConducted} Sessions</div>
            <div className="text-[10px] text-indigo-700 mt-0.5">Campus Cumulative across all classrooms</div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-lg">
            <div className="text-[11px] font-medium text-amber-800 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-amber-600" />
              Coverage Classrooms
            </div>
            <div className="text-xl font-bold text-amber-950 mt-0.5">15 Classrooms</div>
            <div className="text-[10px] text-amber-700 mt-0.5">OB-1 to OB-8 & NB-1 to NB-7</div>
          </div>
        </div>

        {/* INSTRUCTOR SELF-LOOKUP BY MAIN SUBJECT REFERENCE */}
        <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-teal-50 border border-indigo-200/80 rounded-xl p-3.5 mt-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-indigo-600 text-white shadow-2xs">
                <UserCheck className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-indigo-950">
                  Instructor Personal Portal: Find By Main Subject Reference
                </h4>
                <p className="text-[11px] text-slate-600">
                  Select your Main Subject, then select your Name to view your dedicated classroom-by-classroom & period-by-period deployment details.
                </p>
              </div>
            </div>
            {focusedTeacherId && (
              <button
                onClick={() => setFocusedTeacherId('')}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 shadow-2xs transition-colors"
              >
                ← Return to All Instructors View
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* 1. Main Subject Selector */}
            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>1. Select Main Subject / Reference Paper:</span>
              </label>
              <select
                value={selectedSubjectRef}
                onChange={(e) => {
                  setSelectedSubjectRef(e.target.value);
                  setFocusedTeacherId('');
                }}
                className="w-full text-xs rounded-lg border border-indigo-300 px-3 py-2 bg-white text-indigo-950 font-semibold focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              >
                <option value="ALL">All Subjects (Paper-1 to Paper-13)</option>
                {papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}: {p.title}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Instructor Name Selector */}
            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. Select Instructor Name ({instructorsForSubjectRef.length} Available):</span>
              </label>
              <select
                value={focusedTeacherId}
                onChange={(e) => setFocusedTeacherId(e.target.value)}
                className="w-full text-xs rounded-lg border border-indigo-300 px-3 py-2 bg-white text-indigo-950 font-bold focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              >
                <option value="">-- Click here to select your name --</option>
                {instructorsForSubjectRef.map((t) => {
                  const pMain = papers.find((p) => p.id === t.primaryPaperIds[0]);
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code}) • Main: {pMain?.code || 'General'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-100">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Instructor (e.g. T5 or Rajesh)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 pl-9 pr-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filter by Classroom */}
          <div>
            <select
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Classrooms (15 Rooms)</option>
              <optgroup label="Old School Building (OB-1 to OB-8)">
                {classrooms
                  .filter((c) => c.building === 'OLD')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id}) - Old Bldg
                    </option>
                  ))}
              </optgroup>
              <optgroup label="New School Building (NB-1 to NB-7)">
                {classrooms
                  .filter((c) => c.building === 'NEW')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id}) - New Bldg
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* Filter by Subject Paper */}
          <div>
            <select
              value={selectedPaperFilter}
              onChange={(e) => setSelectedPaperFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Subject Papers (Paper 1–13)</option>
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'LEAVE')}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses (26 Teachers)</option>
              <option value="ACTIVE">Active on Duty Today</option>
              <option value="LEAVE">On Leave / Absent Today</option>
            </select>
          </div>
        </div>
      </div>

      {/* FOCUSED INDIVIDUAL INSTRUCTOR DOSSIER (SUBJECT & CLASSROOM SPECIFIC) */}
      {focusedItem ? (
        <div className="space-y-4">
          {/* Dossier Header Banner */}
          <div className="bg-indigo-900 text-white p-4 sm:p-5 rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white text-indigo-950 font-extrabold text-base flex items-center justify-center shadow-sm">
                {focusedItem.teacher.code}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold">{focusedItem.teacher.name}</h3>
                  {focusedItem.isOnLeaveToday ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-400/30 flex items-center gap-1">
                      <UserX className="w-2.5 h-2.5" />
                      On Leave Today
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 flex items-center gap-1">
                      <UserCheck className="w-2.5 h-2.5" />
                      Active on Duty Today
                    </span>
                  )}
                </div>
                <p className="text-xs text-indigo-200 mt-0.5">
                  {focusedItem.teacher.designation || 'Training Instructor'} • Campus Base: {focusedItem.teacher.assignedBuilding || 'FLOATING'}
                </p>
                {focusedItem.teacher.phone && (
                  <p className="text-[11px] text-indigo-300 font-mono mt-0.5">
                    📞 {focusedItem.teacher.phone} {focusedItem.teacher.email ? `• ✉️ ${focusedItem.teacher.email}` : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFocusedTeacherId('')}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold border border-white/20 transition-colors"
              >
                ← Back to All Instructors
              </button>
            </div>
          </div>

          {/* Quick Metrics & Subject Mapping Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Subject Assignments */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Subject Specializations</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Main Subject:</span>{' '}
                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {focusedItem.primaryPaperNames}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Backup 1 & 2 (Floating):</span>{' '}
                  <span className="font-semibold text-emerald-800">
                    {focusedItem.backupPaperNames}
                  </span>
                </div>
              </div>
            </div>

            {/* Today's Load */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Today's Live Load</span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {focusedItem.todayPeriodsCount} <span className="text-xs font-semibold text-slate-500">of 5 Periods</span>
              </div>
              <div className="text-[11px] text-emerald-700 font-medium">
                {focusedItem.isOnLeaveToday ? 'Absent / On Leave' : 'Normal scheduled duty'}
              </div>
            </div>

            {/* Total Campus Cumulative */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                <span>Total Delivered Sessions</span>
              </div>
              <div className="text-2xl font-black text-indigo-950">
                {focusedItem.totalSessionsCount} <span className="text-xs font-semibold text-slate-500">Sessions</span>
              </div>
              <div className="text-[11px] text-indigo-700 font-medium">
                Covered across {focusedItem.visitedRoomNames.length} of 15 campus classrooms
              </div>
            </div>
          </div>

          {/* Today's Period-by-Period Timeline */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Today's Period-by-Period Deployment Detail:</span>
            </h4>

            {focusedItem.isOnLeaveToday ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                Instructor marked on leave today. No classroom periods scheduled.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                {[1, 2, 3, 4, 5].map((periodNum) => {
                  const slot = focusedItem.todaySlots.find((s) => s.period === periodNum);
                  return (
                    <div
                      key={periodNum}
                      className={`p-3 rounded-xl border text-xs flex flex-col justify-between min-h-[90px] transition-all ${
                        slot
                          ? 'bg-white border-indigo-300 shadow-2xs ring-2 ring-indigo-50'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className={slot ? 'text-indigo-900' : 'text-slate-400'}>
                          Period {periodNum}
                        </span>
                        {slot ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        ) : (
                          <span className="text-[10px] font-normal text-slate-400">Free / Break</span>
                        )}
                      </div>

                      {slot ? (
                        <div className="mt-1.5 space-y-1">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span>{slot.roomName}</span>
                            <span className="text-[10px] font-normal text-slate-500">
                              ({slot.building === 'OLD' ? 'Old Bldg' : 'New Bldg'})
                            </span>
                          </div>
                          <div
                            className="text-[11px] font-bold px-1.5 py-0.5 rounded text-white truncate"
                            style={{ backgroundColor: slot.paperColor }}
                          >
                            {slot.paperCode} · {slot.paperTitle}
                          </div>
                          {slot.isSubstitute && (
                            <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1 py-0.2 rounded border border-amber-300 inline-block">
                              Substitute Duty
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic">No class assigned</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CLASSROOM-SPECIFIC DEPLOYMENT LEDGER (All 15 Classrooms) */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-indigo-600" />
                <span>Classroom-Specific Deployment Ledger (All 15 Classrooms)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed record of sessions delivered by {focusedItem.teacher.name} in each classroom across training days.
              </p>
            </div>

            {/* Building 1: Old School Building */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <h5 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Old School Building (Room No. 1 to Room No. 8 • Capacity: 70 each)</span>
                </h5>
                <span className="text-[11px] text-slate-500">8 Classrooms</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {classrooms
                  .filter((c) => c.building === 'OLD')
                  .map((room) => {
                    const roomDeploys = focusedItem.classDeployments.filter((d) => d.roomId === room.id);
                    const totalInRoom = roomDeploys.reduce((sum, d) => sum + d.totalSessions, 0);
                    const todayInRoom = roomDeploys.reduce((sum, d) => sum + d.todaySessions, 0);
                    const periodsInRoom = roomDeploys.flatMap((d) => d.periodsToday);

                    return (
                      <div
                        key={room.id}
                        className={`p-3 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                          todayInRoom > 0
                            ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-100 shadow-2xs'
                            : totalInRoom > 0
                            ? 'bg-white border-slate-200 shadow-2xs hover:border-indigo-300'
                            : 'bg-slate-50/70 border-slate-200/80 text-slate-400'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs">{room.name}</span>
                            {todayInRoom > 0 ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white shadow-2xs">
                                Active Today (P{periodsInRoom.join(',')})
                              </span>
                            ) : totalInRoom > 0 ? (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Visited
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Not Assigned</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                            Floor {room.floor} • Cap: {room.capacity}
                          </div>

                          {/* Subjects delivered in this room */}
                          {roomDeploys.length > 0 ? (
                            <div className="mt-2 space-y-1.5 pt-1.5 border-t border-slate-100">
                              {roomDeploys.map((d) => (
                                <div key={d.paperId} className="flex items-center justify-between text-[11px]">
                                  <span
                                    className="px-1.5 py-0.2 rounded text-white font-mono font-bold text-[10px]"
                                    style={{ backgroundColor: d.paperColor }}
                                  >
                                    {d.paperCode}
                                  </span>
                                  <div className="text-right">
                                    <span className="font-bold text-slate-900">{d.totalSessions} sessions</span>
                                    {d.todaySessions > 0 && (
                                      <span className="text-[10px] text-emerald-700 font-bold ml-1">
                                        (+{d.todaySessions} today)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-[10px] text-slate-400 italic pt-1.5 border-t border-slate-100">
                              No sessions conducted yet
                            </div>
                          )}
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-semibold">
                          <span className="text-slate-500">Room Total:</span>
                          <span className="text-indigo-950 font-bold">{totalInRoom} sessions</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Building 2: New School Building */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <h5 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  <span>New School Building (Room No. 1 to Room No. 7 • Capacity: 52 each)</span>
                </h5>
                <span className="text-[11px] text-slate-500">7 Classrooms</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {classrooms
                  .filter((c) => c.building === 'NEW')
                  .map((room) => {
                    const roomDeploys = focusedItem.classDeployments.filter((d) => d.roomId === room.id);
                    const totalInRoom = roomDeploys.reduce((sum, d) => sum + d.totalSessions, 0);
                    const todayInRoom = roomDeploys.reduce((sum, d) => sum + d.todaySessions, 0);
                    const periodsInRoom = roomDeploys.flatMap((d) => d.periodsToday);

                    return (
                      <div
                        key={room.id}
                        className={`p-3 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                          todayInRoom > 0
                            ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-100 shadow-2xs'
                            : totalInRoom > 0
                            ? 'bg-white border-slate-200 shadow-2xs hover:border-indigo-300'
                            : 'bg-slate-50/70 border-slate-200/80 text-slate-400'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs">{room.name}</span>
                            {todayInRoom > 0 ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white shadow-2xs">
                                Active Today (P{periodsInRoom.join(',')})
                              </span>
                            ) : totalInRoom > 0 ? (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Visited
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Not Assigned</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                            Floor {room.floor} • Cap: {room.capacity}
                          </div>

                          {/* Subjects delivered in this room */}
                          {roomDeploys.length > 0 ? (
                            <div className="mt-2 space-y-1.5 pt-1.5 border-t border-slate-100">
                              {roomDeploys.map((d) => (
                                <div key={d.paperId} className="flex items-center justify-between text-[11px]">
                                  <span
                                    className="px-1.5 py-0.2 rounded text-white font-mono font-bold text-[10px]"
                                    style={{ backgroundColor: d.paperColor }}
                                  >
                                    {d.paperCode}
                                  </span>
                                  <div className="text-right">
                                    <span className="font-bold text-slate-900">{d.totalSessions} sessions</span>
                                    {d.todaySessions > 0 && (
                                      <span className="text-[10px] text-emerald-700 font-bold ml-1">
                                        (+{d.todaySessions} today)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-[10px] text-slate-400 italic pt-1.5 border-t border-slate-100">
                              No sessions conducted yet
                            </div>
                          )}
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-semibold">
                          <span className="text-slate-500">Room Total:</span>
                          <span className="text-indigo-950 font-bold">{totalInRoom} sessions</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* SUBJECT-SPECIFIC CUMULATIVE SUMMARY */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Subject-Specific Teaching Summary</span>
            </h4>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Subject / Paper</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Assigned Role</th>
                    <th className="py-2 px-3 text-center">Past Sessions</th>
                    <th className="py-2 px-3 text-center">Today's Sessions</th>
                    <th className="py-2 px-3 text-center bg-indigo-50 text-indigo-900">Total Sessions</th>
                    <th className="py-2 px-3">Classrooms Visited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {papers
                    .filter((p) => {
                      const hasConducted = focusedItem.classDeployments.some((d) => d.paperId === p.id);
                      const isMain = focusedItem.teacher.primaryPaperIds.includes(p.id);
                      const isBackup = (focusedItem.teacher.backupPaperIds || []).includes(p.id);
                      return hasConducted || isMain || isBackup;
                    })
                    .map((p) => {
                      const deploys = focusedItem.classDeployments.filter((d) => d.paperId === p.id);
                      const past = deploys.reduce((sum, d) => sum + d.pastSessions, 0);
                      const today = deploys.reduce((sum, d) => sum + d.todaySessions, 0);
                      const total = past + today;
                      const rooms = Array.from(new Set(deploys.map((d) => d.roomName))).join(', ') || 'None';
                      const isMain = focusedItem.teacher.primaryPaperIds.includes(p.id);
                      const isBackup = (focusedItem.teacher.backupPaperIds || []).includes(p.id);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-900 flex items-center gap-1.5">
                            <span
                              className="px-1.5 py-0.5 rounded text-white font-mono font-bold text-[10px]"
                              style={{ backgroundColor: p.color }}
                            >
                              {p.code}
                            </span>
                            <span>{p.title}</span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">{p.category}</td>
                          <td className="py-2 px-3">
                            {isMain ? (
                              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                Main Subject
                              </span>
                            ) : isBackup ? (
                              <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Backup (Floating)
                              </span>
                            ) : (
                              <span className="text-slate-500">Substitute / Practical</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-700">{past}</td>
                          <td className="py-2 px-3 text-center font-bold text-emerald-700">
                            {today > 0 ? `+${today}` : '—'}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-indigo-900 bg-indigo-50/50">
                            {total}
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-mono text-[10px]">{rooms}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* VIEW MODE 1: DETAILED INSTRUCTOR CARDS */}
          {viewMode === 'cards' && (
        <div className="space-y-4">
          {filteredData.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500 text-xs">
              No instructors match the selected filter criteria.
            </div>
          ) : (
            filteredData.map((item) => (
              <div
                key={item.teacher.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-indigo-300"
              >
                {/* Card Header */}
                <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                      {item.teacher.code}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{item.teacher.name}</h3>
                        {item.isOnLeaveToday ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                            <UserX className="w-2.5 h-2.5" />
                            On Leave Today
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <UserCheck className="w-2.5 h-2.5" />
                            Active on Duty
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {item.teacher.designation}
                      </p>
                    </div>
                  </div>

                  {/* Summary badges */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 font-medium text-slate-700 shadow-2xs">
                      Today: <span className="font-bold text-indigo-700">{item.todayPeriodsCount} Periods</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 font-medium text-slate-700 shadow-2xs">
                      Total: <span className="font-bold text-slate-900">{item.totalSessionsCount} Sessions</span>
                    </span>
                    <button
                      onClick={() => setFocusedTeacherId(item.teacher.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors ml-1"
                      title="Open full individual classroom-by-classroom deployment dossier"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Individual Dossier</span>
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Subject Details Line */}
                  <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600">Main Subject:</span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {item.primaryPaperNames}
                      </span>
                    </div>
                    {item.backupPaperNames !== 'None' && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-600">Backup Subjects:</span>
                        <span className="font-medium text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {item.backupPaperNames}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Today's Schedule Progression Stepper (Period 1 to 5) */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Today's Period-by-Period Deployment Detail:</span>
                    </h4>

                    {item.isOnLeaveToday ? (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                        Instructor marked on leave today · No periods detailed for today.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map((periodNum) => {
                          const slot = item.todaySlots.find((s) => s.period === periodNum);
                          return (
                            <div
                              key={periodNum}
                              className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between min-h-[72px] ${
                                slot
                                  ? 'bg-white border-indigo-200 shadow-2xs ring-1 ring-indigo-50'
                                  : 'bg-slate-50 border-slate-200 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px] font-bold">
                                <span className={slot ? 'text-indigo-900' : 'text-slate-400'}>
                                  Period {periodNum}
                                </span>
                                {slot ? (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                ) : (
                                  <span className="text-[10px] font-normal text-slate-400">Free / Gap</span>
                                )}
                              </div>

                              {slot ? (
                                <div className="mt-1 space-y-0.5">
                                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                                    <span>{slot.roomName}</span>
                                    <span className="text-[10px] font-normal text-slate-500">
                                      ({slot.building === 'OLD' ? 'Old' : 'New'})
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-semibold text-indigo-700 truncate" title={slot.paperTitle}>
                                    {slot.paperCode} · {slot.paperTitle}
                                  </div>
                                  {slot.isSubstitute && (
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 inline-block">
                                      Substitute
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-400 italic">No class assigned</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Classroom-by-Classroom Detailed Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Classroom-wise Deployment History (All Classes Covered so far):</span>
                    </h4>

                    {item.classDeployments.length === 0 ? (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 italic">
                        No classroom sessions recorded yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                            <tr>
                              <th className="py-2 px-3">Classroom (Batch)</th>
                              <th className="py-2 px-3">Building</th>
                              <th className="py-2 px-3">Paper / Subject</th>
                              <th className="py-2 px-3 text-center">Past Sessions</th>
                              <th className="py-2 px-3 text-center">Today</th>
                              <th className="py-2 px-3 text-center">Total Sessions</th>
                              <th className="py-2 px-3">Today's Periods</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {item.classDeployments.map((d, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {d.roomName} ({d.roomId})
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                      d.building === 'OLD'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}
                                  >
                                    {d.building === 'OLD' ? 'Old Bldg' : 'New Bldg'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-medium text-slate-800">
                                  <span className="font-bold text-indigo-700">{d.paperCode}</span> - {d.paperTitle}
                                </td>
                                <td className="py-2 px-3 text-center text-slate-600 font-medium">
                                  {d.pastSessions}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {d.todaySessions > 0 ? (
                                    <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                                      +{d.todaySessions}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-slate-900 text-[12px]">
                                  {d.totalSessions}
                                </td>
                                <td className="py-2 px-3 text-slate-700">
                                  {d.periodsToday.length > 0 ? (
                                    <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
                                      Period {d.periodsToday.join(', ')}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">None today</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* VIEW MODE 2: COMPREHENSIVE MATRIX GRID (Teacher x Classroom) */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Cross-Classroom Deployment Matrix (All 26 Instructors × 15 Classrooms)
            </h3>
            <p className="text-xs text-slate-500">
              Numbers indicate total sessions conducted by each instructor in each classroom. Today's current classes are highlighted in green.
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 sticky left-0 z-10 bg-slate-100 min-w-[160px] border-r border-slate-200">
                    Instructor (Code)
                  </th>
                  <th className="py-2.5 px-2 min-w-[130px] border-r border-slate-200">Main Subject</th>
                  {classrooms.map((c) => (
                    <th key={c.id} className="py-2.5 px-2 text-center min-w-[65px] border-r border-slate-200">
                      <div>{c.code}</div>
                      <div className="text-[9px] font-normal text-slate-500">
                        {c.building === 'OLD' ? 'Old' : 'New'}
                      </div>
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-center min-w-[70px] bg-indigo-50 text-indigo-900">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {filteredData.map((item) => (
                  <tr key={item.teacher.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2 px-3 sticky left-0 z-10 bg-white font-semibold text-slate-900 border-r border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-indigo-700">{item.teacher.code}</span>
                        <span className="truncate">{item.teacher.name}</span>
                        {item.isOnLeaveToday && (
                          <span className="text-[9px] text-rose-600 font-bold bg-rose-50 px-1 rounded">Leave</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 border-r border-slate-200 text-slate-600 truncate max-w-[140px]" title={item.primaryPaperNames}>
                      {item.primaryPaperNames}
                    </td>
                    {classrooms.map((c) => {
                      const details = item.classDeployments.filter((d) => d.roomId === c.id);
                      const totalInRoom = details.reduce((acc, d) => acc + d.totalSessions, 0);
                      const activeToday = details.some((d) => d.todaySessions > 0);
                      const todayPeriods = details.flatMap((d) => d.periodsToday);

                      return (
                        <td
                          key={c.id}
                          className={`py-2 px-1 text-center border-r border-slate-200 ${
                            activeToday
                              ? 'bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-300'
                              : totalInRoom > 0
                              ? 'text-slate-800 font-medium'
                              : 'text-slate-300'
                          }`}
                        >
                          {totalInRoom > 0 ? (
                            <div>
                              <span>{totalInRoom}</span>
                              {activeToday && (
                                <div className="text-[9px] text-emerald-700 font-bold">
                                  P{todayPeriods.join(',')}
                                </div>
                              )}
                            </div>
                          ) : (
                            '·'
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-center font-bold text-indigo-700 bg-indigo-50/50">
                      {item.totalSessionsCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
