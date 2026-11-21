/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AppSettings, BuildingInfo, Classroom, ClassSlot, compareClassrooms, compareTeacherCodes, DailyRoutine, Paper, PracticalSubject, RoutineRuleConfig, Teacher } from './types';
import { api } from './utils/api';
import { APP_DEVELOPER_MAINTAINER, DEFAULT_APP_SETTINGS, DEFAULT_ROUTINE_RULES, INITIAL_BUILDINGS, INITIAL_PRACTICAL_SUBJECTS } from './data/initialData';
import { isRoutineEditable, validateRoutine } from './utils/routineValidator';
import { Header } from './components/Header';
import { ConflictBanner } from './components/ConflictBanner';
import { RoutineMatrix } from './components/RoutineMatrix';
import { CumulativeStatsView } from './components/CumulativeStatsView';
import { InstructorLedgerView } from './components/InstructorLedgerView';
import { TeacherDutyView } from './components/TeacherDutyView';
import { TeacherMappingView } from './components/TeacherMappingView';
import { TeacherDeploymentTracker } from './components/TeacherDeploymentTracker';
import { InstructorUnavailabilityView } from './components/InstructorUnavailabilityView';
import { HistoryView } from './components/HistoryView';
import { SlotEditModal } from './components/SlotEditModal';
import { RoutineGeneratorModal } from './components/RoutineGeneratorModal';
import { RoutineRulesModal } from './components/RoutineRulesModal';
import { MasterDataModal } from './components/MasterDataModal';
import { PageSetupModal } from './components/PageSetupModal';
import { DownloadsModal } from './components/DownloadsModal';
import { PrintableRoutine } from './components/PrintableRoutine';
import { AdminLoginModal } from './components/AdminLoginModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { UnavailableRegisterModal } from './components/UnavailableRegisterModal';
import { modularLocalStorage } from './utils/storage';
import { useToast } from './context/ToastContext';
import { Clock, Database, Loader2, Shield, ShieldCheck, User } from 'lucide-react';

function syncPapersWithTeachers(currentPapers: Paper[], currentTeachers: Teacher[]): Paper[] {
  return currentPapers.map((p) => {
    const matchingTeachers = currentTeachers.filter((t) => {
      if (!t.primaryPaperIds || t.primaryPaperIds.length === 0) return false;
      return t.primaryPaperIds.some((pid) => {
        if (!pid) return false;
        const cleanPid = pid.trim().toLowerCase();
        const pId = p.id.trim().toLowerCase();
        const pCode = p.code.trim().toLowerCase();
        const pTitle = p.title.trim().toLowerCase();
        return (
          cleanPid === pId ||
          cleanPid === pCode ||
          cleanPid === pTitle ||
          pCode.replace(/[^a-z0-9]/g, '') === cleanPid.replace(/[^a-z0-9]/g, '') ||
          (cleanPid.length > 3 && pTitle.includes(cleanPid))
        );
      });
    });

    if (matchingTeachers.length > 0) {
      return {
        ...p,
        primaryTeacherIds: matchingTeachers.map((t) => t.id),
      };
    }
    return p;
  });
}

export default function App() {
  const { showToast } = useToast();
  const [buildings, setBuildings] = useState<BuildingInfo[]>(INITIAL_BUILDINGS);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allRoutines, setAllRoutines] = useState<DailyRoutine[]>([]);
  const [rules, setRules] = useState<RoutineRuleConfig>(DEFAULT_ROUTINE_RULES);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
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
  const [isPageSetupOpen, setIsPageSetupOpen] = useState(false);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isLeaveManagerOpen, setIsLeaveManagerOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [printLayoutMode, setPrintLayoutMode] = useState<'1-page' | '2-page'>('1-page');
  const [editingSlot, setEditingSlot] = useState<ClassSlot | null>(null);

  // Initialize data on mount from Server Storage (with modular LocalStorage fallback)
  useEffect(() => {
    async function loadDataFromServer() {
      try {
        setIsLoading(true);
        const data = await api.loadAllData();
        const loadedTeachers = (data.teachers || []).sort(compareTeacherCodes);
        const loadedPapers = syncPapersWithTeachers(data.papers || [], loadedTeachers);
        setBuildings(data.buildings || INITIAL_BUILDINGS);
        setClassrooms((data.classrooms || []).sort(compareClassrooms));
        setPapers(loadedPapers);
        setTeachers(loadedTeachers);
        setAllRoutines(data.routines || []);
        setRules(data.rules || DEFAULT_ROUTINE_RULES);
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
        setActiveRoutineId(data.settings?.activeRoutineId || data.routines?.[data.routines.length - 1]?.id || '');
        // Sync into separated discrete localStorage keys
        modularLocalStorage.syncFromServer({ ...data, papers: loadedPapers, teachers: loadedTeachers });
      } catch (err) {
        console.error('Failed to load data from server backend, trying modular localStorage:', err);
        const localData = modularLocalStorage.loadFromLocal();
        if (localData) {
          const loadedTeachers = (localData.teachers || []).sort(compareTeacherCodes);
          const loadedPapers = syncPapersWithTeachers(localData.papers || [], loadedTeachers);
          setBuildings(localData.buildings || INITIAL_BUILDINGS);
          setClassrooms((localData.classrooms || []).sort(compareClassrooms));
          setPapers(loadedPapers);
          setTeachers(loadedTeachers);
          setAllRoutines(localData.routines || []);
          setRules(localData.rules || DEFAULT_ROUTINE_RULES);
          if (localData.settings) {
            setSettings((prev) => ({ ...prev, ...localData.settings }));
          }
          setActiveRoutineId(localData.settings?.activeRoutineId || localData.routines?.[localData.routines.length - 1]?.id || '');
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadDataFromServer();
  }, []);

  // USER RULE: Routines in editable/unlocked mode are strictly hidden from public users.
  // Only locked / published routines are visible to regular users.
  // Administrators can see all routines (both locked and editable drafts).
  const visibleRoutines = useMemo(() => {
    return isAdmin ? allRoutines : allRoutines.filter((r) => r.isLocked);
  }, [isAdmin, allRoutines]);

  const currentRoutine = useMemo(() => {
    if (visibleRoutines.length === 0) return null;
    const found = visibleRoutines.find((r) => r.id === activeRoutineId);
    return found || visibleRoutines[visibleRoutines.length - 1] || null;
  }, [visibleRoutines, activeRoutineId]);

  // Selected routine is in editable mode ONLY if Admin is logged in and routine is unlocked (!currentRoutine.isLocked)
  const isCurrentEditable = Boolean(isAdmin && currentRoutine && !currentRoutine.isLocked);

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
      showToast({
        title: 'Slot Correction Saved',
        caption: `Period ${updatedSlot.period} in ${updatedSlot.roomId} committed to SQL database`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error saving slot correction to server:', err);
      showToast({
        title: 'Error Saving Slot',
        caption: err.message || 'Failed to commit slot to SQL database',
        type: 'error',
      });
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
      showToast({
        title: 'Slots Swapped Successfully',
        caption: 'Slot interchange committed to SQL database without page refresh',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error saving swapped slots to server:', err);
      showToast({
        title: 'Error Swapping Slots',
        caption: err.message || 'Failed to update SQL database',
        type: 'error',
      });
    }
  };

  // Sync database directly from JSON storage files
  const handleSyncFromJson = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const data = await api.syncFromJson();
      const loadedTeachers = (data.teachers || []).sort(compareTeacherCodes);
      const loadedPapers = syncPapersWithTeachers(data.papers || [], loadedTeachers);
      setBuildings(data.buildings || INITIAL_BUILDINGS);
      setClassrooms((data.classrooms || []).sort(compareClassrooms));
      setPapers(loadedPapers);
      setTeachers(loadedTeachers);
      setAllRoutines(data.routines || []);
      setRules(data.rules || DEFAULT_ROUTINE_RULES);
      if (data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
      modularLocalStorage.syncFromServer({ ...data, papers: loadedPapers, teachers: loadedTeachers });
      showToast({
        title: 'Database Synced from JSON',
        caption: 'Storage JSON files reloaded and committed to SQL database successfully',
        type: 'success',
      });
      return true;
    } catch (err: any) {
      console.error('Failed to sync from JSON:', err);
      showToast({
        title: 'Sync Error',
        caption: err.message || 'Could not sync from JSON files',
        type: 'error',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle emergency leave or substitute routine update (saved to server)
  const handleUpdateCurrentRoutine = async (updatedRoutine: DailyRoutine) => {
    if (!isAdmin) return;
    const updatedAll = allRoutines.map((r) => (r.id === updatedRoutine.id ? updatedRoutine : r));
    setAllRoutines(updatedAll);
    try {
      await api.saveRoutines(updatedAll);
      showToast({
        title: 'Routine Updated',
        caption: `Day ${updatedRoutine.dayNumber} changes successfully saved to SQL database`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error updating routine on server:', err);
      showToast({
        title: 'Failed to Update Routine',
        caption: err.message || 'Error updating SQL database',
        type: 'error',
      });
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

  // Handle routine generated (saved to server & modular localStorage)
  const handleRoutineGenerated = async (newRoutineOrRoutines: DailyRoutine | DailyRoutine[]) => {
    if (!isAdmin) return;
    const batchList = Array.isArray(newRoutineOrRoutines) ? newRoutineOrRoutines : [newRoutineOrRoutines];
    if (batchList.length === 0) return;

    let updatedAll: DailyRoutine[];
    if (recreatingRoutine && batchList.length === 1) {
      updatedAll = allRoutines.map((r) => (r.id === recreatingRoutine.id ? batchList[0] : r));
      setRecreatingRoutine(null);
    } else {
      const lockedPrevious = allRoutines.map((r) => ({ ...r, isLocked: true }));
      // In batch, lock earlier days and keep latest day active/editable
      const batchWithLock = batchList.map((r, idx) => ({
        ...r,
        isLocked: idx < batchList.length - 1 ? true : false,
      }));
      updatedAll = [...lockedPrevious, ...batchWithLock];
      const latest = batchWithLock[batchWithLock.length - 1];
      setActiveRoutineId(latest.id);
    }

    setAllRoutines(updatedAll);
    setIsGeneratorOpen(false);
    setActiveTab('matrix');

    modularLocalStorage.saveRoutines(updatedAll);

    try {
      await api.saveRoutines(updatedAll);
      const latestId = batchList[batchList.length - 1].id;
      await api.saveSettings({ activeRoutineId: latestId });
      showToast({
        title: batchList.length > 1 ? `${batchList.length} Routines Generated & Saved` : 'New Routine Generated & Saved',
        caption: 'Committed to SQL Database (data/routine_scheduler.sql & SQLite DB)',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error saving generated routine to server:', err);
      showToast({
        title: 'Failed to Save Routine',
        caption: err.message || 'Error writing to SQL database',
        type: 'error',
      });
    }
  };

  // Handle lock/unlock routine toggle (saved to server and modular storage)
  const handleToggleLockRoutine = async (routineId: string) => {
    if (!isAdmin) return;
    const target = allRoutines.find((r) => r.id === routineId);
    const nextLockState = target ? !target.isLocked : false;
    const updatedAll = allRoutines.map((r) =>
      r.id === routineId
        ? { ...r, isLocked: !r.isLocked, updatedAt: new Date().toISOString() }
        : r
    );
    setAllRoutines(updatedAll);
    modularLocalStorage.saveRoutines(updatedAll);
    try {
      await api.saveRoutines(updatedAll);
      showToast({
        title: nextLockState ? 'Routine Published & Locked' : 'Routine Unlocked for Editing',
        caption: `Day ${target?.dayNumber || ''} status updated in SQL database`,
        type: 'info',
      });
    } catch (err: any) {
      console.error('Error toggling routine lock on server:', err);
      showToast({
        title: 'Error Updating Routine Status',
        caption: err.message || 'Failed to update SQL database',
        type: 'error',
      });
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
      showToast({
        title: 'Routine Deleted',
        caption: 'Routine record successfully removed from SQL database',
        type: 'info',
      });
    } catch (err: any) {
      console.error('Error deleting routine on server:', err);
      showToast({
        title: 'Error Deleting Routine',
        caption: err.message || 'Failed to delete from SQL database',
        type: 'error',
      });
    }
  };

  // Handle classroom updates (saved to server)
  const handleUpdateClassrooms = async (updatedClassrooms: Classroom[]) => {
    setClassrooms(updatedClassrooms);
    try {
      await api.saveClassrooms(updatedClassrooms);
      showToast({
        title: 'Classrooms Saved',
        caption: `${updatedClassrooms.length} classrooms updated in SQL database (data/routine_scheduler.sql)`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error saving classrooms to server:', err);
      showToast({
        title: 'Error Saving Classrooms',
        caption: err.message || 'Failed to save to SQL database',
        type: 'error',
      });
    }
  };

  // Handle building updates (saved to server)
  const handleUpdateBuildings = async (updatedBuildings: BuildingInfo[]) => {
    setBuildings(updatedBuildings);
    try {
      await api.saveBuildings(updatedBuildings);
      showToast({
        title: 'Buildings Saved',
        caption: `${updatedBuildings.length} buildings updated in SQL database (data/routine_scheduler.sql)`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error saving buildings to server:', err);
      showToast({
        title: 'Error Saving Buildings',
        caption: err.message || 'Failed to save to SQL database',
        type: 'error',
      });
    }
  };

  // Handle paper updates (saved to server)
  const handleUpdatePapers = async (updatedPapers: Paper[]) => {
    const syncedPapers = syncPapersWithTeachers(updatedPapers, teachers);
    setPapers(syncedPapers);
    try {
      await api.savePapers(syncedPapers);
      showToast({
        title: 'Subjects / Papers Saved',
        caption: `${syncedPapers.length} curriculum subjects updated in SQL database (data/routine_scheduler.sql)`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error saving papers to server:', err);
      showToast({
        title: 'Error Saving Papers',
        caption: err.message || 'Failed to save to SQL database',
        type: 'error',
      });
    }
  };

  // Handle teacher assignments update (saved to server)
  const handleUpdateTeachers = async (updatedTeachers: Teacher[]) => {
    const sorted = [...updatedTeachers].sort(compareTeacherCodes);
    setTeachers(sorted);
    const updatedPapers = syncPapersWithTeachers(papers, sorted);
    setPapers(updatedPapers);
    try {
      await api.saveTeachers(sorted);
      await api.savePapers(updatedPapers);
      showToast({
        title: 'Instructors Saved',
        caption: `${updatedTeachers.length} instructors and subject linkages updated in SQL database`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error saving teachers to server:', err);
      showToast({
        title: 'Error Saving Instructors',
        caption: err.message || 'Failed to save to SQL database',
        type: 'error',
      });
    }
  };

  // Handle routine preparation check rules save (saved to server)
  const handleSaveRules = async (updatedRules: RoutineRuleConfig) => {
    setRules(updatedRules);
    try {
      await api.saveRules(updatedRules);
      showToast({
        title: 'Routine Rules Saved',
        caption: 'Algorithmic scheduling constraints updated in SQL database (data/routine_scheduler.sql)',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error saving routine rules to server:', err);
      showToast({
        title: 'Error Saving Rules',
        caption: err.message || 'Failed to save to SQL database',
        type: 'error',
      });
      throw err;
    }
  };

  // Handle application page setup / presentation settings save (saved to server & local)
  const handleSaveSettings = async (updated: Partial<AppSettings>) => {
    const merged: AppSettings = { ...settings, ...updated };
    setSettings(merged);
    modularLocalStorage.saveSettings(merged);
    try {
      await api.saveSettings(merged);
      showToast({
        title: 'Settings Saved Successfully',
        caption: 'Institutional presentation & page setup saved to SQL database (data/routine_scheduler.sql)',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error saving page setup settings to server:', err);
      showToast({
        title: 'Failed to Save Settings',
        caption: err.message || 'Error saving to SQL database',
        type: 'error',
      });
      throw err;
    }
  };

  const handleUpdatePracticalSubjects = async (practicalSubjects: PracticalSubject[]) => {
    await handleSaveSettings({ practicalSubjects });
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
      setClassrooms((store.classrooms || []).sort(compareClassrooms));
      setPapers(store.papers);
      setTeachers((store.teachers || []).sort(compareTeacherCodes));
      setAllRoutines(store.routines);
      setRules(store.rules);
      if (store.settings) {
        setSettings(store.settings);
      }
      setActiveRoutineId(store.settings.activeRoutineId);
      setActiveTab('matrix');
      showToast({
        title: 'Database Reset to Defaults',
        caption: 'SQL database successfully re-seeded with initial clean records (data/routine_scheduler.sql)',
        type: 'info',
      });
    } catch (err: any) {
      console.error('Error resetting server data:', err);
      showToast({
        title: 'Error Resetting Database',
        caption: err.message || 'Failed to reset SQL database',
        type: 'error',
      });
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
          <p className="text-xs text-slate-400 mt-1">Connecting to SQL Database (`data/routine_scheduler.sql` & SQLite)...</p>
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
          allRoutines={visibleRoutines}
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
          onOpenPageSetup={() => setIsPageSetupOpen(true)}
          onOpenDownloads={() => setIsDownloadsOpen(true)}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          onPrint={handlePrint}
          isCurrentEditable={isCurrentEditable}
          onToggleLockRoutine={handleToggleLockRoutine}
          institutionName={settings.institutionName}
          tagline={settings.tagline}
        />

        {/* Main Content Area (Full wide browser coverage at 100% zoom with compact padding) */}
        <main className="flex-1 w-full max-w-[1920px] mx-auto px-2.5 sm:px-4 2xl:px-6 py-2.5 sm:py-3.5 no-print">
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

          {/* Empty State: If no locked / published routine exists for viewing */}
          {!currentRoutine && activeTab === 'matrix' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center max-w-lg mx-auto shadow-xs my-8">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No Published Routine Available</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                The indoor class routine is currently in draft / editable mode and being finalized by the Administrator. Only finalized and locked routines are published for public view.
              </p>
              {!isAdmin && (
                <button
                  onClick={() => setIsAdminLoginOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Admin Login</span>
                </button>
              )}
            </div>
          )}

          {/* Tab 1: Daily Routine Matrix */}
          {activeTab === 'matrix' && currentRoutine && (
            <RoutineMatrix
              routine={currentRoutine}
              classrooms={classrooms}
              papers={papers}
              teachers={teachers}
              buildings={buildings}
              allRoutines={allRoutines}
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
              onToggleLockRoutine={handleToggleLockRoutine}
              onUpdateNotes={async (newNotes) => {
                if (!currentRoutine) return;
                const updated: DailyRoutine = {
                  ...currentRoutine,
                  notes: newNotes,
                  updatedAt: new Date().toISOString(),
                };
                await handleUpdateCurrentRoutine(updated);
              }}
            />
          )}

          {/* Tab: Instructor Deployment Tracker */}
          {activeTab === 'tracker' && (
            <TeacherDeploymentTracker
              teachers={teachers}
              papers={papers}
              classrooms={classrooms}
              allRoutines={visibleRoutines}
              currentRoutine={currentRoutine}
            />
          )}

          {/* Tab 1B: Instructor Unavailability & Leave Ledger */}
          {activeTab === 'unavailability' && (
            <InstructorUnavailabilityView
              teachers={teachers}
              allRoutines={visibleRoutines}
              currentRoutine={currentRoutine}
              papers={papers}
              classrooms={classrooms}
              isAdmin={isAdmin}
              onOpenLeaveManager={() => setIsLeaveManagerOpen(true)}
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
              buildings={buildings}
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
          adminPassword={settings.adminPassword || 'admin123'}
        />

        {/* Faculty Unavailability Register (Admin only) */}
        {currentRoutine && (
          <UnavailableRegisterModal
            isOpen={Boolean(isAdmin && isLeaveManagerOpen)}
            onClose={() => setIsLeaveManagerOpen(false)}
            routine={currentRoutine}
            teachers={teachers}
            classrooms={classrooms}
            papers={papers}
            onUpdateRoutine={handleUpdateCurrentRoutine}
          />
        )}

        {/* Slot Correction Modal (Admin only) */}
        {currentRoutine && (
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
        <RoutineGeneratorModal
          isOpen={Boolean(isAdmin && isGeneratorOpen)}
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
          practicalSubjects={settings.practicalSubjects || INITIAL_PRACTICAL_SUBJECTS}
        />

        {/* Routine Rules & Constraint Checks Modal (Admin only) */}
        <RoutineRulesModal
          isOpen={Boolean(isAdmin && isRulesModalOpen)}
          onClose={() => setIsRulesModalOpen(false)}
          rules={rules}
          onSaveRules={handleSaveRules}
        />

        {/* Master Data Setup Modal */}
        <MasterDataModal
          isOpen={isMasterDataOpen}
          onClose={() => setIsMasterDataOpen(false)}
          buildings={buildings}
          classrooms={classrooms}
          papers={papers}
          teachers={teachers}
          practicalSubjects={settings.practicalSubjects || INITIAL_PRACTICAL_SUBJECTS}
          historicalRoutines={allRoutines}
          currentRoutine={currentRoutine}
          isAdmin={isAdmin}
          onUpdateBuildings={handleUpdateBuildings}
          onUpdateClassrooms={handleUpdateClassrooms}
          onUpdatePapers={handleUpdatePapers}
          onUpdateTeachers={handleUpdateTeachers}
          onUpdatePracticalSubjects={handleUpdatePracticalSubjects}
          onSyncFromJson={handleSyncFromJson}
          onOpenTeacherMapping={() => {
            setIsMasterDataOpen(false);
            setActiveTab('mapping');
          }}
        />

        {/* Page Setup Modal (Admin only) */}
        <PageSetupModal
          isOpen={Boolean(isAdmin && isPageSetupOpen)}
          onClose={() => setIsPageSetupOpen(false)}
          settings={settings}
          onSaveSettings={handleSaveSettings}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        />

        {/* Change Admin Password Modal (Admin only) */}
        <ChangePasswordModal
          isOpen={Boolean(isAdmin && isChangePasswordOpen)}
          onClose={() => setIsChangePasswordOpen(false)}
          currentAdminPassword={settings.adminPassword || 'admin123'}
          onSavePassword={async (newPassword) => {
            await handleSaveSettings({ adminPassword: newPassword });
          }}
        />

        {/* Downloads & Reports Export Hub (Admin only) */}
        <DownloadsModal
          isOpen={Boolean(isAdmin && isDownloadsOpen)}
          onClose={() => setIsDownloadsOpen(false)}
          teachers={teachers}
          papers={papers}
          classrooms={classrooms}
          allRoutines={allRoutines}
          currentRoutine={currentRoutine}
          settings={settings}
        />

        {/* Clean Footer */}
        <footer className="border-t border-slate-200 bg-white py-4 mt-8 no-print">
          <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6 2xl:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              <span>
                {settings.institutionName || 'STC, SAP 4th Bn'} · {classrooms.length} Classrooms · {teachers.length} Instructors · {papers.length} Subject Papers · 40 min / Period
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="flex items-center gap-1.5 text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 font-medium">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>Developer & Maintainer: <strong className="text-slate-900 font-bold">{APP_DEVELOPER_MAINTAINER}</strong></span>
              </span>
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>SQL Database Active (data/routine_scheduler.sql)</span>
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
      {currentRoutine && (
        <PrintableRoutine
          routine={currentRoutine}
          classrooms={classrooms}
          papers={papers}
          teachers={teachers}
          allRoutines={allRoutines}
          settings={settings}
          language="en"
          isModalPreview={isPrintPreviewOpen}
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
          allRoutines={allRoutines}
          settings={settings}
          language="en"
          isModalPreview={false}
          printLayoutMode={printLayoutMode}
        />
      )}
    </>
  );
}
