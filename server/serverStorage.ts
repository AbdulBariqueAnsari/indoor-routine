/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import {
  BuildingInfo,
  Classroom,
  DailyRoutine,
  Paper,
  RoutineRuleConfig,
  Teacher,
} from '../src/types/index.ts';
import {
  DEFAULT_ROUTINE_RULES,
  INITIAL_BUILDINGS,
  INITIAL_CLASSROOMS,
  INITIAL_PAPERS,
  INITIAL_TEACHERS,
} from '../src/data/initialData.ts';
import { generateDailyRoutine } from '../src/utils/scheduler.ts';

export interface ServerSettings {
  institutionName: string;
  activeRoutineId: string;
  language: string;
}

export interface ServerStore {
  buildings: BuildingInfo[];
  classrooms: Classroom[];
  papers: Paper[];
  teachers: Teacher[];
  routines: DailyRoutine[];
  rules: RoutineRuleConfig;
  settings: ServerSettings;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'routine_store.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function createDefaultStore(): ServerStore {
  const classrooms: Classroom[] = [...INITIAL_CLASSROOMS];
  const papers: Paper[] = [...INITIAL_PAPERS];
  const buildings: BuildingInfo[] = [...INITIAL_BUILDINGS];
  const rules: RoutineRuleConfig = { ...DEFAULT_ROUTINE_RULES };

  // Ensure all teachers have code 'T1'..'T26' and assignedBuilding: 'FLOATING'
  const teachers: Teacher[] = INITIAL_TEACHERS.map((t, idx) => {
    const code = `T${idx + 1}`;
    const backupPaperIds =
      t.backupPaperIds && t.backupPaperIds.length > 0
        ? t.backupPaperIds
        : t.secondaryPaperIds && t.secondaryPaperIds.length > 0
        ? t.secondaryPaperIds
        : [];

    return {
      ...t,
      id: t.id ? t.id.replace(/^T0*/, 'T') : code,
      code: t.code && t.code.startsWith('T') && !t.code.startsWith('TCH') ? t.code.replace(/^T0*/, 'T') : code,
      assignedBuilding: 'FLOATING',
      backupPaperIds,
      secondaryPaperIds: backupPaperIds,
    };
  });

  // Seed Day 1, Day 2, Day 3
  const day1 = generateDailyRoutine({
    classrooms,
    papers,
    teachers,
    absentTeacherIds: ['T8'], // SI Narendra Verma on leave
    priorityPaperIds: ['P01', 'P02'], // BNSS & BNS priority
    rules,
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-22',
    notes: 'Training Day 1: Foundational BNSS & BNS Criminal Law Modules',
  });
  day1.isLocked = true;

  const day2 = generateDailyRoutine({
    classrooms,
    papers,
    teachers,
    absentTeacherIds: ['T15', 'T22'], // Ankit & Kavita on leave
    priorityPaperIds: ['P05', 'P06'], // Forensics & Cyber Investigation
    rules,
    historicalRoutines: [day1],
    targetDayNumber: 2,
    targetDate: '2026-10-23',
    notes: 'Training Day 2: Forensics & Cyber Crime Investigation Modules',
  });
  day2.isLocked = true;

  const day3 = generateDailyRoutine({
    classrooms,
    papers,
    teachers,
    absentTeacherIds: ['T3'], // Meenakshi Singh on leave
    priorityPaperIds: ['P11', 'P13'], // Public Order & Practical Hands-on
    rules,
    historicalRoutines: [day1, day2],
    targetDayNumber: 3,
    targetDate: '2026-10-24',
    notes: 'Training Day 3 (Current Active Routine): Practical Hands-on & Public Order',
  });
  day3.isLocked = false; // Current routine editable

  const routines = [day1, day2, day3];
  const settings: ServerSettings = {
    institutionName: 'STC, SAP 4th Bn',
    activeRoutineId: day3.id,
    language: 'en',
  };

  return {
    buildings,
    classrooms,
    papers,
    teachers,
    routines,
    rules,
    settings,
  };
}

let inMemoryCache: ServerStore | null = null;

function readStoreFromDisk(): ServerStore {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const defaultStore = createDefaultStore();
    writeStoreToDisk(defaultStore);
    inMemoryCache = defaultStore;
    return defaultStore;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    // Merge defaults if fields missing
    if (!parsed.buildings) parsed.buildings = [...INITIAL_BUILDINGS];
    parsed.rules = { ...DEFAULT_ROUTINE_RULES, ...(parsed.rules || {}) };
    if (!parsed.settings) {
      parsed.settings = {
        institutionName: 'STC, SAP 4th Bn',
        activeRoutineId: parsed.routines?.[parsed.routines.length - 1]?.id || '',
        language: 'en',
      };
    }

    inMemoryCache = parsed;
    return parsed;
  } catch (err) {
    console.error('[ServerStorage] Error reading routine_store.json from disk, recreating:', err);
    const defaultStore = createDefaultStore();
    writeStoreToDisk(defaultStore);
    inMemoryCache = defaultStore;
    return defaultStore;
  }
}

function writeStoreToDisk(store: ServerStore): void {
  ensureDataDir();
  inMemoryCache = store;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('[ServerStorage] Error writing to routine_store.json:', err);
    throw err;
  }
}

export const serverStorage = {
  getStore(): ServerStore {
    return inMemoryCache || readStoreFromDisk();
  },

  saveTeachers(teachers: Teacher[]): ServerStore {
    const store = this.getStore();
    store.teachers = teachers;
    writeStoreToDisk(store);
    return store;
  },

  saveClassrooms(classrooms: Classroom[]): ServerStore {
    const store = this.getStore();
    store.classrooms = classrooms;
    writeStoreToDisk(store);
    return store;
  },

  saveBuildings(buildings: BuildingInfo[]): ServerStore {
    const store = this.getStore();
    store.buildings = buildings;
    writeStoreToDisk(store);
    return store;
  },

  addBuilding(building: BuildingInfo): ServerStore {
    const store = this.getStore();
    const existingIdx = store.buildings.findIndex((b) => b.id === building.id);
    if (existingIdx >= 0) {
      store.buildings[existingIdx] = building;
    } else {
      store.buildings.push(building);
    }
    writeStoreToDisk(store);
    return store;
  },

  addClassroom(classroom: Classroom): ServerStore {
    const store = this.getStore();
    const existingIdx = store.classrooms.findIndex((c) => c.id === classroom.id);
    if (existingIdx >= 0) {
      store.classrooms[existingIdx] = classroom;
    } else {
      store.classrooms.push(classroom);
    }
    writeStoreToDisk(store);
    return store;
  },

  updateClassroom(id: string, updated: Classroom): ServerStore {
    const store = this.getStore();
    store.classrooms = store.classrooms.map((c) => (c.id === id ? updated : c));
    writeStoreToDisk(store);
    return store;
  },

  deleteClassroom(id: string): ServerStore {
    const store = this.getStore();
    store.classrooms = store.classrooms.filter((c) => c.id !== id);
    writeStoreToDisk(store);
    return store;
  },

  savePapers(papers: Paper[]): ServerStore {
    const store = this.getStore();
    store.papers = papers;
    writeStoreToDisk(store);
    return store;
  },

  saveRoutines(routines: DailyRoutine[]): ServerStore {
    const store = this.getStore();
    store.routines = routines;
    writeStoreToDisk(store);
    return store;
  },

  saveRoutine(routine: DailyRoutine): ServerStore {
    const store = this.getStore();
    const existingIdx = store.routines.findIndex((r) => r.id === routine.id);
    if (existingIdx >= 0) {
      store.routines[existingIdx] = routine;
    } else {
      store.routines.push(routine);
    }
    store.settings.activeRoutineId = routine.id;
    writeStoreToDisk(store);
    return store;
  },

  deleteRoutine(id: string): ServerStore {
    const store = this.getStore();
    store.routines = store.routines.filter((r) => r.id !== id);
    if (store.settings.activeRoutineId === id) {
      store.settings.activeRoutineId = store.routines[store.routines.length - 1]?.id || '';
    }
    writeStoreToDisk(store);
    return store;
  },

  saveRules(rules: RoutineRuleConfig): ServerStore {
    const store = this.getStore();
    store.rules = rules;
    writeStoreToDisk(store);
    return store;
  },

  saveSettings(settings: Partial<ServerSettings>): ServerStore {
    const store = this.getStore();
    store.settings = { ...store.settings, ...settings };
    writeStoreToDisk(store);
    return store;
  },

  resetToDefault(): ServerStore {
    const fresh = createDefaultStore();
    writeStoreToDisk(fresh);
    return fresh;
  },
};
