/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Classroom, DailyRoutine, Paper, Teacher } from '../types';
import { PERIOD_TIMINGS } from '../data/initialData';
import { CheckCircle2, Search, User, UserCheck, UserX } from 'lucide-react';

interface TeacherDutyViewProps {
  routine: DailyRoutine;
  teachers: Teacher[];
  classrooms: Classroom[];
  papers: Paper[];
}

export const TeacherDutyView: React.FC<TeacherDutyViewProps> = ({
  routine,
  teachers,
  classrooms,
  papers,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ABSENT'>('ALL');

  const roomMap = new Map(classrooms.map((r) => [r.id, r]));
  const paperMap = new Map(papers.map((p) => [p.id, p]));

  // Build schedule per teacher
  const teacherSchedules = teachers.map((teacher) => {
    const isAbsent = routine.absentTeacherIds.includes(teacher.id);
    const assignedSlots = routine.slots.filter((s) => s.teacherId === teacher.id);
    const substituteSlots = assignedSlots.filter((s) => s.isSubstitute);

    // Map by period 1..5
    const periodMap = new Map<number, (typeof assignedSlots)[0]>();
    for (const slot of assignedSlots) {
      periodMap.set(slot.period, slot);
    }

    return {
      teacher,
      isAbsent,
      assignedSlots,
      substituteSlots,
      periodMap,
      totalPeriods: assignedSlots.length,
    };
  });

  const filtered = teacherSchedules.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      item.teacher.name.toLowerCase().includes(q) ||
      item.teacher.code.toLowerCase().includes(q) ||
      item.teacher.designation.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (statusFilter === 'ACTIVE') return !item.isAbsent;
    if (statusFilter === 'ABSENT') return item.isAbsent;
    return true;
  });

  const activeCount = teacherSchedules.filter((t) => !t.isAbsent).length;
  const absentCount = teacherSchedules.filter((t) => t.isAbsent).length;
  const totalSlotsCovered = routine.slots.length;
  const avgLoad = activeCount > 0 ? (totalSlotsCovered / activeCount).toFixed(1) : '0';

  return (
    <div className="space-y-4">
      {/* Top Summary Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-500 font-medium">Active Instructors:</span>{' '}
            <span className="font-bold text-slate-900 font-mono tabular-nums">{activeCount} / 26</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium">On Leave:</span>{' '}
            <span className="font-bold text-rose-600 font-mono tabular-nums">{absentCount}</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Average Load:</span>{' '}
            <span className="font-bold text-indigo-600 font-mono tabular-nums">{avgLoad} periods/teacher</span>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2">
          {/* Status Segmented Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 font-semibold rounded text-xs transition-colors ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              All 26
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1 font-semibold rounded text-xs transition-colors ${
                statusFilter === 'ACTIVE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Present
            </button>
            <button
              onClick={() => setStatusFilter('ABSENT')}
              className={`px-2.5 py-1 font-semibold rounded text-xs transition-colors ${
                statusFilter === 'ABSENT' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              On Leave
            </button>
          </div>

          <input
            type="text"
            placeholder="Search teacher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1 bg-white text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Teacher Duty Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[780px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-700">
                <th className="p-3 w-56 border-r border-slate-200">Instructor Member</th>
                <th className="p-3 text-center border-r border-slate-200 w-24">Status</th>
                {PERIOD_TIMINGS.map((p) => (
                  <th key={p.period} className="p-2.5 border-r border-slate-200 last:border-r-0 text-center">
                    <div className="font-bold text-slate-900">{p.label}</div>
                    <div className="text-[10px] text-slate-500 font-normal font-mono tabular-nums">{p.time}</div>
                  </th>
                ))}
                <th className="p-3 text-right font-bold w-24">Total Load</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((item) => {
                const { teacher, isAbsent, periodMap, totalPeriods, substituteSlots } = item;

                return (
                  <tr
                    key={teacher.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isAbsent ? 'bg-rose-50/30' : ''
                    }`}
                  >
                    {/* Instructor Details */}
                    <td className="p-3 border-r border-slate-200">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-xs shrink-0 font-mono shadow-2xs">
                          {teacher.code}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                            <span className="font-mono text-indigo-700">{teacher.code}:</span>
                            <span className="truncate">{teacher.name}</span>
                          </p>
                          <p className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                            <span>{teacher.designation}</span>
                            <span>·</span>
                            <span
                              className={`px-1 py-0.2 rounded text-[10px] font-bold ${
                                teacher.assignedBuilding === 'OLD'
                                  ? 'bg-amber-100 text-amber-800'
                                  : teacher.assignedBuilding === 'NEW'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {teacher.assignedBuilding === 'OLD'
                                ? 'Old Bldg'
                                : teacher.assignedBuilding === 'NEW'
                                ? 'New Bldg'
                                : 'Floating'}
                            </span>
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-3 text-center border-r border-slate-200">
                      {isAbsent ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                          <UserX className="w-3 h-3" />
                          <span>Leave</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      )}
                    </td>

                    {/* 5 Period Slots */}
                    {[1, 2, 3, 4, 5].map((period) => {
                      const slot = periodMap.get(period);
                      if (!slot) {
                        return (
                          <td
                            key={period}
                            className="p-2 border-r border-slate-200 last:border-r-0 text-center text-slate-400 bg-slate-50/50"
                          >
                            <span className="text-[11px]">Free</span>
                          </td>
                        );
                      }

                      const room = roomMap.get(slot.roomId);
                      const paper = paperMap.get(slot.paperId);

                      return (
                        <td
                          key={period}
                          className="p-2 border-r border-slate-200 last:border-r-0 text-xs bg-white"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-[11px] text-slate-900">
                                {room?.code}
                              </span>
                              <span
                                className="text-[10px] px-1 rounded text-white font-mono font-semibold"
                                style={{ backgroundColor: paper?.color || '#4F46E5' }}
                              >
                                {paper?.code}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-600 truncate" title={room?.name}>
                              {room?.name}
                            </p>
                            {slot.isSubstitute && (
                              <span
                                className="inline-block text-[9px] text-amber-700 font-semibold bg-amber-50 px-1 rounded"
                                title={slot.substituteReason}
                              >
                                Sub
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Total Periods Assigned */}
                    <td className="p-3 text-right font-mono font-bold border-slate-200 tabular-nums">
                      <span
                        className={`px-2 py-0.5 rounded ${
                          totalPeriods > 3
                            ? 'bg-amber-100 text-amber-900'
                            : totalPeriods > 0
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {totalPeriods} per.
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
