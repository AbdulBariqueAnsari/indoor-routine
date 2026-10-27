/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Classroom, DailyRoutine, Paper, Teacher } from '../types';
import { PERIOD_TIMINGS } from '../data/initialData';
import { FileText, Files, Printer, X } from 'lucide-react';

interface PrintableRoutineProps {
  routine: DailyRoutine;
  classrooms: Classroom[];
  papers: Paper[];
  teachers: Teacher[];
  language?: 'hi' | 'en';
  isModalPreview?: boolean;
  printLayoutMode?: '1-page' | '2-page';
  onChangePrintLayoutMode?: (mode: '1-page' | '2-page') => void;
  onClosePreview?: () => void;
}

export const PrintableRoutine: React.FC<PrintableRoutineProps> = ({
  routine,
  classrooms,
  papers,
  teachers,
  isModalPreview = false,
  printLayoutMode: propLayoutMode,
  onChangePrintLayoutMode,
  onClosePreview,
}) => {
  // Local state for layout mode if not controlled externally
  const [localLayoutMode, setLocalLayoutMode] = useState<'1-page' | '2-page'>('1-page');
  const layoutMode = propLayoutMode || localLayoutMode;

  const handleModeChange = (mode: '1-page' | '2-page') => {
    setLocalLayoutMode(mode);
    if (onChangePrintLayoutMode) {
      onChangePrintLayoutMode(mode);
    }
  };

  const paperMap = new Map(papers.map((p) => [p.id, p]));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));

  const oldBuilding = classrooms.filter((c) => c.building === 'OLD');
  const newBuilding = classrooms.filter((c) => c.building === 'NEW');

  // Compute period-wise available (free/reserve) instructors
  const absentNormalizedSet = new Set(
    routine.absentTeacherIds.map((id) => id.replace(/^T0*/, 'T'))
  );

  // Instructors on Leave / Duty / Sick / Absent
  const unavailableMap = new Map<string, { type: 'LEAVE' | 'DUTY' | 'SICK' | 'ABSENT'; remark?: string }>();

  if (routine.unavailableTeachers && routine.unavailableTeachers.length > 0) {
    for (const u of routine.unavailableTeachers) {
      const tid = u.teacherId.replace(/^T0*/, 'T');
      unavailableMap.set(tid, { type: u.type as any, remark: u.remark });
    }
  }

  for (const aid of routine.absentTeacherIds) {
    const tid = aid.replace(/^T0*/, 'T');
    if (!unavailableMap.has(tid)) {
      unavailableMap.set(tid, { type: 'ABSENT', remark: undefined });
    }
  }

  const unavailableInstructors = Array.from(unavailableMap.entries()).map(([tid, info]) => {
    const teacher =
      teacherMap.get(tid) ||
      teachers.find((t) => t.id.replace(/^T0*/, 'T') === tid);
    return {
      teacherId: tid,
      code: teacher?.code || tid,
      name: teacher?.name || tid,
      designation: teacher?.designation || '',
      type: info.type,
      remark: info.remark,
    };
  });

  const periodAvailability = PERIOD_TIMINGS.map((p) => {
    const busyTeacherIdsInPeriod = new Set(
      routine.slots
        .filter((s) => s.period === p.period)
        .map((s) => s.teacherId.replace(/^T0*/, 'T'))
    );

    const availableTeachers = teachers.filter(
      (t) =>
        !absentNormalizedSet.has(t.id.replace(/^T0*/, 'T')) &&
        !busyTeacherIdsInPeriod.has(t.id.replace(/^T0*/, 'T'))
    );

    return {
      period: p.period,
      label: p.label,
      time: p.time,
      availableTeachers,
    };
  });

  const renderRoomRow = (room: Classroom) => (
    <tr key={room.id} className="border-b border-black break-inside-avoid">
      <td className="border border-black py-1 px-1.5 font-bold bg-slate-50 align-top">
        <div className="text-slate-900 font-bold text-[10.5px] leading-tight">{room.name}</div>
        <div className="text-[8px] font-normal font-mono text-slate-700">
          Capacity: {room.capacity}
        </div>
      </td>
      {[1, 2, 3, 4, 5].map((period) => {
        const slot = routine.slots.find((s) => s.roomId === room.id && s.period === period);
        if (!slot) {
          return (
            <td key={period} className="border border-black p-1 text-center text-slate-400">
              -
            </td>
          );
        }

        const paper = paperMap.get(slot.paperId);
        const teacher = teacherMap.get(slot.teacherId);

        return (
          <td key={period} className="border border-black py-0.5 px-1 align-top leading-tight">
            <div className="flex items-center justify-between">
              <span className="font-bold text-black font-mono text-[9px]">{paper?.code}</span>
              {slot.isSubstitute && (
                <span className="text-[7px] px-1 rounded bg-amber-100 text-amber-900 font-bold uppercase">
                  Sub
                </span>
              )}
            </div>
            <div className="text-[8px] text-slate-800 truncate line-clamp-1 font-medium">
              {paper?.title}
            </div>
            <div className="font-semibold text-slate-900 mt-0.5 pt-0.5 border-t border-slate-200 flex items-center gap-1 text-[8.5px]">
              <span className="font-mono font-bold text-black">[{teacher?.code || 'T?'}]</span>
              <span className="truncate">{teacher?.name}</span>
            </div>
          </td>
        );
      })}
    </tr>
  );

  const content = (
    <div className="p-4 sm:p-6 bg-white text-black font-sans w-full max-w-6xl mx-auto">
      {/* Official Academy Header */}
      <div className="text-center border-b-2 border-black pb-2 mb-3">
        <h1 className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-black">
          STC, SAP 4TH BN
        </h1>
        <h2 className="text-[11px] sm:text-xs font-bold text-slate-800 uppercase tracking-wide">
          DAILY INDOOR CLASS ROUTINE & INSTRUCTOR ASSIGNMENT MASTER SHEET
        </h2>
        <div className="flex flex-wrap justify-between text-[10px] mt-1.5 font-mono border-t border-black pt-1">
          <span>TRAINING DAY: <strong>DAY {routine.dayNumber}</strong></span>
          <span>DATE: <strong>{routine.date}</strong></span>
          <span>ROOMS: <strong>15 CLASSROOMS (8 OLD + 7 NEW)</strong></span>
          <span>PERIOD DURATION: <strong>40 MIN EACH (09:40 - 13:30)</strong></span>
          <span>TOTAL SESSIONS: <strong>75 DAILY SLOTS</strong></span>
        </div>
      </div>

      {/* Unified Routine Master Table: All 15 Classrooms in continuous flow */}
      <div className="mb-3">
        <table className="w-full border-collapse border border-black text-[9px]">
          <thead>
            <tr className="bg-slate-200 text-black">
              <th className="border border-black py-1 px-1.5 text-left w-36 font-bold">
                Classroom / Capacity
              </th>
              {PERIOD_TIMINGS.map((p) => (
                <th key={p.period} className="border border-black py-1 px-1 text-center">
                  <div className="font-bold text-[9.5px]">{p.label}</div>
                  <div className="text-[8px] font-normal font-mono text-slate-800">
                    {p.time} (40 min)
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Old School Building Section Header Row */}
            <tr className="bg-slate-900 text-white font-bold break-inside-avoid">
              <td colSpan={6} className="border border-black py-0.5 px-2 text-[9px] uppercase tracking-wider bg-slate-900 text-white">
                Old School Building (8 Classrooms: OB-1 to OB-8 · Capacity: 70 Trainees Each)
              </td>
            </tr>
            {oldBuilding.map(renderRoomRow)}

            {/* New School Building Section Header Row */}
            <tr className="bg-slate-900 text-white font-bold break-inside-avoid">
              <td colSpan={6} className="border border-black py-0.5 px-2 text-[9px] uppercase tracking-wider bg-slate-900 text-white">
                New School Building (7 Classrooms: NB-1 to NB-7 · Capacity: 52 Trainees Each)
              </td>
            </tr>
            {newBuilding.map(renderRoomRow)}
          </tbody>
        </table>
      </div>

      {/* Period-Wise Available (Reserve / Free) Instructor Section */}
      <div className={`mb-3 ${layoutMode === '2-page' ? 'print-page-break-before' : ''}`}>
        <div className="flex items-center justify-between border-b-2 border-black pb-0.5 mb-1.5">
          <h3 className="text-[11px] sm:text-xs font-bold text-black uppercase tracking-wider">
            Period-Wise Available (Free / Reserve) Instructor Roster
          </h3>
          <span className="text-[9.5px] font-mono text-slate-700">
            Instructors with no active class scheduled in that period (Standby Reserve)
          </span>
        </div>

        <div className="grid grid-cols-5 border border-black text-[8px]">
          {periodAvailability.map((pa) => (
            <div key={pa.period} className="border-r border-black last:border-r-0 flex flex-col">
              <div className="bg-slate-200 border-b border-black py-0.5 px-1 text-center">
                <div className="font-bold text-black text-[9px]">{pa.label} ({pa.time})</div>
                <div className="mt-0.5 inline-block px-1.5 py-0.2 rounded bg-black text-white font-bold text-[7.5px]">
                  {pa.availableTeachers.length} Available Free
                </div>
              </div>

              <div className="p-1 space-y-0.5 flex-1 bg-white">
                {pa.availableTeachers.length > 0 ? (
                  pa.availableTeachers.map((t) => (
                    <div key={t.id} className="truncate border-b border-slate-100 last:border-b-0 pb-0.5">
                      <span className="font-mono font-bold mr-1 text-black">[{t.code}]</span>
                      <span className="text-slate-800">{t.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 italic text-center py-1">None free</div>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Instructors on Leave / Duty / Sick / Absent Section */}
      <div className="mt-2 p-1.5 border border-black bg-slate-50 text-[8px] break-inside-avoid">
        <div className="flex items-center justify-between border-b border-black pb-0.5 mb-1 font-bold uppercase tracking-wider text-black">
          <div className="flex items-center gap-1.5">
            <span className="text-[9.5px]">Instructors on Leave / Duty / Sick / Absent</span>
            {unavailableInstructors.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-black text-white text-[7.5px] font-bold font-mono">
                Total: {unavailableInstructors.length}
              </span>
            )}
          </div>
          <span className="text-[7.5px] font-mono text-slate-700">Daily Faculty Status</span>
        </div>

        {unavailableInstructors.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
            {unavailableInstructors.map((item) => {
              const label =
                item.type === 'LEAVE'
                  ? 'ON LEAVE'
                  : item.type === 'DUTY'
                  ? 'ON DUTY'
                  : item.type === 'SICK'
                  ? 'SICK / MEDICAL'
                  : 'ABSENT';

              return (
                <div
                  key={item.teacherId}
                  className="border border-black/40 bg-white p-1 rounded-xs"
                >
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-mono font-bold text-black text-[8.5px]">
                      [{item.code}]
                    </span>
                    <span className="text-[7px] font-bold px-1 py-0.2 rounded border border-black uppercase bg-slate-100 text-black">
                      {label}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-900 text-[8.5px] truncate">
                    {item.name}
                  </div>
                  {item.remark && (
                    <div className="text-[7.5px] text-slate-600 truncate mt-0.5 italic">
                      Remark: {item.remark}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-slate-700 font-medium italic py-0.5 text-[8px]">
            Nil — All instructors available and on active duty today.
          </div>
        )}
      </div>

      {/* Official Signature: O/C STC (Indoor) only */}
      <div className="mt-4 pt-2 border-t-2 border-black flex justify-end break-inside-avoid">
        <div className="text-center font-bold text-xs text-black min-w-[200px]">
          <div className="border-b border-black mb-1 pb-6">
            {/* Space for physical signature / seal */}
          </div>
          <div className="uppercase tracking-wider font-extrabold text-[11px]">
            O/C STC (Indoor)
          </div>
          <div className="text-[10px] font-semibold text-slate-800">
            STC, SAP 4th Bn
          </div>
        </div>
      </div>
    </div>
  );

  // If used as modal preview on screen
  if (isModalPreview) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs no-print">
        <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
          {/* Modal Header with Layout Mode Controls */}
          <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  STC, SAP 4th Bn - Print Timetable Sheet (Day {routine.dayNumber})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Unified master timetable with period-wise reserve instructor roster
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Layout Mode Selector */}
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-xs">
                <button
                  type="button"
                  onClick={() => handleModeChange('1-page')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-semibold transition-all ${
                    layoutMode === '1-page'
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Fit entire routine, tables, and roster onto 1 single page"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>1-Page Fit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('2-page')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-semibold transition-all ${
                    layoutMode === '2-page'
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Split routine table onto Page 1, available roster on Page 2"
                >
                  <Files className="w-3.5 h-3.5" />
                  <span>2-Page View</span>
                </button>
              </div>

              {/* Print Button */}
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document / Save PDF</span>
              </button>

              {onClosePreview && (
                <button
                  onClick={onClosePreview}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Sheet Preview Body */}
          <div className="overflow-y-auto p-4 bg-slate-100 flex-1">
            <div className="bg-white shadow-md border border-slate-300 rounded p-4">
              {content}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standalone print sheet for browser's native window.print()
  return (
    <div id="printable-routine-document" className="print-only">
      {content}
    </div>
  );
};
