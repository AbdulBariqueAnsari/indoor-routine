/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Classroom, DailyRoutine, Paper, Teacher, UnavailabilityType } from '../types';
import {
  computeInstructorUnavailabilityStats,
  exportToCsv,
  exportToExcel,
  generateInstructorUnavailabilityData,
  generateUnavailabilityIncidentLogData,
  TeacherUnavailabilitySummary,
} from '../utils/exportUtils';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BarChart3,
  Briefcase,
  Building,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  HeartPulse,
  Info,
  Layers,
  Printer,
  Search,
  Shield,
  Sparkles,
  Table,
  UserCheck,
  UserMinus,
  Users,
  UserX,
} from 'lucide-react';

interface InstructorUnavailabilityViewProps {
  teachers: Teacher[];
  allRoutines: DailyRoutine[];
  currentRoutine: DailyRoutine | null;
  papers?: Paper[];
  classrooms?: Classroom[];
  isAdmin?: boolean;
  onOpenLeaveManager?: () => void;
}

export const InstructorUnavailabilityView: React.FC<InstructorUnavailabilityViewProps> = ({
  teachers,
  allRoutines,
  currentRoutine,
  papers = [],
  classrooms = [],
  isAdmin = false,
  onOpenLeaveManager,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNAVAILABLE_ONLY' | 'PERFECT_ATTENDANCE' | UnavailabilityType>('ALL');
  const [buildingFilter, setBuildingFilter] = useState<'ALL' | 'OLD' | 'NEW' | 'FLOATING'>('ALL');
  const [sortBy, setSortBy] = useState<'unavail_desc' | 'unavail_asc' | 'code' | 'name' | 'leave' | 'duty' | 'rate'>('unavail_desc');
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'log'>('cards');
  const [expandedTeacherIds, setExpandedTeacherIds] = useState<Set<string>>(new Set());

  // 1. Calculate stats across all routines
  const statsList = useMemo(() => {
    return computeInstructorUnavailabilityStats(teachers, allRoutines);
  }, [teachers, allRoutines]);

  // Overall metric totals
  const totalRoutinesCount = Math.max(1, allRoutines.length);
  const totalIncidents = useMemo(() => {
    return statsList.reduce((acc, s) => acc + s.totalUnavailableDays, 0);
  }, [statsList]);

  const totalLeave = useMemo(() => statsList.reduce((acc, s) => acc + s.leaveCount, 0), [statsList]);
  const totalDuty = useMemo(() => statsList.reduce((acc, s) => acc + s.dutyCount, 0), [statsList]);
  const totalSick = useMemo(() => statsList.reduce((acc, s) => acc + s.sickCount, 0), [statsList]);
  const totalRest = useMemo(() => statsList.reduce((acc, s) => acc + s.restCount, 0), [statsList]);
  const totalAbsent = useMemo(() => statsList.reduce((acc, s) => acc + s.absentCount, 0), [statsList]);

  const instructorsWithLeaves = useMemo(() => {
    return statsList.filter((s) => s.totalUnavailableDays > 0).length;
  }, [statsList]);

  // Today's current unavailable set
  const todayUnavailableSet = useMemo(() => {
    return new Set(currentRoutine?.absentTeacherIds || []);
  }, [currentRoutine]);

  // Toggle accordion card expansion
  const toggleExpand = (teacherId: string) => {
    setExpandedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) next.delete(teacherId);
      else next.add(teacherId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedTeacherIds(new Set(teachers.map((t) => t.id)));
  };

  const collapseAll = () => {
    setExpandedTeacherIds(new Set());
  };

  // Filter & Sort
  const filteredAndSortedStats = useMemo(() => {
    let list = statsList.filter((item) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        item.teacher.code.toLowerCase().includes(q) ||
        item.teacher.name.toLowerCase().includes(q) ||
        (item.teacher.designation && item.teacher.designation.toLowerCase().includes(q)) ||
        item.incidents.some((inc) => inc.remark.toLowerCase().includes(q) || inc.type.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'UNAVAILABLE_ONLY') {
        if (item.totalUnavailableDays === 0) return false;
      } else if (statusFilter === 'PERFECT_ATTENDANCE') {
        if (item.totalUnavailableDays > 0) return false;
      } else if (statusFilter === 'LEAVE') {
        if (item.leaveCount === 0) return false;
      } else if (statusFilter === 'DUTY') {
        if (item.dutyCount === 0) return false;
      } else if (statusFilter === 'SICK') {
        if (item.sickCount === 0) return false;
      } else if (statusFilter === 'REST') {
        if (item.restCount === 0) return false;
      } else if (statusFilter === 'ABSENT') {
        if (item.absentCount === 0) return false;
      }

      // Building filter
      if (buildingFilter !== 'ALL' && item.teacher.assignedBuilding !== buildingFilter) {
        return false;
      }

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      switch (sortBy) {
        case 'unavail_desc':
          if (b.totalUnavailableDays !== a.totalUnavailableDays) {
            return b.totalUnavailableDays - a.totalUnavailableDays;
          }
          return (a.teacher.code || '').localeCompare(b.teacher.code || '', undefined, { numeric: true });
        case 'unavail_asc':
          if (a.totalUnavailableDays !== b.totalUnavailableDays) {
            return a.totalUnavailableDays - b.totalUnavailableDays;
          }
          return (a.teacher.code || '').localeCompare(b.teacher.code || '', undefined, { numeric: true });
        case 'code':
          return (a.teacher.code || '').localeCompare(b.teacher.code || '', undefined, { numeric: true });
        case 'name':
          return (a.teacher.name || '').localeCompare(b.teacher.name || '');
        case 'leave':
          if (b.leaveCount !== a.leaveCount) return b.leaveCount - a.leaveCount;
          return b.totalUnavailableDays - a.totalUnavailableDays;
        case 'duty':
          if (b.dutyCount !== a.dutyCount) return b.dutyCount - a.dutyCount;
          return b.totalUnavailableDays - a.totalUnavailableDays;
        case 'rate':
          return a.attendanceRate - b.attendanceRate;
        default:
          return 0;
      }
    });

    return list;
  }, [statsList, searchTerm, statusFilter, buildingFilter, sortBy]);

  // Chronological incident log list
  const chronologicalIncidents = useMemo(() => {
    const list: {
      incident: any;
      teacher: Teacher;
    }[] = [];

    for (const s of statsList) {
      for (const inc of s.incidents) {
        list.push({ incident: inc, teacher: s.teacher });
      }
    }

    list.sort((a, b) => {
      if (a.incident.dayNumber !== b.incident.dayNumber) {
        return b.incident.dayNumber - a.incident.dayNumber; // latest day first
      }
      return b.incident.date.localeCompare(a.incident.date);
    });

    return list;
  }, [statsList]);

  // Export handlers
  const handleExportExcel = () => {
    const headers = [
      'Sl No',
      'Teacher Code',
      'Instructor Name',
      'Designation',
      'Campus Base',
      'Total Unavailable Days',
      'Leave (Casual/Earned)',
      'Special Duty',
      'Sick / Medical',
      'Rest (Standby Reserve)',
      'Absent (Uninformed)',
      'Attendance Rate (%)',
      'Date-wise Details & Remarks Log',
    ];
    const data = generateInstructorUnavailabilityData(teachers, allRoutines);
    exportToExcel(
      `STC_Instructor_Unavailability_Ledger`,
      'Faculty Unavailability Ledger',
      headers,
      data,
      {
        institutionName: 'Specialised Training Centre (STC), SAP 4th Bn, Kasba',
        centreName: `Instructor Unavailability & Leave Roster (${allRoutines.length} Routines Tracked)`,
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      }
    );
  };

  const handleExportCsv = () => {
    const headers = [
      'Sl No',
      'Teacher Code',
      'Instructor Name',
      'Designation',
      'Campus Base',
      'Total Unavailable Days',
      'Leave (Casual/Earned)',
      'Special Duty',
      'Sick / Medical',
      'Rest (Standby Reserve)',
      'Absent (Uninformed)',
      'Attendance Rate (%)',
      'Date-wise Details & Remarks Log',
    ];
    const data = generateInstructorUnavailabilityData(teachers, allRoutines);
    exportToCsv(`STC_Instructor_Unavailability_Ledger`, headers, data);
  };

  const handleExportIncidentLog = () => {
    const headers = [
      'Sl No',
      'Date',
      'Day Number',
      'Teacher Code',
      'Instructor Name',
      'Designation',
      'Unavailability Type',
      'Remark / Reason',
      'Routine Status',
    ];
    const data = generateUnavailabilityIncidentLogData(teachers, allRoutines);
    exportToExcel(
      `STC_Unavailability_Incident_Log`,
      'Incident Log',
      headers,
      data,
      {
        institutionName: 'Specialised Training Centre (STC), SAP 4th Bn, Kasba',
        centreName: `Chronological Faculty Leave & Duty Incidents (${chronologicalIncidents.length} Events)`,
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      }
    );
  };

  // Helper badge color
  const getTypeBadge = (type: UnavailabilityType) => {
    switch (type) {
      case 'LEAVE':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'DUTY':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'SICK':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      case 'REST':
        return 'bg-teal-100 text-teal-900 border-teal-300';
      case 'ABSENT':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-800">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase bg-rose-500 text-white tracking-wider flex items-center gap-1">
                <UserX className="w-3.5 h-3.5" />
                Faculty Absence Register
              </span>
              <span className="text-xs text-indigo-200">
                Official Leave, Duty & Absence Ledger · {teachers.length} Instructors Across {allRoutines.length} Routines
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Instructor Unavailability & Leave Ledger
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Consolidated faculty attendance tracking system. Aggregates total sanctioned leaves, special duty deployments,
              sick/medical absences, rest rosters, and uninformed absences with exact routine dates and administrative remarks.
            </p>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {isAdmin && onOpenLeaveManager && (
              <button
                onClick={onOpenLeaveManager}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                title="Mark unavailability for current routine"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>Mark Today's Absence</span>
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              title="Download Excel Spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel Export</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              title="Download CSV file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              title="Print Ledger"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Total Faculty */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            Total Roster
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
            {teachers.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {allRoutines.length} Daily Routines
          </div>
        </div>

        {/* Total Incidents */}
        <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/30 shadow-2xs">
          <div className="text-[11px] font-semibold text-rose-800 flex items-center gap-1">
            <UserX className="w-3.5 h-3.5 text-rose-600" />
            Total Absences
          </div>
          <div className="text-xl font-bold text-rose-950 mt-1 font-mono">
            {totalIncidents}
          </div>
          <div className="text-[10px] text-rose-600 font-medium mt-0.5">
            {instructorsWithLeaves} Teachers affected
          </div>
        </div>

        {/* Casual/Sanctioned Leaves */}
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            Casual Leaves
          </div>
          <div className="text-xl font-bold text-amber-950 mt-1 font-mono">
            {totalLeave}
          </div>
          <div className="text-[10px] text-amber-700 mt-0.5">
            Sanctioned / CL
          </div>
        </div>

        {/* Special Duty */}
        <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/30 shadow-2xs">
          <div className="text-[11px] font-semibold text-blue-800 flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5 text-blue-600" />
            Special Duty
          </div>
          <div className="text-xl font-bold text-blue-950 mt-1 font-mono">
            {totalDuty}
          </div>
          <div className="text-[10px] text-blue-700 mt-0.5">
            L&O / Escort / VIP
          </div>
        </div>

        {/* Sick / Medical */}
        <div className="bg-white p-3.5 rounded-xl border border-red-200 bg-red-50/30 shadow-2xs">
          <div className="text-[11px] font-semibold text-red-800 flex items-center gap-1">
            <HeartPulse className="w-3.5 h-3.5 text-red-600" />
            Sick / Medical
          </div>
          <div className="text-xl font-bold text-red-950 mt-1 font-mono">
            {totalSick}
          </div>
          <div className="text-[10px] text-red-700 mt-0.5">
            Medical / Hospital
          </div>
        </div>

        {/* Rest Standby */}
        <div className="bg-white p-3.5 rounded-xl border border-teal-200 bg-teal-50/30 shadow-2xs">
          <div className="text-[11px] font-semibold text-teal-800 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            Rest Standby
          </div>
          <div className="text-xl font-bold text-teal-950 mt-1 font-mono">
            {totalRest}
          </div>
          <div className="text-[10px] text-teal-700 mt-0.5">
            Available in Reserve
          </div>
        </div>

        {/* Uninformed Absent */}
        <div className="bg-white p-3.5 rounded-xl border border-purple-200 bg-purple-50/30 shadow-2xs">
          <div className="text-[11px] font-semibold text-purple-800 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-purple-600" />
            Absent
          </div>
          <div className="text-xl font-bold text-purple-950 mt-1 font-mono">
            {totalAbsent}
          </div>
          <div className="text-[10px] text-purple-700 mt-0.5">
            Uninformed / Absent
          </div>
        </div>
      </div>

      {/* 3. Search, Filter, Sort & View Mode Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by code (T1, T2...), name, designation, or remark..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-indigo-500 focus:bg-white"
            />
          </div>

          {/* Quick Status Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({teachers.length})
            </button>
            <button
              onClick={() => setStatusFilter('UNAVAILABLE_ONLY')}
              className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'UNAVAILABLE_ONLY'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              With Absences ({instructorsWithLeaves})
            </button>
            <button
              onClick={() => setStatusFilter('PERFECT_ATTENDANCE')}
              className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'PERFECT_ATTENDANCE'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              100% Present ({teachers.length - instructorsWithLeaves})
            </button>
            <button
              onClick={() => setStatusFilter('LEAVE')}
              className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'LEAVE'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Leaves
            </button>
            <button
              onClick={() => setStatusFilter('DUTY')}
              className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'DUTY'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Duties
            </button>
            <button
              onClick={() => setStatusFilter('REST')}
              className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'REST'
                  ? 'bg-teal-600 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Rest
            </button>
          </div>
        </div>

        {/* Secondary controls row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Campus Base filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Campus Base:</span>
              <select
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value as any)}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-800 focus:outline-indigo-500"
              >
                <option value="ALL">All Bases</option>
                <option value="OLD">Old Building (OB)</option>
                <option value="NEW">New Building (NB)</option>
                <option value="FLOATING">Floating Master</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-800 focus:outline-indigo-500"
              >
                <option value="unavail_desc">Highest Absences First</option>
                <option value="unavail_asc">Lowest Absences First</option>
                <option value="code">Instructor Code (T1..T{teachers.length})</option>
                <option value="name">Name (A-Z)</option>
                <option value="leave">Most Casual Leaves</option>
                <option value="duty">Most Special Duties</option>
                <option value="rate">Lowest Attendance %</option>
              </select>
            </div>

            {viewMode === 'cards' && (
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <button
                  onClick={expandAll}
                  className="hover:text-indigo-600 font-medium underline px-1"
                >
                  Expand All
                </button>
                <span>·</span>
                <button
                  onClick={collapseAll}
                  className="hover:text-indigo-600 font-medium underline px-1"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Faculty Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Ledger Grid</span>
            </button>
            <button
              onClick={() => setViewMode('log')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                viewMode === 'log'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Incident Timeline ({chronologicalIncidents.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. VIEW MODE 1: FACULTY CARDS WITH COLLAPSIBLE LOGS */}
      {viewMode === 'cards' && (
        <div className="space-y-3">
          {filteredAndSortedStats.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <div className="font-bold text-slate-800">No matching faculty records found</div>
              <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or filter options.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredAndSortedStats.map((item) => {
                const isExpanded = expandedTeacherIds.has(item.teacher.id);
                const isTodayUnavailable = todayUnavailableSet.has(item.teacher.id);

                return (
                  <div
                    key={item.teacher.id}
                    className={`bg-white rounded-xl border transition-all ${
                      item.totalUnavailableDays > 0
                        ? 'border-slate-200 hover:border-indigo-300 shadow-2xs'
                        : 'border-slate-200/80 bg-slate-50/20 shadow-none'
                    }`}
                  >
                    {/* Card Top Section */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        {/* Instructor Identity */}
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-900 font-bold font-mono text-sm shrink-0">
                            {item.teacher.code}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-slate-900 leading-tight">
                                {item.teacher.name}
                              </h4>
                              {isTodayUnavailable ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  Absent Today
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Active Today
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>{item.teacher.designation || 'Instructor'}</span>
                              <span>·</span>
                              <span className="font-medium text-slate-700">
                                {item.teacher.assignedBuilding === 'OLD'
                                  ? 'Old Bldg (OB)'
                                  : item.teacher.assignedBuilding === 'NEW'
                                  ? 'New Bldg (NB)'
                                  : 'Floating Master'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Total Count Badge */}
                        <div className="text-right shrink-0">
                          <div className="text-xs text-slate-500 font-medium">Total Absences</div>
                          <div className="flex items-baseline justify-end gap-1 mt-0.5">
                            <span
                              className={`text-2xl font-bold font-mono ${
                                item.totalUnavailableDays > 0 ? 'text-rose-600' : 'text-emerald-600'
                              }`}
                            >
                              {item.totalUnavailableDays}
                            </span>
                            <span className="text-xs text-slate-400">/ {totalRoutinesCount} days</span>
                          </div>
                        </div>
                      </div>

                      {/* Attendance Percentage Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Academy Attendance Rate</span>
                          <span
                            className={`font-mono font-bold ${
                              item.attendanceRate >= 90
                                ? 'text-emerald-700'
                                : item.attendanceRate >= 75
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {item.attendanceRate}% Present
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div
                            className={`h-full rounded-full transition-all ${
                              item.attendanceRate >= 90
                                ? 'bg-emerald-500'
                                : item.attendanceRate >= 75
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${item.attendanceRate}%` }}
                          />
                        </div>
                      </div>

                      {/* Category Breakdown Chips */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            item.leaveCount > 0
                              ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          Leave: <strong>{item.leaveCount}</strong>
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            item.dutyCount > 0
                              ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          Duty: <strong>{item.dutyCount}</strong>
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            item.sickCount > 0
                              ? 'bg-red-50 border-red-300 text-red-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          Sick: <strong>{item.sickCount}</strong>
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            item.restCount > 0
                              ? 'bg-teal-50 border-teal-300 text-teal-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          Rest: <strong>{item.restCount}</strong>
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            item.absentCount > 0
                              ? 'bg-purple-50 border-purple-300 text-purple-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          Absent: <strong>{item.absentCount}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Collapsible Incident Log Area */}
                    <div className="border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                      <button
                        onClick={() => toggleExpand(item.teacher.id)}
                        className="w-full px-4 py-2 flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        <span className="font-semibold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Detailed Incident History</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-200 font-bold text-slate-700">
                            {item.incidents.length}
                          </span>
                        </span>
                        <span className="text-[11px] text-indigo-600 flex items-center gap-0.5 font-medium">
                          {isExpanded ? 'Hide Records' : 'Show Records'}
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-3 pt-1 border-t border-slate-200/60">
                          {item.incidents.length === 0 ? (
                            <div className="text-[11px] text-slate-500 italic py-2">
                              No leaves or absences logged across generated daily routines. Full academy attendance.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {item.incidents.map((inc, iIdx) => (
                                <div
                                  key={iIdx}
                                  className="p-2 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between gap-2 shadow-2xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase font-mono ${getTypeBadge(
                                        inc.type
                                      )}`}
                                    >
                                      {inc.type}
                                    </span>
                                    <div>
                                      <div className="font-semibold text-slate-800">
                                        Day {inc.dayNumber > 0 ? inc.dayNumber : 'Ext'} · {inc.date}
                                      </div>
                                      <div className="text-[11px] text-slate-500">
                                        {inc.remark || 'No remark provided'}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-medium text-slate-400 capitalize shrink-0">
                                    {inc.routineStatus || 'published'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. VIEW MODE 2: COMPREHENSIVE DATA TABLE */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Consolidated Faculty Unavailability Register (All {teachers.length} Instructors)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed quantitative summary of all absences, leaves, duties, and attendance rates.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded border border-slate-200 font-semibold text-slate-700">
              Showing {filteredAndSortedStats.length} of {teachers.length} Instructors
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-3 border-r border-slate-200 w-12 text-center">Sl</th>
                  <th className="p-3 border-r border-slate-200 w-16">Code</th>
                  <th className="p-3 border-r border-slate-200 min-w-[180px]">Instructor Name</th>
                  <th className="p-3 border-r border-slate-200 min-w-[120px]">Designation & Base</th>
                  <th className="p-3 border-r border-slate-200 w-24 text-center font-bold text-rose-700 bg-rose-50/50">
                    Total Absent
                  </th>
                  <th className="p-3 border-r border-slate-200 w-16 text-center text-amber-800">Leave</th>
                  <th className="p-3 border-r border-slate-200 w-16 text-center text-blue-800">Duty</th>
                  <th className="p-3 border-r border-slate-200 w-16 text-center text-red-800">Sick</th>
                  <th className="p-3 border-r border-slate-200 w-16 text-center text-teal-800">Rest</th>
                  <th className="p-3 border-r border-slate-200 w-16 text-center text-purple-800">Absent</th>
                  <th className="p-3 border-r border-slate-200 w-24 text-center">Attendance %</th>
                  <th className="p-3 min-w-[280px]">Detailed Incidents & Remarks Log</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAndSortedStats.map((item, idx) => (
                  <tr
                    key={item.teacher.id}
                    className={`hover:bg-indigo-50/40 transition-colors ${
                      item.totalUnavailableDays > 0 ? 'bg-white' : 'bg-slate-50/30'
                    }`}
                  >
                    <td className="p-3 border-r border-slate-200 text-center font-mono text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="p-3 border-r border-slate-200 font-bold font-mono text-indigo-900">
                      {item.teacher.code}
                    </td>
                    <td className="p-3 border-r border-slate-200">
                      <div className="font-bold text-slate-900">{item.teacher.name}</div>
                      {todayUnavailableSet.has(item.teacher.id) && (
                        <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 rounded bg-rose-100 text-rose-800">
                          Absent Today
                        </span>
                      )}
                    </td>
                    <td className="p-3 border-r border-slate-200 text-[11px] text-slate-600">
                      <div>{item.teacher.designation || 'Instructor'}</div>
                      <div className="text-[10px] text-slate-400">{item.teacher.assignedBuilding || 'FLOATING'}</div>
                    </td>
                    <td className="p-3 border-r border-slate-200 text-center font-mono font-bold text-sm text-rose-700 bg-rose-50/20">
                      {item.totalUnavailableDays}
                    </td>
                    <td className="p-3 border-r border-slate-200 text-center font-mono font-semibold text-amber-900">
                      {item.leaveCount}
                    </td>
                    <td className="p-3 border-r border-slate-200 text-center font-mono font-semibold text-blue-900">
                      {item.dutyCount}
                    </td>
                    <td className="p-3 border-r border-slate-200 text-center font-mono font-semibold text-red-900">
                      {item.sickCount}
                    </td>
                    <td className="p-3 border-r border-slate-200 text-center font-mono font-semibold text-teal-900">
                      {item.restCount}
                    </td>
                    <td className="p-3 border-r border-slate-200 text-center font-mono font-semibold text-purple-900">
                      {item.absentCount}
                    </td>
                    <td className="p-3 border-r border-slate-200 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                          item.attendanceRate >= 90
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.attendanceRate >= 75
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.attendanceRate}%
                      </span>
                    </td>
                    <td className="p-3 text-[11px] text-slate-700">
                      {item.incidents.length === 0 ? (
                        <span className="text-slate-400 italic">No recorded absences</span>
                      ) : (
                        <div className="space-y-1">
                          {item.incidents.map((inc, i) => (
                            <div key={i} className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase font-mono ${getTypeBadge(
                                  inc.type
                                )}`}
                              >
                                {inc.type}
                              </span>
                              <span className="font-semibold text-slate-800">
                                Day {inc.dayNumber || 'Ext'} ({inc.date}):
                              </span>
                              <span className="text-slate-600">{inc.remark || 'Logged'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Total {filteredAndSortedStats.length} faculty records displayed · Tracking all {allRoutines.length} routine days.
            </span>
            <span className="font-mono text-[11px]">STC, SAP 4th Bn · Official Academic Record</span>
          </div>
        </div>
      )}

      {/* 6. VIEW MODE 3: CHRONOLOGICAL INCIDENT TIMELINE */}
      {viewMode === 'log' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Chronological Unavailability Timeline ({chronologicalIncidents.length} Events)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every logged leave, special duty, medical, rest, and absence event ordered chronologically by routine day.
              </p>
            </div>
            <button
              onClick={handleExportIncidentLog}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Incident Log (Excel)</span>
            </button>
          </div>

          {chronologicalIncidents.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <div className="font-bold text-slate-800">No Unavailability Incidents Logged</div>
              <p className="text-xs text-slate-400 mt-1">All instructors have 100% full attendance in generated routines.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {chronologicalIncidents.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center font-mono font-bold text-indigo-900 text-xs shrink-0">
                      {item.teacher.code}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{item.teacher.name}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 font-medium">
                          {item.teacher.designation || 'Instructor'}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold border uppercase font-mono ${getTypeBadge(
                            item.incident.type
                          )}`}
                        >
                          {item.incident.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        <strong className="text-slate-700">Reason / Remark:</strong>{' '}
                        {item.incident.remark || 'No remark entered'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right sm:shrink-0 text-slate-500 text-[11px]">
                    <div className="font-bold text-slate-800">
                      Day {item.incident.dayNumber > 0 ? item.incident.dayNumber : 'Ext'}
                    </div>
                    <div className="text-slate-400">{item.incident.date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
