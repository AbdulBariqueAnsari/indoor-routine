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
  UnavailableInstructor,
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

export interface RoutineIndexItem {
  id: string;
  dayNumber: number;
  date: string;
  status: 'draft' | 'published';
  isLocked: boolean;
  filePath: string;
  notes?: string;
  totalSlots: number;
  updatedAt: string;
}

export interface ServerStore {
  buildings: BuildingInfo[];
  classrooms: Classroom[];
  papers: Paper[];
  teachers: Teacher[];
  routines: DailyRoutine[];
  rules: RoutineRuleConfig;
  settings: ServerSettings;
  unavailability?: UnavailableInstructor[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ROUTINES_DIR = path.resolve(DATA_DIR, 'routines');

// Individual discrete storage files
const TEACHERS_FILE = path.resolve(DATA_DIR, 'teachers.json');
const PAPERS_FILE = path.resolve(DATA_DIR, 'papers.json');
const CLASSROOMS_FILE = path.resolve(DATA_DIR, 'classrooms.json');
const BUILDINGS_FILE = path.resolve(DATA_DIR, 'buildings.json');
const ROUTINES_INDEX_FILE = path.resolve(DATA_DIR, 'routines_index.json');
const RULES_FILE = path.resolve(DATA_DIR, 'rules.json');
const SETTINGS_FILE = path.resolve(DATA_DIR, 'settings.json');
const UNAVAILABILITY_FILE = path.resolve(DATA_DIR, 'unavailability.json');
const LEGACY_DB_FILE = path.resolve(DATA_DIR, 'routine_store.json');

function ensureDirectories(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ROUTINES_DIR)) {
    fs.mkdirSync(ROUTINES_DIR, { recursive: true });
  }
}

function writeJsonSafely(filePath: string, data: any): void {
  ensureDirectories();
  const tempPath = `${filePath}.tmp_${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    // Fallback to direct write if rename fails
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

function readJsonSafely<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.error(`[ServerStorage] Error reading ${filePath}:`, err);
  }
  return fallback;
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
      status: 'ACTIVE',
    };
  });

  // Seed Day 1, Day 2, Day 3
  const day1 = generateDailyRoutine({
    classrooms,
    papers,
    teachers,
    absentTeacherIds: ['T8'], // SI Narendra Verma on leave
    priorityPaperIds: ['P01', 'P02'],
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
    absentTeacherIds: ['T15', 'T22'],
    priorityPaperIds: ['P05', 'P06'],
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
    absentTeacherIds: ['T3'],
    priorityPaperIds: ['P11', 'P13'],
    rules,
    historicalRoutines: [day1, day2],
    targetDayNumber: 3,
    targetDate: '2026-10-24',
    notes: 'Training Day 3 (Current Active Routine): Practical Hands-on & Public Order',
  });
  day3.isLocked = false;

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
    unavailability: [
      { teacherId: 'T8', type: 'LEAVE', remark: 'Sanctioned Casual Leave', date: '2026-10-22' },
      { teacherId: 'T15', type: 'DUTY', remark: 'Special Law & Order Duty', date: '2026-10-23' },
      { teacherId: 'T22', type: 'ABSENT', remark: 'Uninformed Absence', date: '2026-10-23' },
      { teacherId: 'T3', type: 'SICK', remark: 'Medical / Sick Leave', date: '2026-10-24' },
    ],
  };
}

let inMemoryCache: ServerStore | null = null;

/**
 * Persist separate files and linkage index
 */
function persistSeparateStore(store: ServerStore): void {
  ensureDirectories();
  inMemoryCache = store;

  // 1. Instructors / Teachers
  writeJsonSafely(TEACHERS_FILE, store.teachers);

  // 2. Subjects / Papers
  writeJsonSafely(PAPERS_FILE, store.papers);

  // 3. Classrooms
  writeJsonSafely(CLASSROOMS_FILE, store.classrooms);

  // 4. Buildings
  writeJsonSafely(BUILDINGS_FILE, store.buildings);

  // 5. Rules
  writeJsonSafely(RULES_FILE, store.rules);

  // 6. Settings
  writeJsonSafely(SETTINGS_FILE, store.settings);

  // 7. Unavailability Register
  writeJsonSafely(UNAVAILABILITY_FILE, store.unavailability || []);

  // 8. Individual Routine Files & Linked Index
  const routineIndexItems: RoutineIndexItem[] = [];
  for (const routine of store.routines) {
    const routineFileName = `routine_${routine.id}.json`;
    const routineFilePath = path.resolve(ROUTINES_DIR, routineFileName);
    writeJsonSafely(routineFilePath, routine);

    routineIndexItems.push({
      id: routine.id,
      dayNumber: routine.dayNumber,
      date: routine.date,
      status: routine.status || 'published',
      isLocked: routine.isLocked,
      filePath: `routines/${routineFileName}`,
      notes: routine.notes,
      totalSlots: routine.slots ? routine.slots.length : 0,
      updatedAt: routine.updatedAt || new Date().toISOString(),
    });
  }

  // Save the routines index file linking all individual routines
  writeJsonSafely(ROUTINES_INDEX_FILE, routineIndexItems);
}

/**
 * Load store from separate files on disk, or auto-migrate legacy monolithic routine_store.json
 */
function readStoreFromDisk(): ServerStore {
  ensureDirectories();

  // If separate teachers file does not exist, check if legacy file needs migration
  const hasSeparateFiles = fs.existsSync(TEACHERS_FILE) && fs.existsSync(ROUTINES_INDEX_FILE);

  if (!hasSeparateFiles) {
    if (fs.existsSync(LEGACY_DB_FILE)) {
      try {
        console.log('[ServerStorage] Migrating legacy routine_store.json to modular multi-file storage...');
        const legacyRaw = fs.readFileSync(LEGACY_DB_FILE, 'utf8');
        const legacyData = JSON.parse(legacyRaw);

        const store: ServerStore = {
          buildings: legacyData.buildings || [...INITIAL_BUILDINGS],
          classrooms: legacyData.classrooms || [...INITIAL_CLASSROOMS],
          papers: legacyData.papers || [...INITIAL_PAPERS],
          teachers: legacyData.teachers || [...INITIAL_TEACHERS],
          routines: legacyData.routines || [],
          rules: { ...DEFAULT_ROUTINE_RULES, ...(legacyData.rules || {}) },
          settings: legacyData.settings || {
            institutionName: 'STC, SAP 4th Bn',
            activeRoutineId: legacyData.routines?.[legacyData.routines.length - 1]?.id || '',
            language: 'en',
          },
          unavailability: legacyData.unavailability || [],
        };

        persistSeparateStore(store);
        return store;
      } catch (err) {
        console.error('[ServerStorage] Failed to migrate legacy routine_store.json:', err);
      }
    }

    // Initialize fresh default store into separate files
    const fresh = createDefaultStore();
    persistSeparateStore(fresh);
    return fresh;
  }

  // Read modular files
  try {
    const teachers = readJsonSafely<Teacher[]>(TEACHERS_FILE, [...INITIAL_TEACHERS]);
    const papers = readJsonSafely<Paper[]>(PAPERS_FILE, [...INITIAL_PAPERS]);
    const classrooms = readJsonSafely<Classroom[]>(CLASSROOMS_FILE, [...INITIAL_CLASSROOMS]);
    const buildings = readJsonSafely<BuildingInfo[]>(BUILDINGS_FILE, [...INITIAL_BUILDINGS]);
    const rules = { ...DEFAULT_ROUTINE_RULES, ...readJsonSafely<RoutineRuleConfig>(RULES_FILE, DEFAULT_ROUTINE_RULES) };
    const settings = readJsonSafely<ServerSettings>(SETTINGS_FILE, {
      institutionName: 'STC, SAP 4th Bn',
      activeRoutineId: '',
      language: 'en',
    });
    const unavailability = readJsonSafely<UnavailableInstructor[]>(UNAVAILABILITY_FILE, []);

    // Load individual routines using the routines index linkage
    const routineIndexItems = readJsonSafely<RoutineIndexItem[]>(ROUTINES_INDEX_FILE, []);
    const routines: DailyRoutine[] = [];

    for (const indexItem of routineIndexItems) {
      const routineFilePath = path.resolve(DATA_DIR, indexItem.filePath);
      if (fs.existsSync(routineFilePath)) {
        try {
          const routineData = JSON.parse(fs.readFileSync(routineFilePath, 'utf8')) as DailyRoutine;
          routines.push(routineData);
        } catch (err) {
          console.error(`[ServerStorage] Error parsing routine file ${routineFilePath}:`, err);
        }
      }
    }

    if (!settings.activeRoutineId && routines.length > 0) {
      settings.activeRoutineId = routines[routines.length - 1].id;
    }

    const store: ServerStore = {
      teachers,
      papers,
      classrooms,
      buildings,
      routines,
      rules,
      settings,
      unavailability,
    };

    inMemoryCache = store;
    return store;
  } catch (err) {
    console.error('[ServerStorage] Error reading separate files, recreating defaults:', err);
    const fresh = createDefaultStore();
    persistSeparateStore(fresh);
    return fresh;
  }
}

export const serverStorage = {
  getStore(): ServerStore {
    return inMemoryCache || readStoreFromDisk();
  },

  // 1. Teachers / Instructors
  saveTeachers(teachers: Teacher[]): ServerStore {
    const store = this.getStore();
    store.teachers = teachers;
    writeJsonSafely(TEACHERS_FILE, teachers);
    inMemoryCache = store;
    return store;
  },

  // 2. Subjects / Papers
  savePapers(papers: Paper[]): ServerStore {
    const store = this.getStore();
    store.papers = papers;
    writeJsonSafely(PAPERS_FILE, papers);
    inMemoryCache = store;
    return store;
  },

  // 3. Classrooms
  saveClassrooms(classrooms: Classroom[]): ServerStore {
    const store = this.getStore();
    store.classrooms = classrooms;
    writeJsonSafely(CLASSROOMS_FILE, classrooms);
    inMemoryCache = store;
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
    writeJsonSafely(CLASSROOMS_FILE, store.classrooms);
    inMemoryCache = store;
    return store;
  },

  updateClassroom(id: string, updated: Classroom): ServerStore {
    const store = this.getStore();
    store.classrooms = store.classrooms.map((c) => (c.id === id ? updated : c));
    writeJsonSafely(CLASSROOMS_FILE, store.classrooms);
    inMemoryCache = store;
    return store;
  },

  deleteClassroom(id: string): ServerStore {
    const store = this.getStore();
    store.classrooms = store.classrooms.filter((c) => c.id !== id);
    writeJsonSafely(CLASSROOMS_FILE, store.classrooms);
    inMemoryCache = store;
    return store;
  },

  // 4. Buildings
  saveBuildings(buildings: BuildingInfo[]): ServerStore {
    const store = this.getStore();
    store.buildings = buildings;
    writeJsonSafely(BUILDINGS_FILE, buildings);
    inMemoryCache = store;
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
    writeJsonSafely(BUILDINGS_FILE, store.buildings);
    inMemoryCache = store;
    return store;
  },

  // 5. Routines (Individual linked files)
  saveRoutines(routines: DailyRoutine[]): ServerStore {
    const store = this.getStore();
    store.routines = routines;
    persistSeparateStore(store);
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

    // Write specific routine file
    const routineFileName = `routine_${routine.id}.json`;
    const routineFilePath = path.resolve(ROUTINES_DIR, routineFileName);
    writeJsonSafely(routineFilePath, routine);

    // Update routines_index.json
    const routineIndexItems: RoutineIndexItem[] = store.routines.map((r) => ({
      id: r.id,
      dayNumber: r.dayNumber,
      date: r.date,
      status: r.status || 'published',
      isLocked: r.isLocked,
      filePath: `routines/routine_${r.id}.json`,
      notes: r.notes,
      totalSlots: r.slots ? r.slots.length : 0,
      updatedAt: r.updatedAt || new Date().toISOString(),
    }));
    writeJsonSafely(ROUTINES_INDEX_FILE, routineIndexItems);
    writeJsonSafely(SETTINGS_FILE, store.settings);

    inMemoryCache = store;
    return store;
  },

  deleteRoutine(id: string): ServerStore {
    const store = this.getStore();
    store.routines = store.routines.filter((r) => r.id !== id);
    if (store.settings.activeRoutineId === id) {
      store.settings.activeRoutineId = store.routines[store.routines.length - 1]?.id || '';
    }

    // Remove individual routine file
    const routineFilePath = path.resolve(ROUTINES_DIR, `routine_${id}.json`);
    if (fs.existsSync(routineFilePath)) {
      try { fs.unlinkSync(routineFilePath); } catch {}
    }

    // Update index
    const routineIndexItems: RoutineIndexItem[] = store.routines.map((r) => ({
      id: r.id,
      dayNumber: r.dayNumber,
      date: r.date,
      status: r.status || 'published',
      isLocked: r.isLocked,
      filePath: `routines/routine_${r.id}.json`,
      notes: r.notes,
      totalSlots: r.slots ? r.slots.length : 0,
      updatedAt: r.updatedAt || new Date().toISOString(),
    }));
    writeJsonSafely(ROUTINES_INDEX_FILE, routineIndexItems);
    writeJsonSafely(SETTINGS_FILE, store.settings);

    inMemoryCache = store;
    return store;
  },

  // 6. Routine Rules
  saveRules(rules: RoutineRuleConfig): ServerStore {
    const store = this.getStore();
    store.rules = rules;
    writeJsonSafely(RULES_FILE, rules);
    inMemoryCache = store;
    return store;
  },

  // 7. Settings
  saveSettings(settings: Partial<ServerSettings>): ServerStore {
    const store = this.getStore();
    store.settings = { ...store.settings, ...settings };
    writeJsonSafely(SETTINGS_FILE, store.settings);
    inMemoryCache = store;
    return store;
  },

  // 8. Unavailability Register
  saveUnavailability(unavailability: UnavailableInstructor[]): ServerStore {
    const store = this.getStore();
    store.unavailability = unavailability;
    writeJsonSafely(UNAVAILABILITY_FILE, unavailability);
    inMemoryCache = store;
    return store;
  },

  // Reset to Factory Default
  resetToDefault(): ServerStore {
    const fresh = createDefaultStore();
    persistSeparateStore(fresh);
    return fresh;
  },
};
