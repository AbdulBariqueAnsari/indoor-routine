/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Classroom, DailyRoutine, Paper, Teacher } from '../types';
import { INITIAL_TEACHERS } from '../data/initialData';
import {
  BookOpen,
  CheckCircle2,
  Filter,
  Lock,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  UserX,
} from 'lucide-react';

interface TeacherMappingViewProps {
  teachers: Teacher[];
  papers: Paper[];
  classrooms: Classroom[];
  currentRoutine: DailyRoutine | null;
  isAdmin: boolean;
  onUpdateTeachers: (updated: Teacher[]) => void;
  onRequireAdmin: () => void;
}

export const TeacherMappingView: React.FC<TeacherMappingViewProps> = ({
  teachers,
  papers,
  classrooms,
  currentRoutine,
  isAdmin,
  onUpdateTeachers,
  onRequireAdmin,
}) => {
  // Local editable copy of teachers
  const [editingList, setEditingList] = useState<Teacher[]>(() => [...teachers]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPaperId, setFilterPaperId] = useState('ALL');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const paperMap = new Map(papers.map((p) => [p.id, p]));
  const roomMap = new Map(classrooms.map((r) => [r.id, r]));

  // Count active slots in current routine for each teacher
  const teacherLoadMap = new Map<string, number>();
  const teacherSlotsMap = new Map<string, { period: number; roomCode: string; paperCode: string }[]>();

  if (currentRoutine) {
    for (const slot of currentRoutine.slots) {
      if (slot.teacherId) {
        teacherLoadMap.set(slot.teacherId, (teacherLoadMap.get(slot.teacherId) || 0) + 1);
        const list = teacherSlotsMap.get(slot.teacherId) || [];
        const room = roomMap.get(slot.roomId);
        const paper = paperMap.get(slot.paperId);
        list.push({
          period: slot.period,
          roomCode: room?.code || slot.roomId,
          paperCode: paper?.code || slot.paperId,
        });
        teacherSlotsMap.set(slot.teacherId, list);
      }
    }
  }

  const handleFieldChange = (teacherId: string, field: keyof Teacher, value: any) => {
    if (!isAdmin) {
      onRequireAdmin();
      return;
    }

    setEditingList((prev) =>
      prev.map((t) => (t.id === teacherId ? { ...t, [field]: value } : t))
    );
    setHasUnsavedChanges(true);
    setSaveSuccessMsg('');
  };

  const handleSaveAll = () => {
    if (!isAdmin) {
      onRequireAdmin();
      return;
    }

    onUpdateTeachers(editingList);
    setHasUnsavedChanges(false);
    setSaveSuccessMsg('Teacher name mappings saved successfully! Routine slots & matrices updated.');
    setTimeout(() => setSaveSuccessMsg(''), 5000);
  };

  const handleResetToDefaults = () => {
    if (!isAdmin) {
      onRequireAdmin();
      return;
    }

    if (
      window.confirm(
        'Are you sure you want to restore original academy instructor names and designations for T1 to T26?'
      )
    ) {
      setEditingList([...INITIAL_TEACHERS]);
      onUpdateTeachers([...INITIAL_TEACHERS]);
      setHasUnsavedChanges(false);
      setSaveSuccessMsg('Restored original academy instructors for T1 to T26.');
      setTimeout(() => setSaveSuccessMsg(''), 5000);
    }
  };

  // Filter list
  const filteredTeachers = editingList.filter((t) => {
    const q = searchTerm.toLowerCase();
    const matchesQuery =
      t.code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.designation.toLowerCase().includes(q) ||
      (t.phone && t.phone.toLowerCase().includes(q));

    const matchesPaper =
      filterPaperId === 'ALL' ||
      t.primaryPaperIds.includes(filterPaperId) ||
      t.secondaryPaperIds.includes(filterPaperId);

    return matchesQuery && matchesPaper;
  });

  return (
    <div className="space-y-5">
      {/* Top Banner Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-5 shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-amber-400 text-slate-950 tracking-wider">
                Admin Instructor Section
              </span>
              <span className="text-xs text-indigo-200">
                26 System Instructor Codes · T1 through T26
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Instructor Assignment & Name Mapping (T1 to T26)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
              In this dedicated section, assign real instructor names and campus building roles (Old Bldg, New Bldg, Floating) against system codes <strong>T1 through T26</strong>. 26 instructors are strictly divided across the 12 theory papers by session ratio. Practical (Paper-13) does not require fixed primary instructors—any available instructor can conduct practical classes.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors flex items-center gap-1.5 border border-white/20"
                  title="Reset to default academy instructor names"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAll}
                  className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 ${
                    hasUnsavedChanges
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white ring-2 ring-emerald-400 animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{hasUnsavedChanges ? 'Save Unsaved Changes' : 'Save Mappings'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onRequireAdmin}
                className="px-3.5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Admin Login to Edit</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10 mt-4 text-xs">
          <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
            <div className="text-slate-400 text-[11px]">Theory Allocation</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">26 Instructors / 12 Papers</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
            <div className="text-slate-400 text-[11px]">Active Today</div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              {currentRoutine
                ? teachers.length - currentRoutine.absentTeacherIds.length
                : 26}{' '}
              Instructors
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
            <div className="text-slate-400 text-[11px]">Practical (Paper-13)</div>
            <div className="text-lg font-bold font-mono text-lime-400 mt-0.5">
              Open to All 26
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
            <div className="text-slate-400 text-[11px]">Total Classrooms</div>
            <div className="text-lg font-bold font-mono text-amber-300 mt-0.5">15 Classrooms</div>
          </div>
        </div>
      </div>

      {/* 26 Instructors Calculation Across 12 Theory Papers Card */}
      <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                26 Instructors Distribution Across 12 Theory Papers (Session Ratio Based)
              </h3>
              <p className="text-[11px] text-slate-500">
                Theory papers account for 435 total target sessions. Instructor counts strictly follow session weightage.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-lime-50 border border-lime-200 text-lime-900 text-[11px] font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-lime-600" />
            <span>Practical (Paper-13): No fixed instructor (Any available instructor conducts)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>1 Instructor / Paper</span>
              <span className="font-mono text-[10px] bg-indigo-100 px-1.5 py-0.2 rounded">3 Papers · 3 Teachers</span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-700">
              <div>• <strong>Paper-8: Police Admin (8 sess)</strong>: T17 (Floating)</div>
              <div>• <strong>Paper-7: Criminology (17 sess)</strong>: T16 (Floating)</div>
              <div>• <strong>Paper-4: Bharatiya Sakshya Adhiniyam / BSA (23 sess)</strong>: T11 (Floating)</div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>2 Instructors / Paper</span>
              <span className="font-mono text-[10px] bg-indigo-100 px-1.5 py-0.2 rounded">5 Papers · 10 Teachers</span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-700">
              <div>• <strong>Paper-9: Police Station Mgmt (30 sess)</strong>: T18 (Old), T19 (New)</div>
              <div>• <strong>Paper-5: Forensic Science (34 sess)</strong>: T12 (Old), T13 (New)</div>
              <div>• <strong>Paper-11: Internal Security (38 sess)</strong>: T22 (Old), T23 (New)</div>
              <div>• <strong>Paper-6: ICT & Cyber Crime (39 sess)</strong>: T14 (Old), T15 (New)</div>
              <div>• <strong>Paper-10: Personality Dev & Stress Mgmt (40 sess)</strong>: T20 (Old), T21 (New)</div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>3 Instructors / Paper</span>
              <span className="font-mono text-[10px] bg-indigo-100 px-1.5 py-0.2 rounded">3 Papers · 9 Teachers</span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-700">
              <div>• <strong>Paper-1: BNSS (46 sess)</strong>: T1 (Old), T2 (New), T3 (Float)</div>
              <div>• <strong>Paper-3: Minor Acts (50 sess)</strong>: T8 (Old), T9 (New), T10 (Float)</div>
              <div>• <strong>Paper-12: Ethics & Human Rights (54 sess)</strong>: T24 (Old), T25 (New), T26 (Float)</div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>4 Instructors / Paper</span>
              <span className="font-mono text-[10px] bg-indigo-100 px-1.5 py-0.2 rounded">1 Paper · 4 Teachers</span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-700">
              <div>• <strong>Paper-2: Bharatiya Nyaya Sanhita / BNS (56 sess)</strong>: T4, T5 (Old), T6, T7 (New)</div>
              <div className="pt-1.5 border-t border-slate-200 text-[10px] text-emerald-700 font-semibold">
                Total Theory: 3+10+9+4 = 26 Instructors
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {saveSuccessMsg && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{saveSuccessMsg}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMsg('')}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Read-only Alert when not admin */}
      {!isAdmin && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>View Only Mode:</strong> You are viewing current instructor mappings for T1 through T26. Log in with admin credentials to change names or reassign instructors.
            </span>
          </div>
          <button
            onClick={onRequireAdmin}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold shrink-0"
          >
            Login as Admin
          </button>
        </div>
      )}

      {/* Search & Subject Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by code (T1, T2..), teacher name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Filter Subject:
          </span>
          <select
            value={filterPaperId}
            onChange={(e) => setFilterPaperId(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-indigo-500"
          >
            <option value="ALL">All Subjects (13 Papers)</option>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}: {p.title}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-400 pl-2">
            Showing {filteredTeachers.length} of 26
          </span>
        </div>
      </div>

      {/* Main Teacher Mapping Grid / Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="p-3 w-16 text-center border-r border-slate-200">Code</th>
                <th className="p-3 w-64 border-r border-slate-200">Assigned Teacher Name</th>
                <th className="p-3 w-44 border-r border-slate-200">Campus / Building Role</th>
                <th className="p-3 border-r border-slate-200">Main Subject & Backup Subject Assignments</th>
                <th className="p-3 w-24 text-center border-r border-slate-200">Max Periods</th>
                <th className="p-3 w-28 text-center">Active Duty Load</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTeachers.map((t) => {
                const assignedLoad = teacherLoadMap.get(t.id) || 0;
                const assignedSlots = teacherSlotsMap.get(t.id) || [];
                const isOnLeave = currentRoutine?.absentTeacherIds.includes(t.id) ?? false;

                return (
                  <tr
                    key={t.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      isOnLeave ? 'bg-rose-50/20' : ''
                    }`}
                  >
                    {/* Instructor Code Badge */}
                    <td className="p-3 text-center border-r border-slate-200 align-top">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 font-mono font-bold text-indigo-700 text-sm shadow-2xs">
                        {t.code}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">#{t.id}</div>
                    </td>

                    {/* Assigned Teacher Name Input */}
                    <td className="p-3 border-r border-slate-200 align-top">
                      {isAdmin ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={t.name}
                            onChange={(e) => handleFieldChange(t.id, 'name', e.target.value)}
                            placeholder="Enter instructor name"
                            className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-md text-xs font-bold text-slate-900 focus:outline-hidden transition-colors"
                          />
                          <div className="text-[10px] text-slate-500 flex items-center justify-between">
                            <span>Code: {t.code}</span>
                            <span className="text-slate-400">Editable</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                          <div className="text-[11px] text-slate-500">{t.designation}</div>
                        </div>
                      )}
                    </td>

                    {/* Campus / Building Role */}
                    <td className="p-3 border-r border-slate-200 align-top">
                      {isAdmin ? (
                        <select
                          value={t.assignedBuilding || 'FLOATING'}
                          onChange={(e) => handleFieldChange(t.id, 'assignedBuilding', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-800 focus:outline-indigo-500 transition-colors"
                        >
                          <option value="OLD">Old School Bldg</option>
                          <option value="NEW">New School Bldg</option>
                          <option value="FLOATING">Floating (Both Bldgs)</option>
                        </select>
                      ) : (
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
                      )}
                    </td>

                    {/* Primary Assigned Papers & Cross-Backups */}
                    {/* Main Subject & Backup Subject Assignments */}
                    <td className="p-3 border-r border-slate-200 align-top">
                      {/* Main Subject */}
                      <div className="mb-2">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Main Subject:
                        </div>
                        <div className="space-y-1">
                          {t.primaryPaperIds.map((pid) => {
                            const paper = paperMap.get(pid);
                            return (
                              <div
                                key={pid}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-50/70 border border-indigo-200 text-xs w-full"
                              >
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white font-mono shrink-0"
                                  style={{ backgroundColor: paper?.color || '#4F46E5' }}
                                >
                                  {paper?.code || pid}
                                </span>
                                <span className="font-semibold text-slate-800 text-[11px] truncate">
                                  {paper?.title || pid}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Backup Subjects (At least 2 Options - 100% Floating across campus) */}
                      <div className="space-y-1.5 pt-1.5 border-t border-slate-200">
                        <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
                          <span>Backup Subjects (2 Floating Options):</span>
                          <span className="text-[9px] text-emerald-600 font-normal">
                            100% Floating across campus
                          </span>
                        </div>

                        {isAdmin ? (
                          <div className="space-y-1">
                            {/* Backup Option 1 */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-emerald-900 w-16 shrink-0">
                                Backup 1:
                              </span>
                              <select
                                value={(t.backupPaperIds && t.backupPaperIds[0]) || (t.secondaryPaperIds && t.secondaryPaperIds[0]) || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const b2 = (t.backupPaperIds && t.backupPaperIds[1]) || (t.secondaryPaperIds && t.secondaryPaperIds[1]) || '';
                                  const bList = [val, b2].filter(Boolean);
                                  handleFieldChange(t.id, 'backupPaperIds', bList);
                                  handleFieldChange(t.id, 'secondaryPaperIds', bList);
                                }}
                                className="w-full px-2 py-1 bg-emerald-50/60 hover:bg-white focus:bg-white border border-emerald-300 rounded text-xs font-semibold text-emerald-950 focus:outline-emerald-500 transition-colors"
                              >
                                <option value="">-- None / General Reserve --</option>
                                {papers.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.code}: {p.title}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Backup Option 2 */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-teal-900 w-16 shrink-0">
                                Backup 2:
                              </span>
                              <select
                                value={(t.backupPaperIds && t.backupPaperIds[1]) || (t.secondaryPaperIds && t.secondaryPaperIds[1]) || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const b1 = (t.backupPaperIds && t.backupPaperIds[0]) || (t.secondaryPaperIds && t.secondaryPaperIds[0]) || '';
                                  const bList = [b1, val].filter(Boolean);
                                  handleFieldChange(t.id, 'backupPaperIds', bList);
                                  handleFieldChange(t.id, 'secondaryPaperIds', bList);
                                }}
                                className="w-full px-2 py-1 bg-teal-50/60 hover:bg-white focus:bg-white border border-teal-300 rounded text-xs font-semibold text-teal-950 focus:outline-teal-500 transition-colors"
                              >
                                <option value="">-- None / General Reserve --</option>
                                {papers.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.code}: {p.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {/* Backup 1 Display */}
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-[10px] font-bold text-emerald-900 w-16 shrink-0">
                                Backup 1:
                              </span>
                              {(() => {
                                const b1 = (t.backupPaperIds && t.backupPaperIds[0]) || (t.secondaryPaperIds && t.secondaryPaperIds[0]);
                                if (!b1) return <span className="text-[10px] text-slate-400 italic">None</span>;
                                const p = paperMap.get(b1);
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-900 truncate">
                                    <span className="font-mono font-bold">{p?.code || b1}</span>
                                    <span className="truncate">{p?.title}</span>
                                    <span className="text-[9px] text-emerald-700 bg-emerald-100/80 px-1 rounded ml-1 font-normal">
                                      Floating
                                    </span>
                                  </span>
                                );
                              })()}
                            </div>

                            {/* Backup 2 Display */}
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-[10px] font-bold text-teal-900 w-16 shrink-0">
                                Backup 2:
                              </span>
                              {(() => {
                                const b2 = (t.backupPaperIds && t.backupPaperIds[1]) || (t.secondaryPaperIds && t.secondaryPaperIds[1]);
                                if (!b2) return <span className="text-[10px] text-slate-400 italic">None</span>;
                                const p = paperMap.get(b2);
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-[10px] font-semibold text-teal-900 truncate">
                                    <span className="font-mono font-bold">{p?.code || b2}</span>
                                    <span className="truncate">{p?.title}</span>
                                    <span className="text-[9px] text-teal-700 bg-teal-100/80 px-1 rounded ml-1 font-normal">
                                      Floating
                                    </span>
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                        <div className="text-[9px] text-emerald-700 font-medium">
                          * Floating Rule: Backup instructors can teach in Old Bldg or New Bldg without building constraint.
                        </div>
                      </div>
                    </td>

                    {/* Max Daily Periods */}
                    <td className="p-3 text-center border-r border-slate-200 align-top">
                      {isAdmin ? (
                        <select
                          value={t.maxDailyPeriods}
                          onChange={(e) =>
                            handleFieldChange(t.id, 'maxDailyPeriods', parseInt(e.target.value, 10))
                          }
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold text-slate-800 focus:outline-indigo-500"
                        >
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                          <option value={5}>5</option>
                        </select>
                      ) : (
                        <span className="font-mono font-bold text-slate-700">
                          {t.maxDailyPeriods}
                        </span>
                      )}
                    </td>

                    {/* Active Routine Load */}
                    <td className="p-3 text-center align-top">
                      {isOnLeave ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                          <UserX className="w-3 h-3" />
                          <span>On Leave</span>
                        </span>
                      ) : (
                        <div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-xs ${
                              assignedLoad > 0
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {assignedLoad} / {t.maxDailyPeriods} periods
                          </span>

                          {assignedSlots.length > 0 && (
                            <div className="text-[9px] text-slate-500 mt-1 line-clamp-1">
                              {assignedSlots.map((s) => `P${s.period}:${s.roomCode}`).join(' ')}
                            </div>
                          )}
                        </div>
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
            Total 26 instructors configured (Codes T1 to T26) across 12 theory papers. Practical (Paper-13) has no fixed instructors and is open to all available instructors.
          </span>
          {isAdmin && hasUnsavedChanges && (
            <button
              onClick={handleSaveAll}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes Now</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
