/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BuildingInfo, Classroom, ClassSlot, DailyRoutine, Paper, RoutineRuleConfig, Teacher } from './types';
import { api } from './utils/api';
import { DEFAULT_ROUTINE_RULES, INITIAL_BUILDINGS } from './data/initialData';
import { isRoutineEditable, validateRoutine } from './utils/routineValidator';
import { Header } from './components/Header';
import { ConflictBanner } from './components/ConflictBanner';
import { RoutineMatrix } from './components/RoutineMatrix';
import { CumulativeStatsView } from './components/CumulativeStatsView';
import { InstructorLedgerView } from './components/InstructorLedgerView';
import { TeacherDutyView } from './components/TeacherDutyView';
import { TeacherMappingView } from './components/TeacherMappingView';
import { TeacherDeploymentTracker } from './components/TeacherDeploymentTracker';
import { HistoryView } from './components/HistoryView';
import { SlotEditModal } from './components/SlotEditModal';
import { RoutineGeneratorModal } from './components/RoutineGeneratorModal';
import { RoutineRulesModal } from './components/RoutineRulesModal';
import { MasterDataModal } from './components/MasterDataModal';
import { PrintableRoutine } from './components/PrintableRoutine';
import { AdminLoginModal } from './components/AdminLoginModal';
import { FacultyLeaveManagerModal } from './components/FacultyLeaveManagerModal';
import { Database, Loader2, ShieldCheck, User } from 'lucide-react';

export default function App() {
  const [buildings, setBuildings] = useState<BuildingInfo[]>(INITIAL_BUILDINGS);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allRoutines, setAllRoutines] = useState<DailyRoutine[]>([]);
  const [rules, setRules] = useState<RoutineRuleConfig>(DEFAULT_ROUTINE_RULES);
  const [activeRoutineId, setActiveRoutineId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('matrix');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Role: Admin vs Public User
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return sessionStorage.getItem('routine_is_admin') === 'true';
  });

  // Modals state
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [recreatingRoutine, setRecreatingRoutine] = useState<DailyRoutine | null>(null);
  const [isMasterDataOpen, setIsMasterDataOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isLeaveManagerOpen, setIsLeaveManagerOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [printLayoutMode, setPrintLayoutMode] = useState<'1-page' | '2-page'>('1-page');
  const [editingSlot, setEditingSlot] = useState<ClassSlot | null>(null);

  // Initialize data on mount from Server Storage
  useEffect(() => {
    async function loadDataFromServer() {
      try {
        setIsLoading(true);
        const data = await api.loadAllData();
        setBuildings(data.buildings || INITIAL_BUILDINGS);
        setClassrooms(data.classrooms || []);
        setPapers(data.papers || []);
        setTeachers(data.teachers || []);
        setAllRoutines(data.routines || []);
        setRules(data.rules || DEFAULT_ROUTINE_RULES);
        setActiveRoutineId(data.settings?.activeRoutineId || data.routines?.[data.routines.length - 1]?.id || '');
      } catch (err) {
        console.error('Failed to load data from server backend:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDataFromServer();
  }, []);

  const currentRoutine =
    allRoutines.find((r) => r.id === activeRoutineId) ||
    allRoutines[allRoutines.length - 1] ||
    null;

  // Selected routine is editable by Admin if unlocked or latest
  const isCurrentEditable = currentRoutine
    ? !currentRoutine.isLocked || isRoutineEditable(currentRoutine, allRoutines)
    : false;

  // Live validation of current routine
  const validation = currentRoutine
    ? validateRoutine(currentRoutine.slots, teachers, classrooms, currentRoutine.absentTeacherIds)
    : { isValid: true, conflicts: [], buildingConflicts: [], absentViolations: [], missingSlotsCount: 0, totalSlots: 0 };

  // Handle slot correction save (Admin only - saved to server)
  const handleSaveSlotCorrection = async (updatedSlot: ClassSlot) => {
    if (!isAdmin || !currentRoutine || !isCurrentEditable) return;

    const updatedSlots = currentRoutine.slots.map((s) => (s.id === updatedSlot.id ? updatedSlot : s));
    const updatedRoutine: DailyRoutine = {
      ...currentRoutine,
      slots: updatedSlots,
      updatedAt: new Date().toISOString(),
    };

    const updatedAll = allRoutines.map((r) => (r.id === updatedRoutine.id ? updatedRoutine : r));
    setAllRoutines(updatedAll);
    setEditingSlot(null);
    try {
      await api.saveRoutines(updatedAll);
    } catch (err) {
      console.error('Error saving slot correction to server:', err);
    }
  };

  // Handle slot quick swap (Admin only - saved to server)
  const handleSwapSlots = async (slotId1: string, slotId2: string) => {
    if (!isAdmin || !currentRoutine || !isCurrentEditable) return;
    const s1 = currentRoutine.slots.find((s) => s.id === slotId1);
    const s2 = currentRoutine.slots.find((s) => s.id === slotId2);
    if (!s1 || !s2) return;

    const updatedSlots = currentRoutine.slots.map((s) => {
      if (s.id === slotId1) {
        return {
          ...s,
          paperId: s2.paperId,
          teacherId: s2.teacherId,
          isSubstitute: s2.isSubstitute,
          originalTeacherId: s2.originalTeacherId,
          substituteReason: s2.substituteReason,
          isPriority: s2.isPriority,
        };
      }
      if (s.id === slotId2) {
        return {
          ...s,
          paperId: s1.paperId,
          teacherId: s1.teacherId,
          isSubstitute: s1.isSubstitute,
          originalTeacherId: s1.originalTeacherId,
          substituteReason: s1.substituteReason,
          isPriority: s1.isPriority,
        };
      }
      return s;
    });

    const updatedRoutine: DailyRoutine = {
      ...currentRoutine,
      slots: updatedSlots,
      updatedAt: new Date().toISOString(),
    };

    const updatedAll = allRoutines.map((r) => (r.id === updatedRoutine.id ? updatedRoutine : r));
    setAllRoutines(updatedAll);
    try {
      await api.saveRoutines(updatedAll);
    } catch (err) {
      console.error('Error saving swapped slots to server:', err);
    }
  };

  // Handle emergency leave or substitute routine update (saved to server)
  const handleUpdateCurrentRoutine = async (updatedRoutine: DailyRoutine) => {
    if (!isAdmin) return;
    const updatedAll = allRoutines.map((r) => (r.id === updatedRoutine.id ? updatedRoutine : r));
    setAllRoutines(updatedAll);
    try {
      await api.saveRoutines(updatedAll);
    } catch (err) {
      console.error('Error updating routine on server:', err);
    }
  };

  // Open Recreate Active Routine
  const handleOpenRecreateRoutine = () => {
    if (!isAdmin || !currentRoutine || !isCurrentEditable) return;
    setRecreatingRoutine(currentRoutine);
    setIsGeneratorOpen(true);
  };

  // Open New Routine Generator
  const handleOpenNewRoutine = () => {
    if (!isAdmin) return;
    setRecreatingRoutine(null);
    setIsGeneratorOpen(true);
  };

  // Handle routine generated (saved to server)
  const handleRoutineGenerated = async (newRoutine: DailyRoutine) => {
    if (!isAdmin) return;

    let updatedAll: DailyRoutine[];
    if (recreatingRoutine) {
      updatedAll = allRoutines.map((r) => (r.id === recreatingRoutine.id ? newRoutine : r));
      setRecreatingRoutine(null);
    } else {
      const lockedPrevious = allRoutines.map((r) => ({ ...r, isLocked: true }));
      updatedAll = [...lockedPrevious, newRoutine];
      setActiveRoutineId(newRoutine.id);
    }

    setAllRoutines(updatedAll);
    setIsGeneratorOpen(false);
    setActiveTab('matrix');

    try {
      await api.saveRoutines(updatedAll);
      await api.saveSettings({ activeRoutineId: newRoutine.id });
    } catch (err) {
      console.error('Error saving generated routine to server:', err);
    }
  };

  // Handle lock/unlock routine toggle (saved to server)
  const handleToggleLockRoutine = async (routineId: string) => {
    if (!isAdmin) return;
    const updatedAll = allRoutines.map((r) => (r.id === routineId ? { ...r, isLocked: !r.isLocked } : r));
    setAllRoutines(updatedAll);
    try {
      await api.saveRoutines(updatedAll);
    } catch (err) {
      console.error('Error toggling routine lock on server:', err);
    }
  };

  // Handle delete routine (saved to server)
  const handleDeleteRoutine = async (routineId: string) => {
    if (!isAdmin || allRoutines.length <= 1) return;
    const updatedAll = allRoutines.filter((r) => r.id !== routineId);
    setAllRoutines(updatedAll);
    if (activeRoutineId === routineId) {
      setActiveRoutineId(updatedAll[0].id);
    }
    try {
      await api.deleteRoutine(routineId);
    } catch (err) {
      console.error('Error deleting routine on server:', err);
    }
  };

  // Handle classroom updates (saved to server)
  const handleUpdateClassrooms = async (updatedClassrooms: Classroom[]) => {
    setClassrooms(updatedClassrooms);
    try {
      await api.saveClassrooms(updatedClassrooms);
    } catch (err) {
      console.error('Error saving classrooms to server:', err);
    }
  };

  // Handle building updates (saved to server)
  const handleUpdateBuildings = async (updatedBuildings: BuildingInfo[]) => {
    setBuildings(updatedBuildings);
    try {
      await api.saveBuildings(updatedBuildings);
    } catch (err) {
      console.error('Error saving buildings to server:', err);
    }
  };

  // Handle paper updates (saved to server)
  const handleUpdatePapers = async (updatedPapers: Paper[]) => {
    setPapers(updatedPapers);
    try {
      await api.savePapers(updatedPapers);
    } catch (err) {
      console.error('Error saving papers to server:', err);
    }
  };

  // Handle teacher assignments update (saved to server)
  const handleUpdateTeachers = async (updatedTeachers: Teacher[]) => {
    setTeachers(updatedTeachers);
    try {
      await api.saveTeachers(updatedTeachers);
    } catch (err) {
      console.error('Error saving teachers to server:', err);
    }
  };

  // Handle routine preparation check rules save (saved to server)
  const handleSaveRules = async (updatedRules: RoutineRuleConfig) => {
    setRules(updatedRules);
    try {
      await api.saveRules(updatedRules);
    } catch (err) {
      console.error('Error saving routine rules to server:', err);
      throw err;
    }
  };

  // Handle routine selection
  const handleSelectRoutine = (routineId: string) => {
    setActiveRoutineId(routineId);
    setActiveTab('matrix');
  };

  // Handle admin login
  const handleLoginSuccess = () => {
    setIsAdmin(true);
    sessionStorage.setItem('routine_is_admin', 'true');
    setIsAdminLoginOpen(false);
  };

  // Handle admin logout
  const handleLogout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem('routine_is_admin');
    setActiveTab('matrix');
  };

  // Handle factory reset on server
  const handleResetData = async () => {
    if (!isAdmin) return;
    try {
      setIsLoading(true);
      const store = await api.resetAllData();
      setBuildings(store.buildings || INITIAL_BUILDINGS);
      setClassrooms(store.classrooms);
      setPapers(store.papers);
      setTeachers(store.teachers);
      setAllRoutines(store.routines);
      setRules(store.rules);
      setActiveRoutineId(store.settings.activeRoutineId);
      setActiveTab('matrix');
    } catch (err) {
      console.error('Error resetting server data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    setIsPrintPreviewOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
        <div className="text-center">
          <h2 className="text-lg font-bold">STC, SAP 4th Bn</h2>
          <p className="text-xs text-slate-400 mt-1">Connecting to Server Database (`data/routine_store.json`)...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans no-print">
        {/* Top Bar Header */}
        <Header
          currentRoutine={currentRoutine}
          allRoutines={allRoutines}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onSelectRoutine={handleSelectRoutine}
          isAdmin={isAdmin}
          onOpenLogin={() => setIsAdminLoginOpen(true)}
          onLogout={handleLogout}
          onOpenGenerator={handleOpenNewRoutine}
          onRecreateRoutine={handleOpenRecreateRoutine}
          onOpenMasterData={() => setIsMasterDataOpen(true)}
          onOpenLeaveManager={() => setIsLeaveManagerOpen(true)}
          onOpenRulesModal={() => setIsRulesModalOpen(true)}
          onPrint={handlePrint}
          isCurrentEditable={isCurrentEditable}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
          {/* Verification / Conflict Alerts - Admin Only */}
          {isAdmin && currentRoutine && (
            <ConflictBanner
              routine={currentRoutine}
              conflicts={validation.conflicts}
              buildingConflicts={validation.buildingConflicts}
              absentViolations={validation.absentViolations}
              isEditable={isCurrentEditable}
              isAdmin={isAdmin}
              onOpenLeaveManager={() => setIsLeaveManagerOpen(true)}
              onPrint={handlePrint}
            />
          )}

          {/* Tab 1: Daily Routine Matrix */}
          {activeTab === 'matrix' && currentRoutine && (
            <RoutineMatrix
              routine={currentRoutine}
              classrooms={classrooms}
              papers={papers}
              teachers={teachers}
              isEditable={isCurrentEditable}
              isAdmin={isAdmin}
              onEditSlot={(slot) => {
                if (isAdmin) {
                  setEditingSlot(slot);
                } else {
                  setIsAdminLoginOpen(true);
                }
              }}
              onSwapSlots={handleSwapSlots}
              onRecreateRoutine={handleOpenRecreateRoutine}
              onOpenLeaveManager={() => setIsLeaveManagerOpen(true)}
              onRequireAdmin={() => setIsAdminLoginOpen(true)}
              onPrint={handlePrint}
            />
          )}

          {/* Tab: Instructor Deployment Tracker */}
          {activeTab === 'tracker' && (
            <TeacherDeploymentTracker
              teachers={teachers}
              papers={papers}
              classrooms={classrooms}
              allRoutines={allRoutines}
              currentRoutine={currentRoutine}
            />
          )}

          {/* Tab 2: Classroom-Wise Session Counting & Quota Progress (Admin Only) */}
          {isAdmin && activeTab === 'progress' && (
            <CumulativeStatsView
              classrooms={classrooms}
              papers={papers}
              teachers={teachers}
              historicalRoutines={allRoutines}
              currentRoutine={currentRoutine}
            />
          )}

          {/* Tab 3: Instructor Session Ledger (Admin Only) */}
          {isAdmin && activeTab === 'ledger' && (
            <InstructorLedgerView
              teachers={teachers}
              papers={papers}
              classrooms={classrooms}
              allRoutines={allRoutines}
              currentRoutine={currentRoutine}
            />
          )}

          {/* Tab 4: Instructor Duty Schedule (Admin Only) */}
          {isAdmin && activeTab === 'teachers' && currentRoutine && (
            <TeacherDutyView
              routine={currentRoutine}
              teachers={teachers}
              classrooms={classrooms}
              papers={papers}
            />
          )}

          {/* Tab 5: Instructor Mapping Section (T1 to T26) (Admin Only) */}
          {isAdmin && activeTab === 'mapping' && (
            <TeacherMappingView
              teachers={teachers}
              papers={papers}
              classrooms={classrooms}
              currentRoutine={currentRoutine}
              isAdmin={isAdmin}
              onUpdateTeachers={handleUpdateTeachers}
              onRequireAdmin={() => setIsAdminLoginOpen(true)}
            />
          )}

          {/* Tab 6: Routine History (Admin Only) */}
          {isAdmin && activeTab === 'history' && (
            <HistoryView
              allRoutines={allRoutines}
              currentRoutine={currentRoutine}
              teachers={teachers}
              papers={papers}
              onSelectRoutine={handleSelectRoutine}
              onResetData={handleResetData}
              onToggleLockRoutine={handleToggleLockRoutine}
              onDeleteRoutine={handleDeleteRoutine}
              isAdmin={isAdmin}
            />
          )}
        </main>

        {/* Admin Login Modal */}
        <AdminLoginModal
          isOpen={isAdminLoginOpen}
          onClose={() => setIsAdminLoginOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />

        {/* Emergency Leave & Instructor Manager (Admin only) */}
        {isAdmin && isLeaveManagerOpen && currentRoutine && (
          <FacultyLeaveManagerModal
            isOpen={isLeaveManagerOpen}
            onClose={() => setIsLeaveManagerOpen(false)}
            routine={currentRoutine}
            teachers={teachers}
            classrooms={classrooms}
            papers={papers}
            onUpdateRoutine={handleUpdateCurrentRoutine}
          />
        )}

        {/* Slot Correction Modal (Admin only) */}
        {isAdmin && editingSlot && currentRoutine && (
          <SlotEditModal
            slot={editingSlot}
            routine={currentRoutine}
            classrooms={classrooms}
            papers={papers}
            teachers={teachers}
            onClose={() => setEditingSlot(null)}
            onSave={handleSaveSlotCorrection}
          />
        )}

        {/* Routine Generator & Recreate Modal (Admin only) */}
        {isAdmin && (
          <RoutineGeneratorModal
            isOpen={isGeneratorOpen}
            onClose={() => {
              setIsGeneratorOpen(false);
              setRecreatingRoutine(null);
            }}
            onRoutineGenerated={handleRoutineGenerated}
            classrooms={classrooms}
            papers={papers}
            teachers={teachers}
            historicalRoutines={allRoutines}
            recreatingRoutine={recreatingRoutine}
            rules={rules}
          />
        )}

        {/* Routine Rules & Constraint Checks Modal (Admin only) */}
        {isAdmin && (
          <RoutineRulesModal
            isOpen={isRulesModalOpen}
            onClose={() => setIsRulesModalOpen(false)}
            rules={rules}
            onSaveRules={handleSaveRules}
          />
        )}

        {/* Master Data Setup Modal */}
        <MasterDataModal
          isOpen={isMasterDataOpen}
          onClose={() => setIsMasterDataOpen(false)}
          buildings={buildings}
          classrooms={classrooms}
          papers={papers}
          teachers={teachers}
          isAdmin={isAdmin}
          onUpdateBuildings={handleUpdateBuildings}
          onUpdateClassrooms={handleUpdateClassrooms}
          onUpdatePapers={handleUpdatePapers}
          onUpdateTeachers={handleUpdateTeachers}
          onOpenTeacherMapping={() => {
            setIsMasterDataOpen(false);
            setActiveTab('mapping');
          }}
        />

        {/* Clean Footer */}
        <footer className="border-t border-slate-200 bg-white py-4 mt-8 no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              <span>
                STC, SAP 4th Bn · {classrooms.length} Classrooms · {teachers.length} Instructors · {papers.length} Subject Papers · 40 min / Period
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="flex items-center gap-1.5 text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 font-medium">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>Developer & Maintainer: <strong className="text-slate-900 font-bold">Abdul Barique Ansari</strong></span>
              </span>
              <span className="flex items-center gap-1 text-blue-700 font-medium">
                <Database className="w-3.5 h-3.5" />
                <span>Server Storage Active</span>
              </span>
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Clean Schedule</span>
              </span>
            </div>
          </div>
        </footer>
      </div>

      {/* Modal Print Preview */}
      {isPrintPreviewOpen && currentRoutine && (
        <PrintableRoutine
          routine={currentRoutine}
          classrooms={classrooms}
          papers={papers}
          teachers={teachers}
          language="en"
          isModalPreview={true}
          printLayoutMode={printLayoutMode}
          onChangePrintLayoutMode={setPrintLayoutMode}
          onClosePreview={() => setIsPrintPreviewOpen(false)}
        />
      )}

      {/* Standalone Printable Sheet */}
      {currentRoutine && (
        <PrintableRoutine
          routine={currentRoutine}
          classrooms={classrooms}
          papers={papers}
          teachers={teachers}
          language="en"
          isModalPreview={false}
          printLayoutMode={printLayoutMode}
        />
      )}
    </>
  );
}
