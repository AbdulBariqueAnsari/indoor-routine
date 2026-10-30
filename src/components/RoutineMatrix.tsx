/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Classroom, ClassSlot, DailyRoutine, Paper, Teacher } from '../types';
import { PERIOD_TIMINGS } from '../data/initialData';
import {
  ArrowLeftRight,
  Building2,
  Check,
  Clock,
  Edit3,
  Filter,
  Info,
  Lock,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Unlock,
  UserCheck,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { SlotDetailModal } from './SlotDetailModal';

interface RoutineMatrixProps {
  routine: DailyRoutine;
  classrooms: Classroom[];
  papers: Paper[];
  teachers: Teacher[];
  isEditable: boolean;
  isAdmin: boolean;
  onEditSlot: (slot: ClassSlot) => void;
  onSwapSlots?: (slotId1: string, slotId2: string) => void;
  onRecreateRoutine?: () => void;
  onOpenLeaveManager?: () => void;
  onRequireAdmin?: () => void;
  onPrint?: () => void;
  onToggleLockRoutine?: (routineId: string) => void;
}

export const RoutineMatrix: React.FC<RoutineMatrixProps> = ({
  routine,
  classrooms,
  papers,
  teachers,
  isEditable,
  isAdmin,
  onEditSlot,
  onSwapSlots,
  onRecreateRoutine,
  onOpenLeaveManager,
  onRequireAdmin,
  onPrint,
  onToggleLockRoutine,
}) => {
  // Filter states
  const [buildingFilter, setBuildingFilter] = useState<'ALL' | 'OLD' | 'NEW'>('ALL');
  const [selectedTeacherHighlight, setSelectedTeacherHighlight] = useState<string>('ALL');
  const [selectedRoomHighlight, setSelectedRoomHighlight] = useState<string>('ALL');
  const [selectedPaperHighlight, setSelectedPaperHighlight] = useState<string>('ALL');
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDisplayMode, setFilterDisplayMode] = useState<'highlight' | 'matched_only'>('highlight');

  // Slot Detail Modal (Public or Admin read-only view)
  const [inspectingSlot, setInspectingSlot] = useState<ClassSlot | null>(null);

  // Admin Swap Mode state
  const [isSwapModeActive, setIsSwapModeActive] = useState<boolean>(false);
  const [swapSelectedSlot, setSwapSelectedSlot] = useState<ClassSlot | null>(null);

  // Admin Quick Edit Mode (Always shows edit buttons prominently)
  const [isQuickEditVisible, setIsQuickEditVisible] = useState<boolean>(true);

  const paperMap = new Map(papers.map((p) => [p.id, p]));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const roomMap = new Map(classrooms.map((r) => [r.id, r]));

  // Check if any filter is active
  const isAnyFilterActive =
    selectedTeacherHighlight !== 'ALL' ||
    selectedRoomHighlight !== 'ALL' ||
    selectedPaperHighlight !== 'ALL' ||
    selectedPeriodFilter !== 'ALL' ||
    searchQuery.trim().length > 0;

  const resetAllFilters = () => {
    setSelectedTeacherHighlight('ALL');
    setSelectedRoomHighlight('ALL');
    setSelectedPaperHighlight('ALL');
    setSelectedPeriodFilter('ALL');
    setSearchQuery('');
  };

  // Helper to retrieve slot
  const getSlot = (roomId: string, period: number): ClassSlot | undefined => {
    return routine.slots.find((s) => s.roomId === roomId && s.period === period);
  };

  // Check slot match against current filters
  const isSlotMatched = (slot?: ClassSlot, room?: Classroom): boolean => {
    if (!slot) return false;

    // Period filter
    if (selectedPeriodFilter !== 'ALL' && slot.period.toString() !== selectedPeriodFilter) {
      return false;
    }

    // Room filter
    if (selectedRoomHighlight !== 'ALL' && slot.roomId !== selectedRoomHighlight) {
      return false;
    }

    // Teacher filter
    if (selectedTeacherHighlight !== 'ALL' && slot.teacherId !== selectedTeacherHighlight) {
      return false;
    }

    // Paper filter
    if (selectedPaperHighlight !== 'ALL' && slot.paperId !== selectedPaperHighlight) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const paper = paperMap.get(slot.paperId);
      const teacher = teacherMap.get(slot.teacherId);
      const rm = room || roomMap.get(slot.roomId);

      const paperMatch =
        (paper?.code && paper.code.toLowerCase().includes(q)) ||
        (paper?.title && paper.title.toLowerCase().includes(q));

      const teacherMatch =
        (teacher?.name && teacher.name.toLowerCase().includes(q)) ||
        (teacher?.code && teacher.code.toLowerCase().includes(q));

      const roomMatch =
        (rm?.name && rm.name.toLowerCase().includes(q)) ||
        (rm?.code && rm.code.toLowerCase().includes(q));

      if (!paperMatch && !teacherMatch && !roomMatch) {
        return false;
      }
    }

    return true;
  };

  // Calculate matching count
  const matchedSlotsCount = isAnyFilterActive
    ? routine.slots.filter((s) => isSlotMatched(s)).length
    : 0;

  // Filter rooms based on building filter and matched_only mode
  const filteredRooms = classrooms.filter((r) => {
    if (buildingFilter !== 'ALL' && r.building !== buildingFilter) {
      return false;
    }

    if (selectedRoomHighlight !== 'ALL' && r.id !== selectedRoomHighlight) {
      return false;
    }

    if (filterDisplayMode === 'matched_only' && isAnyFilterActive) {
      const hasMatch = [1, 2, 3, 4, 5].some((p) => {
        const slot = getSlot(r.id, p);
        return isSlotMatched(slot, r);
      });
      return hasMatch;
    }

    return true;
  });

  const oldBuildingRooms = filteredRooms.filter((r) => r.building === 'OLD');
  const newBuildingRooms = filteredRooms.filter((r) => r.building === 'NEW');

  // Handle slot clicking
  const handleSlotClick = (slot: ClassSlot) => {
    if (isSwapModeActive && isAdmin && isEditable && onSwapSlots) {
      if (!swapSelectedSlot) {
        setSwapSelectedSlot(slot);
      } else if (swapSelectedSlot.id === slot.id) {
        setSwapSelectedSlot(null);
      } else {
        onSwapSlots(swapSelectedSlot.id, slot.id);
        setSwapSelectedSlot(null);
        setIsSwapModeActive(false);
      }
      return;
    }

    if (!isAdmin) {
      // Public User: Open Read-only Slot Detail Modal
      setInspectingSlot(slot);
    } else if (isAdmin && isEditable) {
      // Admin: Open Slot Edit Modal
      onEditSlot(slot);
    } else {
      // Locked routine or viewing
      setInspectingSlot(slot);
    }
  };

  const renderSlotCell = (room: Classroom, period: number) => {
    const slot = getSlot(room.id, period);
    if (!slot) {
      return (
        <td key={period} className="p-2 border border-slate-200 text-center text-xs text-slate-400 bg-slate-50">
          -
        </td>
      );
    }

    const paper = paperMap.get(slot.paperId);
    const teacher = teacherMap.get(slot.teacherId);
    const isMatch = isSlotMatched(slot, room);
    const isDimmed = isAnyFilterActive && !isMatch && filterDisplayMode === 'highlight';
    const isSwapSelected = swapSelectedSlot?.id === slot.id;

    if (
      filterDisplayMode === 'matched_only' &&
      selectedPeriodFilter !== 'ALL' &&
      slot.period.toString() !== selectedPeriodFilter
    ) {
      return (
        <td key={period} className="p-2 border border-slate-200 text-center text-xs text-slate-300 bg-slate-50/50">
          -
        </td>
      );
    }

    return (
      <td
        key={period}
        onClick={() => handleSlotClick(slot)}
        className={`p-2 border border-slate-200 text-xs transition-all relative group cursor-pointer ${
          isSwapSelected
            ? 'bg-indigo-100 ring-2 ring-indigo-600 z-20 shadow-md'
            : isMatch && isAnyFilterActive
            ? 'bg-amber-50/95 ring-2 ring-amber-500 z-10 shadow-xs'
            : isDimmed
            ? 'opacity-25 bg-slate-50 grayscale-20 hover:opacity-80'
            : 'bg-white hover:bg-slate-50'
        }`}
      >
        {!slot.paperId && !slot.teacherId ? (
          <div className="flex flex-col h-full justify-center items-center gap-1 min-h-[76px] text-center p-1">
            <span className="text-[11px] font-semibold text-slate-400 italic">-- Blank Slot --</span>
            {isAdmin && isEditable && (
              <span className="text-[9px] text-indigo-600 font-medium">Click to assign</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full justify-between gap-1.5 min-h-[76px]">
            {/* Paper / Subject Tag */}
            <div>
              <div className="flex items-center justify-between gap-1">
                <span
                  className="font-bold text-[11px] px-1.5 py-0.5 rounded text-white tracking-wide shrink-0 font-mono shadow-2xs"
                  style={{ backgroundColor: paper?.color || '#4F46E5' }}
                >
                  {paper?.code || slot.paperId || 'N/A'}
                </span>

                {slot.isPriority && (
                  <span
                    title="Priority Subject Scheduled"
                    className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1 rounded shrink-0"
                  >
                    ★ Priority
                  </span>
                )}
              </div>

              <p className="font-semibold text-slate-800 text-[11px] mt-1 line-clamp-1" title={paper?.title}>
                {paper?.title || 'Subject Unassigned'}
              </p>
            </div>

            {/* Teacher Info */}
            <div className="border-t border-slate-100 pt-1 flex items-end justify-between gap-1">
              <div className="min-w-0 flex-1">
                {slot.teacherId ? (
                  <>
                    <p
                      className="font-semibold text-slate-900 text-[11px] truncate flex items-center gap-1"
                      title={`${teacher?.code || 'T?'}: ${teacher?.name || ''}`}
                    >
                      <span className="px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-[10px] shrink-0">
                        {teacher?.code || 'T?'}
                      </span>
                      <span className="truncate">{teacher?.name}</span>
                    </p>

                    {slot.isSubstitute && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 font-semibold mt-0.5"
                        title={slot.substituteReason || 'Substitute Instructor Assigned'}
                      >
                        <UserCheck className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate max-w-[120px]">Sub</span>
                      </span>
                    )}
                  </>
                ) : (
                  <span
                    className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-semibold inline-block truncate"
                    title={slot.substituteReason || 'No Instructor Assigned (Vacant)'}
                  >
                    No Instructor
                  </span>
                )}
              </div>

            {/* Action Indicators (Visible Prominently for Admin) */}
            {isAdmin && isEditable ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSlot(slot);
                }}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 text-[10px] font-bold transition-all no-print ${
                  isQuickEditVisible ? 'opacity-90' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Click to edit slot subject/instructor"
              >
                <Edit3 className="w-3 h-3" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            ) : !isAdmin ? (
              <span
                className="opacity-0 group-hover:opacity-60 text-indigo-600 text-[10px] flex items-center gap-0.5 font-medium no-print"
                title="Click to view full class details"
              >
                <Info className="w-3 h-3" />
                <span>Details</span>
              </span>
            ) : (
              <span className="opacity-0 group-hover:opacity-40 text-slate-400 no-print" title="Locked routine">
                <Lock className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
        )}
      </td>
    );
  };

  const renderBuildingTable = (title: string, rooms: Classroom[], badgeColor: string) => {
    if (rooms.length === 0) return null;

    return (
      <div className="mb-8 last:mb-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${badgeColor}`}></div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              {title}
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              ({rooms.length} Classrooms)
            </span>
          </div>

          <span className="text-xs text-slate-500 hidden sm:inline">
            5 Daily Periods / Room (40 min each)
          </span>
        </div>

        {/* Mobile Horizontal Swipe Guidance */}
        <div className="sm:hidden flex items-center justify-between text-[11px] text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg mb-2 border border-slate-200">
          <span className="flex items-center gap-1 font-medium">
            👉 Swipe horizontally for Periods 1–5
          </span>
          <span className="font-bold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
            Room Fixed
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs touch-pan-x">
          <table className="w-full border-collapse text-left min-w-[760px] sm:min-w-[860px]">
            <thead>
              <tr className="bg-slate-100/95 border-b border-slate-200 text-slate-700 text-xs font-semibold">
                <th className="p-2 sm:p-2.5 w-32 sm:w-44 border-r border-slate-200 sticky left-0 z-20 bg-slate-100 shadow-xs">
                  Classroom / Capacity
                </th>
                {PERIOD_TIMINGS.map((p) => {
                  const isPeriodSelected = selectedPeriodFilter === p.period.toString();
                  return (
                    <th
                      key={p.period}
                      className={`p-2 sm:p-2.5 border-r border-slate-200 last:border-r-0 transition-colors ${
                        isPeriodSelected ? 'bg-amber-100/70 text-amber-950 font-bold' : ''
                      }`}
                    >
                      <div className="font-bold text-slate-900 flex items-center justify-between">
                        <span>{p.label}</span>
                        {isPeriodSelected && (
                          <span className="text-[10px] text-amber-700 font-normal">Filtered</span>
                        )}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-slate-500 font-normal font-mono tabular-nums">
                        {p.time}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rooms.map((room) => {
                const isRoomHighlighted = selectedRoomHighlight === 'ALL' || selectedRoomHighlight === room.id;

                return (
                  <tr
                    key={room.id}
                    className={`hover:bg-slate-50/50 transition-colors ${
                      selectedRoomHighlight !== 'ALL' && !isRoomHighlighted ? 'opacity-30' : ''
                    }`}
                  >
                    <td
                      className={`p-2 sm:p-2.5 border-r border-slate-200 text-xs sticky left-0 z-10 shadow-xs transition-colors ${
                        selectedRoomHighlight === room.id
                          ? 'bg-amber-100 text-amber-950 font-bold border-l-4 border-l-amber-500'
                          : 'bg-slate-50 text-slate-900'
                      }`}
                    >
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">{room.name}</div>
                      <div className="text-[10px] sm:text-[11px] text-slate-600 mt-0.5 font-mono">
                        Capacity: <span className="font-bold text-slate-800">{room.capacity}</span>
                      </div>
                    </td>

                    {[1, 2, 3, 4, 5].map((period) => renderSlotCell(room, period))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* PROMINENT ADMIN ACTIVE ROUTINE CONTROL STRIP (USER REQUEST: CLEAR EDIT & RECREATE OPTIONS) */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-3.5 sm:p-4 rounded-xl shadow-xs border border-indigo-800/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-300 font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  Day {routine.dayNumber} Routine ({routine.date})
                </span>
                {!routine.isLocked ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                    <Unlock className="w-3 h-3 text-amber-400" />
                    <span>Editable Mode (Hidden from Users)</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span>Locked (Published to Users)</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300">
                15 Classrooms · 75 Daily Slots {!routine.isLocked ? '· Unlocked draft mode (Click slot to edit)' : '· Published read-only mode'}
              </p>
            </div>
          </div>

          {/* Direct prominent actions to Lock/Publish, Recreate, Edit, and Swap */}
          <div className="flex flex-wrap items-center gap-2">
            {onToggleLockRoutine && (
              <button
                onClick={() => onToggleLockRoutine(routine.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg shadow-xs transition-colors ${
                  routine.isLocked
                    ? 'bg-white/10 text-amber-300 border border-amber-300/40 hover:bg-white/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500'
                }`}
                title={
                  routine.isLocked
                    ? 'Unlock to make routine editable (will hide from users while unlocked)'
                    : 'Lock routine and publish to all users'
                }
              >
                {routine.isLocked ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Unlock to Edit</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-white" />
                    <span>Lock & Publish to Users</span>
                  </>
                )}
              </button>
            )}

            {isEditable && onRecreateRoutine && (
              <button
                onClick={onRecreateRoutine}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs transition-colors"
                title="Re-run scheduler for this active day with modified leaves or excluded subjects"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recreate Routine (Day {routine.dayNumber})</span>
              </button>
            )}

            {isEditable && onSwapSlots && (
              <button
                onClick={() => {
                  setIsSwapModeActive(!isSwapModeActive);
                  setSwapSelectedSlot(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  isSwapModeActive
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs ring-2 ring-indigo-400'
                    : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                }`}
                title="Swap two slots directly"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>{isSwapModeActive ? 'Cancel Swap' : 'Quick Swap Slots'}</span>
              </button>
            )}

            {onOpenLeaveManager && (
              <button
                onClick={onOpenLeaveManager}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/20 text-rose-200 border border-rose-400/30 hover:bg-rose-500/30 transition-colors"
                title="Faculty Unavailability Register (Absent / Leave / Duty / Sick)"
              >
                <UserX className="w-3.5 h-3.5 text-rose-300" />
                <span>Unavailable Register</span>
              </button>
            )}

            {isEditable && (
              <button
                onClick={() => setIsQuickEditVisible(!isQuickEditVisible)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                  isQuickEditVisible
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
                title="Toggle visibility of Edit buttons on slot cells"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Badges: {isQuickEditVisible ? 'Visible' : 'Hover'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Routine Filter Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 no-print">
        {/* Top Filter Controls: Building & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          {/* Building Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0 w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={() => setBuildingFilter('ALL')}
              className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1 font-semibold rounded-md transition-colors text-center ${
                buildingFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All 15 Rooms
            </button>
            <button
              onClick={() => setBuildingFilter('OLD')}
              className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1 font-semibold rounded-md transition-colors text-center ${
                buildingFilter === 'OLD'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Old Bldg (8)
            </button>
            <button
              onClick={() => setBuildingFilter('NEW')}
              className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1 font-semibold rounded-md transition-colors text-center ${
                buildingFilter === 'NEW'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              New Bldg (7)
            </button>
          </div>

          {/* Quick Search Input */}
          <div className="relative flex-1 max-w-md w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search instructor, paper, room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white text-slate-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Print Timetable Action */}
          {onPrint && (
            <button
              onClick={onPrint}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs shrink-0"
              title="Open Printable Timetable Sheet"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>Print Timetable / PDF</span>
            </button>
          )}
        </div>

        {/* Second Row: Specific Dropdowns (Teacher, Classroom, Subject, Period, View Mode) */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 text-xs">
          {/* 1. Filter by Instructor */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
            <span className="text-slate-500 font-medium text-[11px]">Instructor:</span>
            <select
              value={selectedTeacherHighlight}
              onChange={(e) => setSelectedTeacherHighlight(e.target.value)}
              className={`w-full sm:w-auto border rounded-lg px-2 py-1 text-xs focus:outline-hidden ${
                selectedTeacherHighlight !== 'ALL'
                  ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold'
                  : 'border-slate-300 bg-white text-slate-800'
              }`}
              aria-label="Filter by Instructor"
            >
              <option value="ALL">All Instructors (26: T1–T26)</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} - {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Filter by Classroom */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
            <span className="text-slate-500 font-medium text-[11px]">Classroom:</span>
            <select
              value={selectedRoomHighlight}
              onChange={(e) => setSelectedRoomHighlight(e.target.value)}
              className={`w-full sm:w-auto border rounded-lg px-2 py-1 text-xs focus:outline-hidden ${
                selectedRoomHighlight !== 'ALL'
                  ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold'
                  : 'border-slate-300 bg-white text-slate-800'
              }`}
              aria-label="Filter by Classroom"
            >
              <option value="ALL">All 15 Rooms</option>
              {classrooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.building === 'OLD' ? 'Old' : 'New'}: {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Filter by Subject / Paper */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
            <span className="text-slate-500 font-medium text-[11px]">Subject:</span>
            <select
              value={selectedPaperHighlight}
              onChange={(e) => setSelectedPaperHighlight(e.target.value)}
              className={`w-full sm:w-auto border rounded-lg px-2 py-1 text-xs focus:outline-hidden ${
                selectedPaperHighlight !== 'ALL'
                  ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold'
                  : 'border-slate-300 bg-white text-slate-800'
              }`}
              aria-label="Filter by Subject"
            >
              <option value="ALL">All Subjects (13 Papers)</option>
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}: {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Filter by Period */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
            <span className="text-slate-500 font-medium text-[11px]">Period:</span>
            <select
              value={selectedPeriodFilter}
              onChange={(e) => setSelectedPeriodFilter(e.target.value)}
              className={`w-full sm:w-auto border rounded-lg px-2 py-1 text-xs focus:outline-hidden ${
                selectedPeriodFilter !== 'ALL'
                  ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold'
                  : 'border-slate-300 bg-white text-slate-800'
              }`}
              aria-label="Filter by Period"
            >
              <option value="ALL">All Periods (1–5)</option>
              {PERIOD_TIMINGS.map((p) => (
                <option key={p.period} value={p.period.toString()}>
                  {p.label} ({p.time})
                </option>
              ))}
            </select>
          </div>

          {/* 5. View Mode Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 col-span-2 sm:col-span-1">
            <span className="text-slate-500 font-medium text-[11px]">Mode:</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setFilterDisplayMode('highlight')}
                className={`flex-1 sm:flex-none px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  filterDisplayMode === 'highlight'
                    ? 'bg-white text-slate-800 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Highlight matching slots across the full timetable"
              >
                Highlight
              </button>
              <button
                onClick={() => setFilterDisplayMode('matched_only')}
                className={`flex-1 sm:flex-none px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  filterDisplayMode === 'matched_only'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Only show classrooms and slots that match filters"
              >
                Filter Only
              </button>
            </div>
          </div>

          {/* Reset Filters */}
          {isAnyFilterActive && (
            <button
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors ml-auto"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Filter Summary Pill */}
        {isAnyFilterActive && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>
                <strong>Filter Applied:</strong> Showing{' '}
                <span className="font-bold font-mono text-amber-950">{matchedSlotsCount}</span> matched
                period slot(s)
                {selectedTeacherHighlight !== 'ALL' &&
                  ` · Teacher: ${teacherMap.get(selectedTeacherHighlight)?.name}`}
                {selectedRoomHighlight !== 'ALL' &&
                  ` · Room: ${roomMap.get(selectedRoomHighlight)?.name}`}
                {selectedPaperHighlight !== 'ALL' &&
                  ` · Subject: ${paperMap.get(selectedPaperHighlight)?.code}`}
                {selectedPeriodFilter !== 'ALL' && ` · Period: ${selectedPeriodFilter}`}
                {searchQuery && ` · Search: "${searchQuery}"`}
              </span>
            </div>
            <button
              onClick={resetAllFilters}
              className="text-amber-800 underline font-semibold hover:text-amber-950 shrink-0 ml-2"
            >
              Clear
            </button>
          </div>
        )}

        {/* Swap Mode Prompt */}
        {isSwapModeActive && (
          <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 px-3.5 py-2 rounded-lg text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-indigo-600 animate-bounce" />
              <span>
                {swapSelectedSlot ? (
                  <>
                    Slot 1 selected (
                    <strong>
                      {roomMap.get(swapSelectedSlot.roomId)?.name}, Period {swapSelectedSlot.period}
                    </strong>
                    ). Click the second slot to swap!
                  </>
                ) : (
                  'Click the first slot you wish to swap, then click the second slot.'
                )}
              </span>
            </div>
            <button
              onClick={() => {
                setIsSwapModeActive(false);
                setSwapSelectedSlot(null);
              }}
              className="text-indigo-800 font-semibold hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Routine Tables */}
      <div className="space-y-6">
        {filteredRooms.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
            <p className="font-semibold text-sm">No classroom slots matched your filter criteria.</p>
            <p className="text-xs mt-1">Try clearing filters or selecting another building / subject.</p>
            <button
              onClick={resetAllFilters}
              className="mt-3 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            {renderBuildingTable(
              'Old School Building (8 Classrooms)',
              oldBuildingRooms,
              'bg-amber-500'
            )}

            {renderBuildingTable(
              'New School Building (7 Classrooms)',
              newBuildingRooms,
              'bg-indigo-600'
            )}
          </>
        )}
      </div>

      {/* Public / Read-Only Slot Detail Inspection Modal */}
      {inspectingSlot && (
        <SlotDetailModal
          slot={inspectingSlot}
          classroom={roomMap.get(inspectingSlot.roomId)}
          paper={paperMap.get(inspectingSlot.paperId)}
          teacher={teacherMap.get(inspectingSlot.teacherId)}
          onClose={() => setInspectingSlot(null)}
        />
      )}
    </div>
  );
};
