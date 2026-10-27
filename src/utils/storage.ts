/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BuildingInfo,
  Classroom,
  DailyRoutine,
  Paper,
  RoutineRuleConfig,
  Teacher,
  UnavailableInstructor,
} from '../types';
import { api, FullServerData, AppSettings } from './api';

/**
 * Modular localStorage keys for separated discrete storage
 */
export const LOCAL_STORAGE_KEYS = {
  TEACHERS: 'smart_routine_teachers',
  PAPERS: 'smart_routine_papers',
  CLASSROOMS: 'smart_routine_classrooms',
  BUILDINGS: 'smart_routine_buildings',
  ROUTINES_INDEX: 'smart_routine_routines_index',
  ROUTINE_PREFIX: 'smart_routine_routine_',
  RULES: 'smart_routine_rules',
  SETTINGS: 'smart_routine_settings',
  UNAVAILABILITY: 'smart_routine_unavailability',
} as const;

export interface ClientRoutineIndexEntry {
  id: string;
  dayNumber: number;
  date: string;
  storageKey: string;
  status: 'draft' | 'published';
  isLocked: boolean;
  totalSlots: number;
  notes?: string;
  updatedAt: string;
}

function getItemSafely<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[LocalStorage] Error reading key "${key}":`, err);
  }
  return fallback;
}

function setItemSafely(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[LocalStorage] Error writing key "${key}":`, err);
  }
}

/**
 * Modular LocalStorage Manager for discrete entities
 */
export const modularLocalStorage = {
  // 1. Teachers / Instructors
  getTeachers(): Teacher[] | null {
    return getItemSafely<Teacher[] | null>(LOCAL_STORAGE_KEYS.TEACHERS, null);
  },
  saveTeachers(teachers: Teacher[]): void {
    setItemSafely(LOCAL_STORAGE_KEYS.TEACHERS, teachers);
  },

  // 2. Subjects / Papers
  getPapers(): Paper[] | null {
    return getItemSafely<Paper[] | null>(LOCAL_STORAGE_KEYS.PAPERS, null);
  },
  savePapers(papers: Paper[]): void {
    setItemSafely(LOCAL_STORAGE_KEYS.PAPERS, papers);
  },

  // 3. Classrooms & Rooms
  getClassrooms(): Classroom[] | null {
    return getItemSafely<Classroom[] | null>(LOCAL_STORAGE_KEYS.CLASSROOMS, null);
  },
  saveClassrooms(classrooms: Classroom[]): void {
    setItemSafely(LOCAL_STORAGE_KEYS.CLASSROOMS, classrooms);
  },

  // 4. Buildings
  getBuildings(): BuildingInfo[] | null {
    return getItemSafely<BuildingInfo[] | null>(LOCAL_STORAGE_KEYS.BUILDINGS, null);
  },
  saveBuildings(buildings: BuildingInfo[]): void {
    setItemSafely(LOCAL_STORAGE_KEYS.BUILDINGS, buildings);
  },

  // 5. Routines with Linked Index
  getRoutinesIndex(): ClientRoutineIndexEntry[] {
    return getItemSafely<ClientRoutineIndexEntry[]>(LOCAL_STORAGE_KEYS.ROUTINES_INDEX, []);
  },

  getRoutineById(id: string): DailyRoutine | null {
    const key = `${LOCAL_STORAGE_KEYS.ROUTINE_PREFIX}${id}`;
    return getItemSafely<DailyRoutine | null>(key, null);
  },

  getAllRoutines(): DailyRoutine[] | null {
    const index = this.getRoutinesIndex();
    if (!index || index.length === 0) return null;
    const routines: DailyRoutine[] = [];
    for (const item of index) {
      const routine = getItemSafely<DailyRoutine | null>(item.storageKey, null);
      if (routine) routines.push(routine);
    }
    return routines.length > 0 ? routines : null;
  },

  saveRoutine(routine: DailyRoutine): void {
    const key = `${LOCAL_STORAGE_KEYS.ROUTINE_PREFIX}${routine.id}`;
    setItemSafely(key, routine);

    // Update index linkage
    const index = this.getRoutinesIndex();
    const existingIdx = index.findIndex((i) => i.id === routine.id);
    const entry: ClientRoutineIndexEntry = {
      id: routine.id,
      dayNumber: routine.dayNumber,
      date: routine.date,
      storageKey: key,
      status: routine.status || 'published',
      isLocked: routine.isLocked,
      totalSlots: routine.slots ? routine.slots.length : 0,
      notes: routine.notes,
      updatedAt: routine.updatedAt || new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      index[existingIdx] = entry;
    } else {
      index.push(entry);
    }
    setItemSafely(LOCAL_STORAGE_KEYS.ROUTINES_INDEX, index);
  },

  saveRoutines(routines: DailyRoutine[]): void {
    const index: ClientRoutineIndexEntry[] = [];
    for (const routine of routines) {
      const key = `${LOCAL_STORAGE_KEYS.ROUTINE_PREFIX}${routine.id}`;
      setItemSafely(key, routine);
      index.push({
        id: routine.id,
        dayNumber: routine.dayNumber,
        date: routine.date,
        storageKey: key,
        status: routine.status || 'published',
        isLocked: routine.isLocked,
        totalSlots: routine.slots ? routine.slots.length : 0,
        notes: routine.notes,
        updatedAt: routine.updatedAt || new Date().toISOString(),
      });
    }
    setItemSafely(LOCAL_STORAGE_KEYS.ROUTINES_INDEX, index);
  },

  deleteRoutine(id: string): void {
    const key = `${LOCAL_STORAGE_KEYS.ROUTINE_PREFIX}${id}`;
    try {
      localStorage.removeItem(key);
    } catch {}

    const index = this.getRoutinesIndex().filter((i) => i.id !== id);
    setItemSafely(LOCAL_STORAGE_KEYS.ROUTINES_INDEX, index);
  },

  // 6. Rules
  getRules(): RoutineRuleConfig | null {
    return getItemSafely<RoutineRuleConfig | null>(LOCAL_STORAGE_KEYS.RULES, null);
  },
  saveRules(rules: RoutineRuleConfig): void {
    setItemSafely(LOCAL_STORAGE_KEYS.RULES, rules);
  },

  // 7. Settings
  getSettings(): AppSettings | null {
    return getItemSafely<AppSettings | null>(LOCAL_STORAGE_KEYS.SETTINGS, null);
  },
  saveSettings(settings: AppSettings): void {
    setItemSafely(LOCAL_STORAGE_KEYS.SETTINGS, settings);
  },

  // 8. Unavailability Register
  getUnavailability(): UnavailableInstructor[] | null {
    return getItemSafely<UnavailableInstructor[] | null>(LOCAL_STORAGE_KEYS.UNAVAILABILITY, null);
  },
  saveUnavailability(unavailability: UnavailableInstructor[]): void {
    setItemSafely(LOCAL_STORAGE_KEYS.UNAVAILABILITY, unavailability);
  },

  /**
   * Sync complete full server store into discrete separate localStorage keys
   */
  syncFromServer(data: FullServerData): void {
    if (data.teachers) this.saveTeachers(data.teachers);
    if (data.papers) this.savePapers(data.papers);
    if (data.classrooms) this.saveClassrooms(data.classrooms);
    if (data.buildings) this.saveBuildings(data.buildings);
    if (data.routines) this.saveRoutines(data.routines);
    if (data.rules) this.saveRules(data.rules);
    if (data.settings) this.saveSettings(data.settings);
    if (data.unavailability) this.saveUnavailability(data.unavailability);
  },

  /**
   * Rebuild full store from separate discrete localStorage keys
   */
  loadFromLocal(): FullServerData | null {
    const teachers = this.getTeachers();
    const papers = this.getPapers();
    const classrooms = this.getClassrooms();
    const buildings = this.getBuildings();
    const routines = this.getAllRoutines();
    const rules = this.getRules();
    const settings = this.getSettings();

    if (!teachers || !papers || !classrooms || !routines) {
      return null;
    }

    return {
      teachers,
      papers,
      classrooms,
      buildings: buildings || [],
      routines,
      rules: rules || ({} as any),
      settings: settings || { institutionName: 'STC, SAP 4th Bn', activeRoutineId: '' },
      unavailability: this.getUnavailability() || [],
    };
  },
};

export { api };
export type { AppSettings };
