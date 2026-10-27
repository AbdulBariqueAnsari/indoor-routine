/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Classroom, DailyRoutine, Paper, Teacher } from '../types';
import {
  Award,
  BarChart2,
  BookOpen,
  Building,
  CheckCircle,
  Clock,
  Filter,
  GraduationCap,
  Layers,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';

interface InstructorLedgerViewProps {
  teachers: Teacher[];
  papers: Paper[];
  classrooms: Classroom[];
  allRoutines: DailyRoutine[];
  currentRoutine: DailyRoutine | null;
}

export interface InstructorSessionStats {
  teacher: Teacher;
  pastSessions: number;
  todaySessions: number;
  totalSessions: number;
  substituteSessions: number;
  paperBreakdown: {
    paperId: string;
    paperCode: string;
    paperTitle: string;
    paperColor: string;
    count: number;
  }[];
  todayPeriods: {
    period: number;
    roomName: string;
    paperCode: string;
    isSubstitute: boolean;
  }[];
  isOnLeaveToday: boolean;
}

export const InstructorLedgerView: React.FC<InstructorLedgerViewProps> = ({
  teachers,
  papers,
  classrooms,
  allRoutines,
  currentRoutine,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [buildingFilter, setBuildingFilter] = useState<'ALL' | 'OLD' | 'NEW' | 'FLOATING'>('ALL');
  const [sortBy, setSortBy] = useState<'total' | 'today' | 'code' | 'name'>('total');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

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

  // Calculate instructor session ledger stats
  const ledgerStats: InstructorSessionStats[] = useMemo(() => {
    // Normalization helper
    const norm = (id: string) => (id ? id.replace(/^T0*/, 'T') : '');

    return teachers.map((teacher) => {
      const tNormId = norm(teacher.id);
      let pastCount = 0;
      let todayCount = 0;
      let substituteCount = 0;
      const paperCounts = new Map<string, number>();

      // 1. Calculate from past routines
      for (const routine of pastRoutines) {
        for (const slot of routine.slots) {
          if (norm(slot.teacherId) === tNormId) {
            pastCount++;
            if (slot.isSubstitute) substituteCount++;
            paperCounts.set(slot.paperId, (paperCounts.get(slot.paperId) || 0) + 1);
          }
        }
      }

      // 2. Calculate from current routine (today)
      const todayPeriods: InstructorSessionStats['todayPeriods'] = [];
      for (const slot of currentSlots) {
        if (norm(slot.teacherId) === tNormId) {
          todayCount++;
          if (slot.isSubstitute) substituteCount++;
          paperCounts.set(slot.paperId, (paperCounts.get(slot.paperId) || 0) + 1);

          const room = classroomMap.get(slot.roomId);
          const paper = paperMap.get(slot.paperId);
          todayPeriods.push({
            period: slot.period,
            roomName: room?.name || slot.roomId,
            paperCode: paper?.code || slot.paperId,
            isSubstitute: slot.isSubstitute,
          });
        }
      }

      // Sort today's periods by period number
      todayPeriods.sort((a, b) => a.period - b.period);

      // Build paper breakdown list sorted by session count
      const paperBreakdown = Array.from(paperCounts.entries())
        .map(([paperId, count]) => {
          const paper = paperMap.get(paperId);
          return {
            paperId,
            paperCode: paper?.code || paperId,
            paperTitle: paper?.title || paperId,
            paperColor: paper?.color || '#4F46E5',
            count,
          };
        })
        .sort((a, b) => b.count - a.count);

      return {
        teacher,
        pastSessions: pastCount,
        todaySessions: todayCount,
        totalSessions: pastCount + todayCount,
        substituteSessions: substituteCount,
        paperBreakdown,
        todayPeriods,
        isOnLeaveToday: absentSet.has(tNormId),
      };
    });
  }, [teachers, pastRoutines, currentSlots, absentSet, classroomMap, paperMap]);

  // Aggregate statistics for summary cards
  const totalAcademySessions = useMemo(
    () => ledgerStats.reduce((sum, s) => sum + s.totalSessions, 0),
    [ledgerStats]
  );
  const totalSubstituteSessions = useMemo(
    () => ledgerStats.reduce((sum, s) => sum + s.substituteSessions, 0),
    [ledgerStats]
  );
  const avgSessionsPerInstructor = useMemo(
    () => (teachers.length > 0 ? (totalAcademySessions / teachers.length).toFixed(1) : '0'),
    [totalAcademySessions, teachers.length]
  );
  const activeInstructorsToday = useMemo(
    () => ledgerStats.filter((s) => !s.isOnLeaveToday).length,
    [ledgerStats]
  );

  // Filter and sort instructor list
  const filteredAndSortedStats = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    return ledgerStats
      .filter((item) => {
        const matchesQuery =
          !q ||
          item.teacher.name.toLowerCase().includes(q) ||
          item.teacher.code.toLowerCase().includes(q) ||
          item.teacher.designation.toLowerCase().includes(q);

        const matchesBuilding =
          buildingFilter === 'ALL' || item.teacher.assignedBuilding === buildingFilter;

        return matchesQuery && matchesBuilding;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'total') {
          diff = b.totalSessions - a.totalSessions;
        } else if (sortBy === 'today') {
          diff = b.todaySessions - a.todaySessions;
        } else if (sortBy === 'code') {
          const numA = parseInt(a.teacher.code.replace(/\D/g, '') || '0', 10);
          const numB = parseInt(b.teacher.code.replace(/\D/g, '') || '0', 10);
          diff = numA - numB;
        } else if (sortBy === 'name') {
          diff = a.teacher.name.localeCompare(b.teacher.name);
        }

        return sortDirection === 'asc' ? -diff : diff;
      });
  }, [ledgerStats, searchTerm, buildingFilter, sortBy, sortDirection]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-5 shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-amber-400 text-slate-950 tracking-wider">
                Instructor Workload Ledger
              </span>
              <span className="text-xs text-indigo-200">
                Official Session Tracker · T1 through T26
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Instructor Session Ledger & Duty Tracker
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
              Real-time calculation of total sessions conducted by each instructor (T1–T26) across generated daily routines. Tracks past completed sessions, today's schedule, substitute duties, and per-subject breakdown.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono bg-white/10 px-3 py-1.5 rounded-lg border border-white/20">
              Total Academy Routines: <strong>{allRoutines.length}</strong>
            </span>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Total Sessions Conducted</span>
            </div>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {totalAcademySessions}{' '}
              <span className="text-xs font-normal text-slate-400">sessions</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Average Workload</span>
            </div>
            <div className="text-xl font-bold font-mono text-amber-300 mt-1">
              {avgSessionsPerInstructor}{' '}
              <span className="text-xs font-normal text-slate-400">per instructor</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active Today</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {activeInstructorsToday} / {teachers.length}{' '}
              <span className="text-xs font-normal text-slate-400">instructors</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              <span>Substitutions Handled</span>
            </div>
            <div className="text-xl font-bold font-mono text-rose-300 mt-1">
              {totalSubstituteSessions}{' '}
              <span className="text-xs font-normal text-slate-400">sessions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by code (T1, T2..), instructor name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        {/* Building Filter & Sort controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Building Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setBuildingFilter('ALL')}
              className={`px-2.5 py-1 rounded font-semibold text-[11px] transition-all ${
                buildingFilter === 'ALL'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All (26)
            </button>
            <button
              onClick={() => setBuildingFilter('OLD')}
              className={`px-2.5 py-1 rounded font-semibold text-[11px] transition-all ${
                buildingFilter === 'OLD'
                  ? 'bg-white text-amber-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Old Bldg
            </button>
            <button
              onClick={() => setBuildingFilter('NEW')}
              className={`px-2.5 py-1 rounded font-semibold text-[11px] transition-all ${
                buildingFilter === 'NEW'
                  ? 'bg-white text-sky-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              New Bldg
            </button>
            <button
              onClick={() => setBuildingFilter('FLOATING')}
              className={`px-2.5 py-1 rounded font-semibold text-[11px] transition-all ${
                buildingFilter === 'FLOATING'
                  ? 'bg-white text-purple-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Floating
            </button>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-[11px]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="total">Total Sessions</option>
              <option value="today">Today's Sessions</option>
              <option value="code">Instructor Code (T1..T26)</option>
              <option value="name">Name</option>
            </select>
            <button
              onClick={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-xs font-bold font-mono text-slate-700"
              title="Toggle sort direction"
            >
              {sortDirection === 'desc' ? '↓ Desc' : '↑ Asc'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-3 w-16 text-center border-r border-slate-200">Code</th>
                <th className="p-3 border-r border-slate-200 min-w-44">Instructor Name & Role</th>
                <th className="p-3 border-r border-slate-200 w-32">Campus Role</th>
                <th className="p-3 text-right border-r border-slate-200 w-28">Past Sessions</th>
                <th className="p-3 text-right border-r border-slate-200 w-28">Conducted Today</th>
                <th className="p-3 text-right border-r border-slate-200 w-32 bg-indigo-50/50 font-extrabold text-indigo-900">
                  Total Sessions
                </th>
                <th className="p-3 text-center border-r border-slate-200 w-28">Substitutions</th>
                <th className="p-3 min-w-72">Subject-Wise Sessions Breakdown</th>
                <th className="p-3 w-28 text-center">Today's Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAndSortedStats.map((item) => {
                const t = item.teacher;
                return (
                  <tr
                    key={t.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      item.isOnLeaveToday ? 'bg-rose-50/20' : ''
                    }`}
                  >
                    {/* Instructor Code */}
                    <td className="p-3 text-center border-r border-slate-200 align-top">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 font-mono font-bold text-indigo-700 text-xs">
                        {t.code}
                      </span>
                    </td>

                    {/* Instructor Name & Designation */}
                    <td className="p-3 border-r border-slate-200 align-top">
                      <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                      <div className="text-[11px] text-slate-500">{t.designation}</div>
                      {/* Primary Subject Badges */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {t.primaryPaperIds.map((pid) => {
                          const p = paperMap.get(pid);
                          return (
                            <span
                              key={pid}
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold text-white font-mono"
                              style={{ backgroundColor: p?.color || '#4F46E5' }}
                              title={p?.title}
                            >
                              {p?.code || pid}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Assigned Campus Building */}
                    <td className="p-3 border-r border-slate-200 align-top">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.assignedBuilding === 'OLD'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : t.assignedBuilding === 'NEW'
                            ? 'bg-sky-100 text-sky-900 border border-sky-300'
                            : 'bg-purple-100 text-purple-900 border border-purple-300'
                        }`}
                      >
                        {t.assignedBuilding === 'OLD'
                          ? 'Old School Bldg'
                          : t.assignedBuilding === 'NEW'
                          ? 'New School Bldg'
                          : 'Floating (Both)'}
                      </span>
                    </td>

                    {/* Past Sessions */}
                    <td className="p-3 text-right font-mono font-semibold text-slate-700 border-r border-slate-200 align-top">
                      {item.pastSessions}
                    </td>

                    {/* Conducted Today */}
                    <td className="p-3 text-right font-mono font-bold text-indigo-700 border-r border-slate-200 align-top">
                      {item.todaySessions > 0 ? `+${item.todaySessions}` : '0'}
                    </td>

                    {/* Total Sessions Conducted */}
                    <td className="p-3 text-right font-mono font-extrabold text-indigo-950 bg-indigo-50/40 border-r border-slate-200 align-top text-sm">
                      {item.totalSessions}
                    </td>

                    {/* Substitutions */}
                    <td className="p-3 text-center border-r border-slate-200 align-top">
                      {item.substituteSessions > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 font-mono">
                          {item.substituteSessions} duties
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">-</span>
                      )}
                    </td>

                    {/* Subject-Wise Breakdown */}
                    <td className="p-3 align-top">
                      {item.paperBreakdown.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {item.paperBreakdown.map((pb) => (
                            <div
                              key={pb.paperId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-[10px]"
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: pb.paperColor }}
                              ></span>
                              <span className="font-mono font-bold text-slate-800">
                                {pb.paperCode}:
                              </span>
                              <span className="font-extrabold text-indigo-700 font-mono">
                                {pb.count}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No sessions yet</span>
                      )}

                      {/* Today's Period Slots if scheduled today */}
                      {item.todayPeriods.length > 0 && (
                        <div className="mt-1.5 text-[10px] text-slate-500 flex flex-wrap items-center gap-1">
                          <span className="font-semibold text-slate-700">Today:</span>
                          {item.todayPeriods.map((tp, idx) => (
                            <span
                              key={idx}
                              className={`px-1.5 py-0.2 rounded font-mono ${
                                tp.isSubstitute
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200 font-bold'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              P{tp.period} ({tp.roomName}) [{tp.paperCode}]
                              {tp.isSubstitute && ' *Sub'}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Today's Status */}
                    <td className="p-3 text-center align-top">
                      {item.isOnLeaveToday ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          <UserX className="w-3 h-3 text-rose-600" />
                          <span>On Leave</span>
                        </span>
                      ) : item.todaySessions > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>Active ({item.todaySessions}P)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          <span>Reserve</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Displaying <strong>{filteredAndSortedStats.length}</strong> of <strong>26</strong> instructors. Showing completed sessions from all generated routines.
          </span>
          <span className="font-mono text-[11px] text-slate-600">
            STC, SAP 4th Bn · Official Academic Record
          </span>
        </div>
      </div>
    </div>
  );
};
