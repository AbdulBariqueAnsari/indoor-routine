/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Classroom, DailyRoutine, Paper, Teacher } from '../types';
import {
  calculateClassroomCumulativeStats,
  calculateCumulativeStats,
} from '../utils/scheduler';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Building,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  Grid,
  Layers,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

interface CumulativeStatsViewProps {
  classrooms: Classroom[];
  papers: Paper[];
  teachers: Teacher[];
  historicalRoutines: DailyRoutine[];
  currentRoutine: DailyRoutine | null;
}

export const CumulativeStatsView: React.FC<CumulativeStatsViewProps> = ({
  classrooms,
  papers,
  teachers,
  historicalRoutines,
  currentRoutine,
}) => {
  const [viewMode, setViewMode] = useState<'all_classes' | 'classroom' | 'matrix'>('all_classes');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    classrooms.length > 0 ? classrooms[0].id : 'OB-1'
  );
  const [buildingFilter, setBuildingFilter] = useState<'ALL' | 'OLD' | 'NEW'>('ALL');

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const currentSlots = currentRoutine?.slots || [];
  const priorityPaperIds = currentRoutine?.priorityPaperIds || [];

  // Calculate classroom-wise cumulative statistics (Classroom-specific targets: 1x quota)
  const roomStatsList = calculateClassroomCumulativeStats(
    classrooms,
    papers,
    historicalRoutines,
    currentSlots,
    priorityPaperIds,
    currentRoutine?.id
  );

  // Calculate all-classes consolidated statistics (All 15 classrooms combined: 15x quota)
  const academyStats = calculateCumulativeStats(
    papers,
    historicalRoutines,
    currentSlots,
    priorityPaperIds,
    15, // 15 classrooms multiplier as specified
    currentRoutine?.id
  );

  // Selected room's progress
  const selectedRoomStats =
    roomStatsList.find((r) => r.classroom.id === selectedRoomId) || roomStatsList[0];

  // All-classes global calculations
  const totalAllTarget = academyStats.reduce((sum, s) => sum + s.targetSessions, 0);
  const totalCompletedBeforeToday = academyStats.reduce((sum, s) => sum + s.completedSessions, 0);
  const totalToday = academyStats.reduce((sum, s) => sum + s.todaySessions, 0);
  const grandTotalCompleted = totalCompletedBeforeToday + totalToday;
  const totalRemaining = Math.max(0, totalAllTarget - grandTotalCompleted);
  const overallPercentage =
    totalAllTarget > 0 ? Math.round((grandTotalCompleted / totalAllTarget) * 100) : 0;

  // Filter classrooms for room pills
  const filteredRooms = classrooms.filter((r) => {
    if (buildingFilter === 'ALL') return true;
    return r.building === buildingFilter;
  });

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-5 shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-amber-400 text-slate-950 tracking-wider">
                STC, SAP 4th Bn Curriculum
              </span>
              <span className="text-xs text-indigo-200">
                174 Basic Training Days · 5 Sessions/Day Schedule · 15 Classrooms
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Classroom Session Counter & Quota Tracking
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
              Track syllabus completion per individual classroom, or view consolidated progress for all 15 classrooms where targets are multiplied by 15.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs text-slate-400 uppercase font-semibold">All Classes Target Formula</div>
              <div className="text-base font-bold font-mono text-emerald-400">15 × Subject Quota</div>
            </div>
            <div className="h-8 w-px bg-white/20"></div>
            <div className="text-right">
              <div className="text-xs text-slate-400 uppercase font-semibold">Total Classrooms</div>
              <div className="text-xl font-bold font-mono text-amber-300">15 Rooms</div>
            </div>
          </div>
        </div>

        {/* 4 Pillars of Training Targets */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-slate-400 text-[11px]">Single Classroom Target</div>
            <div className="text-xl font-bold font-mono text-white mt-0.5">623 Sessions</div>
            <div className="text-[10px] text-slate-400 mt-1">435 Theory (12 Papers) + 188 Practical</div>
          </div>

          <div className="bg-indigo-500/20 rounded-lg p-3 border border-indigo-400/30">
            <div className="text-indigo-200 text-[11px] font-semibold">All 15 Classrooms Target</div>
            <div className="text-xl font-bold font-mono text-emerald-300 mt-0.5">9,345 Sessions</div>
            <div className="text-[10px] text-indigo-200 mt-1">15 Rooms × 623 Total Sessions</div>
          </div>

          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-slate-400 text-[11px]">Consolidated Completed</div>
            <div className="text-xl font-bold font-mono text-white mt-0.5">
              {grandTotalCompleted} Sessions
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Past: {totalCompletedBeforeToday} · Today: {totalToday}
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-slate-400 text-[11px]">Consolidated Remaining</div>
            <div className="text-xl font-bold font-mono text-amber-200 mt-0.5">
              {totalRemaining} Sessions
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Overall: {overallPercentage}% Completed</div>
          </div>
        </div>
      </div>

      {/* Mode Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('all_classes')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              viewMode === 'all_classes'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All 15 Classes (15× Target Quota)</span>
          </button>

          <button
            onClick={() => setViewMode('classroom')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              viewMode === 'classroom'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Class-Specific Counter</span>
          </button>

          <button
            onClick={() => setViewMode('matrix')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              viewMode === 'matrix'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>15 Rooms × 13 Papers Grid</span>
          </button>
        </div>

        {viewMode === 'classroom' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-medium">Building:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-xs">
              <button
                onClick={() => setBuildingFilter('ALL')}
                className={`px-2 py-0.5 rounded font-medium ${
                  buildingFilter === 'ALL' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                All (15)
              </button>
              <button
                onClick={() => setBuildingFilter('OLD')}
                className={`px-2 py-0.5 rounded font-medium ${
                  buildingFilter === 'OLD' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Old Bldg (8)
              </button>
              <button
                onClick={() => setBuildingFilter('NEW')}
                className={`px-2 py-0.5 rounded font-medium ${
                  buildingFilter === 'NEW' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                New Bldg (7)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* VIEW 1: ALL 15 CLASSES CONSOLIDATED (15x QUOTA FORMULA) */}
      {viewMode === 'all_classes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>All 15 Classrooms Consolidated Quotas</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded border border-indigo-200">
                    Target Quota = 15 Classrooms × Individual Subject Quota
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aggregate training progress across all 15 rooms (8 Old Building + 7 New Building).
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-700">
                    <th className="p-3 w-64 border-r border-slate-200">Paper & Title</th>
                    <th className="p-3 text-center border-r border-slate-200">Per Room Target</th>
                    <th className="p-3 text-right border-r border-slate-200 font-bold text-indigo-900 bg-indigo-50/50">
                      All 15 Rooms Target (15×)
                    </th>
                    <th className="p-3 text-right border-r border-slate-200">Past Completed</th>
                    <th className="p-3 text-right border-r border-slate-200">Conducted Today</th>
                    <th className="p-3 text-right border-r border-slate-200 font-bold text-emerald-700">
                      Total Done
                    </th>
                    <th className="p-3 text-right border-r border-slate-200">Remaining</th>
                    <th className="p-3 w-44 border-r border-slate-200">Consolidated Progress</th>
                    <th className="p-3 text-left">Primary Instructors Assigned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {academyStats.map((item) => {
                    const paper = papers.find((p) => p.id === item.paperId);
                    const instructorNames = paper?.primaryTeacherIds
                      .map((tid) => {
                        const t = teacherMap.get(tid);
                        return t ? `${t.code} (${t.name})` : tid;
                      })
                      .join(', ');

                    return (
                      <tr key={item.paperId} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border-r border-slate-200">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            ></span>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span className="font-mono">{item.paperCode}</span>
                                {item.isPriority && (
                                  <span className="text-[10px] bg-amber-100 text-amber-900 px-1 rounded font-bold">
                                    ★ Priority
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-600 text-[11px] font-medium line-clamp-1">
                                {item.title}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3 text-center border-r border-slate-200 font-mono text-slate-600">
                          {item.singleRoomTarget || item.targetSessions / 15}
                        </td>

                        <td className="p-3 text-right border-r border-slate-200 font-mono font-bold text-indigo-900 bg-indigo-50/30">
                          {item.targetSessions}{' '}
                          <span className="text-[10px] font-normal text-slate-500">
                            (15 × {item.singleRoomTarget || item.targetSessions / 15})
                          </span>
                        </td>

                        <td className="p-3 text-right border-r border-slate-200 font-mono text-slate-700">
                          {item.completedSessions}
                        </td>

                        <td className="p-3 text-right border-r border-slate-200 font-mono text-amber-600 font-semibold">
                          {item.todaySessions > 0 ? `+${item.todaySessions}` : '0'}
                        </td>

                        <td className="p-3 text-right border-r border-slate-200 font-mono font-bold text-emerald-700">
                          {item.completedSessions + item.todaySessions}
                        </td>

                        <td className="p-3 text-right border-r border-slate-200 font-mono text-slate-800">
                          {item.remainingSessions}
                        </td>

                        <td className="p-3 border-r border-slate-200">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-mono font-bold text-slate-700">
                                {item.progressPercent}%
                              </span>
                              <span className="text-slate-400">
                                {item.completedSessions + item.todaySessions}/{item.targetSessions}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, item.progressPercent)}%`,
                                  backgroundColor: item.color,
                                }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3 text-slate-600 text-[11px]">
                          {instructorNames || (
                            <span className="italic text-emerald-700 font-semibold">
                              All 26 Instructors Available (Practical)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: CLASS-SPECIFIC COUNTER (INDIVIDUAL ROOM TARGET) */}
      {viewMode === 'classroom' && selectedRoomStats && (
        <div className="space-y-4">
          {/* Room Selection Strip */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <div className="text-xs font-semibold text-slate-700">
              Select Classroom to Inspect Individual Session Counter:
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {filteredRooms.map((room) => {
                const isSelected = room.id === selectedRoomId;
                const stats = roomStatsList.find((r) => r.classroom.id === room.id);
                return (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{room.building === 'OLD' ? 'Old' : 'New'}: {room.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {stats ? `${stats.totalCompleted}/${stats.totalTargetSessions}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table for Selected Room */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>
                    {selectedRoomStats.classroom.name} ({selectedRoomStats.classroom.building === 'OLD' ? 'Old School Building' : 'New School Building'}, Floor {selectedRoomStats.classroom.floor})
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded">
                    Room Target: {selectedRoomStats.totalTargetSessions} Sessions
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Independent session counts conducted in {selectedRoomStats.classroom.code} across training history.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-700">
                    <th className="p-3 w-64 border-r border-slate-200">Paper & Title</th>
                    <th className="p-3 text-center border-r border-slate-200">Category</th>
                    <th className="p-3 text-right border-r border-slate-200">Room Quota Target</th>
                    <th className="p-3 text-right border-r border-slate-200">Past in Room</th>
                    <th className="p-3 text-right border-r border-slate-200">Today in Room</th>
                    <th className="p-3 text-right border-r border-slate-200 font-bold text-emerald-700">
                      Total Done
                    </th>
                    <th className="p-3 text-right border-r border-slate-200">Remaining</th>
                    <th className="p-3 w-40 border-r border-slate-200">Room Progress</th>
                    <th className="p-3 text-left">Primary Instructors Assigned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedRoomStats.paperProgress.map((item) => {
                    const paper = papers.find((p) => p.id === item.paperId);
                    const instructorNames = paper?.primaryTeacherIds
                      .map((tid) => {
                        const t = teacherMap.get(tid);
                        return t ? `${t.code} (${t.name})` : tid;
                      })
                      .join(', ');

                    return (
                      <tr key={item.paperId} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border-r border-slate-200">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            ></span>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span className="font-mono">{item.paperCode}</span>
                                {item.isPriority && (
                                  <span className="text-[10px] bg-amber-100 text-amber-900 px-1 rounded font-bold">
                                    ★ Priority
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-600 text-[11px] font-medium line-clamp-1">
                                {item.title}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3 text-center border-r border-slate-200 text-slate-500">
                          {item.category}
                        </td>

                        <td className="p-3 text-right border-r border-slate-200 font-mono font-bold text-slate-900">
                          {item.targetSessions}
                        </td>

                        <td className="p-3 text-right border-r border-slate-200 font-mono text-slate-700">
                          {item.completedSessions}
                        </td>

                        <td className="p-3 text-right border-r border-slate-200 font-mono text-amber-600 font-semibold">
                          {item.todaySessions > 0 ? `+${item.todaySessions}` : '0'}
                        </td>

                        <td className="p-3 text-right border-r border-slate-200 font-mono font-bold text-emerald-700">
                          {item.totalCompleted}
                        </td>

                        <td className="p-3 text-right border-r border-slate-200 font-mono text-slate-800">
                          {item.remainingSessions}
                        </td>

                        <td className="p-3 border-r border-slate-200">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-mono font-bold text-slate-700">
                                {item.progressPercent}%
                              </span>
                              <span className="text-slate-400">
                                {item.totalCompleted}/{item.targetSessions}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, item.progressPercent)}%`,
                                  backgroundColor: item.color,
                                }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3 text-slate-600 text-[11px]">
                          {instructorNames || (
                            <span className="italic text-emerald-700 font-semibold">
                              All 26 Instructors Available (Practical)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: 15 ROOMS x 13 PAPERS CROSS MATRIX */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/80">
            <h3 className="font-bold text-slate-900 text-sm">
              Cross-Room Session Allocation Matrix (15 Classrooms × 13 Papers)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live count of total completed sessions in every classroom. Shows quota balance and room equality.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-700">
                  <th className="p-2.5 text-left border-r border-slate-200 w-36">Classroom</th>
                  {papers.map((p) => (
                    <th key={p.id} className="p-2 border-r border-slate-200 last:border-r-0">
                      <div className="font-bold text-slate-900">{p.code}</div>
                      <div className="text-[10px] text-slate-500 font-normal">Quota: {p.totalTargetSessions}</div>
                    </th>
                  ))}
                  <th className="p-2 font-bold text-slate-900 bg-slate-200/50">Total Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {roomStatsList.map((rStat) => (
                  <tr key={rStat.classroom.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 text-left border-r border-slate-200 font-semibold text-slate-900 bg-slate-50/60">
                      <div>{rStat.classroom.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {rStat.classroom.building === 'OLD' ? 'Old Bldg' : 'New Bldg'}
                      </div>
                    </td>
                    {rStat.paperProgress.map((pProg) => (
                      <td
                        key={pProg.paperId}
                        className={`p-2 border-r border-slate-200 last:border-r-0 font-mono ${
                          pProg.todaySessions > 0
                            ? 'bg-amber-50 font-bold text-amber-950'
                            : pProg.totalCompleted > 0
                            ? 'text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        <div>{pProg.totalCompleted}</div>
                        {pProg.todaySessions > 0 && (
                          <div className="text-[9px] text-amber-600 font-sans font-bold">
                            (+{pProg.todaySessions} today)
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="p-2 font-mono font-bold text-indigo-700 bg-indigo-50/30">
                      {rStat.totalCompleted} / {rStat.totalTargetSessions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
