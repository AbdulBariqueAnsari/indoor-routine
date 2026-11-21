/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import {
  BuildingInfo,
  Classroom,
  compareClassrooms,
  DailyRoutine,
  Paper,
  RoutineRuleConfig,
  Teacher,
  UnavailableInstructor,
  AppSettings,
} from '../src/types/index.ts';
import {
  DEFAULT_ROUTINE_RULES,
  INITIAL_BUILDINGS,
  INITIAL_CLASSROOMS,
  INITIAL_PAPERS,
  INITIAL_TEACHERS,
} from '../src/data/initialData.ts';
import { generateDailyRoutine } from '../src/utils/scheduler.ts';

export type ServerSettings = AppSettings;

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

// SQL Database Files in data folder
export const SQLITE_DB_FILE = path.resolve(DATA_DIR, 'routine_scheduler.db');
export const READABLE_SQL_FILE = path.resolve(DATA_DIR, 'routine_scheduler.sql');

// Individual discrete storage files (maintained in sync as backups)
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

function writeTextSafely(filePath: string, text: string): void {
  ensureDirectories();
  const tempPath = `${filePath}.tmp_${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, text, 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    fs.writeFileSync(filePath, text, 'utf8');
  }
}

function writeJsonSafely(filePath: string, data: any): void {
  writeTextSafely(filePath, JSON.stringify(data, null, 2));
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

// Helper to escape SQL single quotes safely
function sqlStr(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'object') {
    val = JSON.stringify(val);
  }
  const clean = String(val).replace(/'/g, "''");
  return `'${clean}'`;
}

/**
 * Generate human-readable, beautifully structured ANSI SQL script
 * that anyone can open in Windows Notepad and inspect/edit.
 */
function generateReadableSqlFile(store: ServerStore): string {
  const timestamp = new Date().toISOString();
  const lines: string[] = [];

  lines.push('-- ==============================================================================');
  lines.push('-- SMART CLASS ROUTINE SCHEDULER - RELATIONAL SQL DATABASE');
  lines.push(`-- Institution : ${store.settings.institutionName || 'STC, SAP 4th Bn'}`);
  lines.push('-- Storage File: data/routine_scheduler.sql (Readable in Notepad)');
  lines.push(`-- Last Synced : ${timestamp}`);
  lines.push('-- ==============================================================================');
  lines.push('');
  lines.push('PRAGMA foreign_keys = ON;');
  lines.push('');

  // 1. app_settings
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('-- 1. TABLE: app_settings (Institutional Presentation & Page Setup)');
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('CREATE TABLE IF NOT EXISTS app_settings (');
  lines.push('  id TEXT PRIMARY KEY,');
  lines.push('  institution_name TEXT,');
  lines.push('  battalion_unit TEXT,');
  lines.push('  training_center_name TEXT,');
  lines.push('  sub_title TEXT,');
  lines.push('  location TEXT,');
  lines.push('  address TEXT,');
  lines.push('  signatory_designation TEXT,');
  lines.push('  tagline TEXT,');
  lines.push('  active_routine_id TEXT,');
  lines.push('  language TEXT DEFAULT \'en\',');
  lines.push('  admin_password TEXT,');
  lines.push('  downloads_config_json TEXT,');
  lines.push('  updated_at TEXT');
  lines.push(');');
  lines.push('');
  lines.push('INSERT OR REPLACE INTO app_settings (');
  lines.push('  id, institution_name, battalion_unit, training_center_name, sub_title,');
  lines.push('  location, address, signatory_designation, tagline, active_routine_id,');
  lines.push('  language, admin_password, downloads_config_json, updated_at');
  lines.push(') VALUES (');
  lines.push(`  ${sqlStr('main_settings')},`);
  lines.push(`  ${sqlStr(store.settings.institutionName || 'STC, SAP 4th Bn')},`);
  lines.push(`  ${sqlStr(store.settings.battalionUnit || 'SAP 4th Battalion')},`);
  lines.push(`  ${sqlStr(store.settings.trainingCenterName || 'Subsidiary Training Centre')},`);
  lines.push(`  ${sqlStr(store.settings.subTitle || 'Daily Indoor Class Routine & Instructor Assignment Master Sheet')},`);
  lines.push(`  ${sqlStr(store.settings.location || 'SAP 4th Bn, Kasba, Raiganj, Uttar Dinajpur')},`);
  lines.push(`  ${sqlStr(store.settings.address || 'Kasba, Raiganj, Uttar Dinajpur - 733123')},`);
  lines.push(`  ${sqlStr(store.settings.signatoryDesignation || 'O/C STC (Indoor)')},`);
  lines.push(`  ${sqlStr(store.settings.tagline || 'Daily Indoor Class Routine Scheduler')},`);
  lines.push(`  ${sqlStr(store.settings.activeRoutineId || '')},`);
  lines.push(`  ${sqlStr(store.settings.language || 'en')},`);
  lines.push(`  ${sqlStr(store.settings.adminPassword || 'admin123')},`);
  lines.push(`  ${sqlStr(store.settings.downloadsConfig || {})},`);
  lines.push(`  ${sqlStr(timestamp)}`);
  lines.push(');');
  lines.push('');

  // 2. buildings
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('-- 2. TABLE: buildings (Campus Academic & Administrative Blocks)');
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('CREATE TABLE IF NOT EXISTS buildings (');
  lines.push('  id TEXT PRIMARY KEY,');
  lines.push('  name TEXT NOT NULL,');
  lines.push('  code TEXT NOT NULL,');
  lines.push('  floors INTEGER DEFAULT 1,');
  lines.push('  total_rooms INTEGER DEFAULT 0,');
  lines.push('  description TEXT');
  lines.push(');');
  lines.push('');
  if (store.buildings.length > 0) {
    lines.push('INSERT OR REPLACE INTO buildings (id, name, code, floors, total_rooms, description) VALUES');
    const bRows = store.buildings.map((b, idx) => {
      const isLast = idx === store.buildings.length - 1;
      return `  (${sqlStr(b.id)}, ${sqlStr(b.name)}, ${sqlStr(b.code)}, ${Number(b.floors) || 1}, 0, ${sqlStr(b.description || '')})${isLast ? ';' : ','}`;
    });
    lines.push(bRows.join('\n'));
  }
  lines.push('');

  // 3. classrooms
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('-- 3. TABLE: classrooms (Lecture Halls and Training Rooms)');
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('CREATE TABLE IF NOT EXISTS classrooms (');
  lines.push('  id TEXT PRIMARY KEY,');
  lines.push('  name TEXT NOT NULL,');
  lines.push('  code TEXT,');
  lines.push('  building TEXT,');
  lines.push('  room_number INTEGER,');
  lines.push('  floor INTEGER,');
  lines.push('  capacity INTEGER DEFAULT 70,');
  lines.push('  room_type TEXT DEFAULT \'standard\',');
  lines.push('  is_active INTEGER DEFAULT 1');
  lines.push(');');
  lines.push('');
  if (store.classrooms.length > 0) {
    lines.push('INSERT OR REPLACE INTO classrooms (id, name, code, building, room_number, floor, capacity, room_type, is_active) VALUES');
    const cRows = store.classrooms.map((c, idx) => {
      const isLast = idx === store.classrooms.length - 1;
      return `  (${sqlStr(c.id)}, ${sqlStr(c.name)}, ${sqlStr(c.code || c.id)}, ${sqlStr(c.building || 'OLD')}, ${Number(c.roomNumber) || 1}, ${Number(c.floor) || 1}, ${Number(c.capacity) || 70}, 'standard', 1)${isLast ? ';' : ','}`;
    });
    lines.push(cRows.join('\n'));
  }
  lines.push('');

  // 4. teachers
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('-- 4. TABLE: teachers (Faculty & Law Instructors Master)');
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('CREATE TABLE IF NOT EXISTS teachers (');
  lines.push('  id TEXT PRIMARY KEY,');
  lines.push('  code TEXT NOT NULL,');
  lines.push('  name TEXT NOT NULL,');
  lines.push('  name_hi TEXT,');
  lines.push('  designation TEXT,');
  lines.push('  designation_hi TEXT,');
  lines.push('  assigned_building TEXT DEFAULT \'FLOATING\',');
  lines.push('  status TEXT DEFAULT \'ACTIVE\',');
  lines.push('  phone TEXT,');
  lines.push('  email TEXT,');
  lines.push('  qualification TEXT,');
  lines.push('  remarks TEXT,');
  lines.push('  max_daily_periods INTEGER DEFAULT 4,');
  lines.push('  primary_paper_ids_json TEXT,');
  lines.push('  backup_paper_ids_json TEXT,');
  lines.push('  secondary_paper_ids_json TEXT,');
  lines.push('  cross_subject_backup_paper_ids_json TEXT,');
  lines.push('  off_periods_json TEXT,');
  lines.push('  day_off_periods_json TEXT');
  lines.push(');');
  lines.push('');
  if (store.teachers.length > 0) {
    lines.push('INSERT OR REPLACE INTO teachers (id, code, name, name_hi, designation, designation_hi, assigned_building, status, phone, email, qualification, remarks, max_daily_periods, primary_paper_ids_json, backup_paper_ids_json, secondary_paper_ids_json, cross_subject_backup_paper_ids_json, off_periods_json, day_off_periods_json) VALUES');
    const tRows = store.teachers.map((t, idx) => {
      const isLast = idx === store.teachers.length - 1;
      return `  (${sqlStr(t.id)}, ${sqlStr(t.code || t.id)}, ${sqlStr(t.name)}, ${sqlStr(t.nameHi || '')}, ${sqlStr(t.designation || 'Instructor')}, ${sqlStr(t.designationHi || '')}, ${sqlStr(t.assignedBuilding || 'FLOATING')}, ${sqlStr(t.status || 'ACTIVE')}, ${sqlStr(t.phone || '')}, ${sqlStr(t.email || '')}, ${sqlStr(t.qualification || '')}, ${sqlStr(t.remarks || '')}, ${Number(t.maxDailyPeriods) || 4}, ${sqlStr(t.primaryPaperIds || [])}, ${sqlStr(t.backupPaperIds || [])}, ${sqlStr(t.secondaryPaperIds || [])}, ${sqlStr(t.crossSubjectBackupPaperIds || [])}, ${sqlStr(t.offPeriods || [])}, ${sqlStr(t.dayOffPeriods || {})})${isLast ? ';' : ','}`;
    });
    lines.push(tRows.join('\n'));
  }
  lines.push('');

  // 5. papers
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('-- 5. TABLE: papers (Curriculum Subject Papers & Syllabi Targets)');
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('CREATE TABLE IF NOT EXISTS papers (');
  lines.push('  id TEXT PRIMARY KEY,');
  lines.push('  code TEXT NOT NULL,');
  lines.push('  title TEXT NOT NULL,');
  lines.push('  title_hi TEXT,');
  lines.push('  category TEXT,');
  lines.push('  category_hi TEXT,');
  lines.push('  total_target_sessions INTEGER DEFAULT 45,');
  lines.push('  original_target_sessions INTEGER DEFAULT 55,');
  lines.push('  color TEXT,');
  lines.push('  description TEXT,');
  lines.push('  theory_or_practical TEXT DEFAULT \'THEORY\',');
  lines.push('  max_daily_per_room INTEGER DEFAULT 2,');
  lines.push('  priority_tier TEXT DEFAULT \'NORMAL\',');
  lines.push('  preferred_building TEXT DEFAULT \'FLOATING\',');
  lines.push('  primary_teacher_ids_json TEXT,');
  lines.push('  nearest_paper_ids_json TEXT');
  lines.push(');');
  lines.push('');
  if (store.papers.length > 0) {
    lines.push('INSERT OR REPLACE INTO papers (id, code, title, title_hi, category, category_hi, total_target_sessions, original_target_sessions, color, description, theory_or_practical, max_daily_per_room, priority_tier, preferred_building, primary_teacher_ids_json, nearest_paper_ids_json) VALUES');
    const pRows = store.papers.map((p, idx) => {
      const isLast = idx === store.papers.length - 1;
      return `  (${sqlStr(p.id)}, ${sqlStr(p.code || p.id)}, ${sqlStr(p.title)}, ${sqlStr(p.titleHi || '')}, ${sqlStr(p.category || 'General')}, ${sqlStr(p.categoryHi || '')}, ${Number(p.totalTargetSessions) || 45}, ${Number(p.originalTargetSessions) || 55}, ${sqlStr(p.color || '#3B82F6')}, ${sqlStr(p.description || '')}, ${sqlStr(p.theoryOrPractical || 'THEORY')}, ${Number(p.maxDailyPerRoom) || 2}, ${sqlStr(p.priorityTier || 'NORMAL')}, ${sqlStr(p.preferredBuilding || 'FLOATING')}, ${sqlStr(p.primaryTeacherIds || [])}, ${sqlStr(p.nearestPaperIds || [])})${isLast ? ';' : ','}`;
    });
    lines.push(pRows.join('\n'));
  }
  lines.push('');

  // 6. routines
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('-- 6. TABLE: routines (Daily Routines Master Timetables)');
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('CREATE TABLE IF NOT EXISTS routines (');
  lines.push('  id TEXT PRIMARY KEY,');
  lines.push('  day_number INTEGER NOT NULL,');
  lines.push('  date TEXT NOT NULL,');
  lines.push('  status TEXT DEFAULT \'published\',');
  lines.push('  is_locked INTEGER DEFAULT 0,');
  lines.push('  notes TEXT,');
  lines.push('  total_slots INTEGER DEFAULT 0,');
  lines.push('  absent_teacher_ids_json TEXT,');
  lines.push('  priority_paper_ids_json TEXT,');
  lines.push('  room_priority_paper_ids_json TEXT,');
  lines.push('  subject_priority_tiers_json TEXT,');
  lines.push('  priority_subject_min_periods_json TEXT,');
  lines.push('  excluded_paper_ids_json TEXT,');
  lines.push('  teacher_off_periods_json TEXT,');
  lines.push('  practical_config_json TEXT,');
  lines.push('  slots_json TEXT NOT NULL,');
  lines.push('  created_at TEXT,');
  lines.push('  updated_at TEXT');
  lines.push(');');
  lines.push('');
  if (store.routines.length > 0) {
    lines.push('INSERT OR REPLACE INTO routines (id, day_number, date, status, is_locked, notes, total_slots, absent_teacher_ids_json, priority_paper_ids_json, room_priority_paper_ids_json, subject_priority_tiers_json, priority_subject_min_periods_json, excluded_paper_ids_json, teacher_off_periods_json, practical_config_json, slots_json, created_at, updated_at) VALUES');
    const rRows = store.routines.map((r, idx) => {
      const isLast = idx === store.routines.length - 1;
      return `  (${sqlStr(r.id)}, ${Number(r.dayNumber) || 1}, ${sqlStr(r.date || '')}, ${sqlStr(r.status || 'published')}, ${r.isLocked ? 1 : 0}, ${sqlStr(r.notes || '')}, ${r.slots ? r.slots.length : 0}, ${sqlStr(r.absentTeacherIds || [])}, ${sqlStr(r.priorityPaperIds || [])}, ${sqlStr(r.roomPriorityPaperIds || {})}, ${sqlStr(r.subjectPriorityTiers || {})}, ${sqlStr(r.prioritySubjectMinPeriods || {})}, ${sqlStr(r.excludedPaperIds || [])}, ${sqlStr(r.teacherOffPeriods || {})}, ${sqlStr(r.practicalConfig || {})}, ${sqlStr(r.slots || [])}, ${sqlStr(r.createdAt || timestamp)}, ${sqlStr(r.updatedAt || timestamp)})${isLast ? ';' : ','}`;
    });
    lines.push(rRows.join('\n'));
  }
  lines.push('');

  // 7. routine_rules
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('-- 7. TABLE: routine_rules (Algorithmic Scheduling Constraints & Rules)');
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('CREATE TABLE IF NOT EXISTS routine_rules (');
  lines.push('  id TEXT PRIMARY KEY,');
  lines.push('  rules_json TEXT NOT NULL,');
  lines.push('  updated_at TEXT');
  lines.push(');');
  lines.push('');
  lines.push(`INSERT OR REPLACE INTO routine_rules (id, rules_json, updated_at) VALUES ('active_rules', ${sqlStr(store.rules || DEFAULT_ROUTINE_RULES)}, ${sqlStr(timestamp)});`);
  lines.push('');

  // 8. unavailability
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('-- 8. TABLE: unavailability (Instructor Absence & Leave Register)');
  lines.push('-- ------------------------------------------------------------------------------');
  lines.push('CREATE TABLE IF NOT EXISTS unavailability (');
  lines.push('  id INTEGER PRIMARY KEY AUTOINCREMENT,');
  lines.push('  teacher_id TEXT NOT NULL,');
  lines.push('  date TEXT,');
  lines.push('  type TEXT NOT NULL,');
  lines.push('  remark TEXT');
  lines.push(');');
  lines.push('');
  if (store.unavailability && store.unavailability.length > 0) {
    lines.push('INSERT INTO unavailability (teacher_id, date, type, remark) VALUES');
    const uRows = store.unavailability.map((u, idx) => {
      const isLast = idx === (store.unavailability?.length || 0) - 1;
      return `  (${sqlStr(u.teacherId)}, ${sqlStr(u.date || '')}, ${sqlStr(u.type)}, ${sqlStr(u.remark || '')})${isLast ? ';' : ','}`;
    });
    lines.push(uRows.join('\n'));
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Initialize SQLite Database tables
 */
let sqliteDb: DatabaseSync | null = null;

function getSqliteDb(): DatabaseSync {
  if (sqliteDb) return sqliteDb;
  ensureDirectories();
  sqliteDb = new DatabaseSync(SQLITE_DB_FILE);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');

  // Create tables
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      institution_name TEXT,
      battalion_unit TEXT,
      training_center_name TEXT,
      sub_title TEXT,
      location TEXT,
      address TEXT,
      signatory_designation TEXT,
      tagline TEXT,
      active_routine_id TEXT,
      language TEXT DEFAULT 'en',
      admin_password TEXT,
      downloads_config_json TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS buildings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      floors INTEGER DEFAULT 1,
      total_rooms INTEGER DEFAULT 0,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      building TEXT,
      room_number INTEGER,
      floor INTEGER,
      capacity INTEGER DEFAULT 70,
      room_type TEXT DEFAULT 'standard',
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      name_hi TEXT,
      designation TEXT,
      designation_hi TEXT,
      assigned_building TEXT DEFAULT 'FLOATING',
      status TEXT DEFAULT 'ACTIVE',
      phone TEXT,
      email TEXT,
      qualification TEXT,
      remarks TEXT,
      max_daily_periods INTEGER DEFAULT 4,
      primary_paper_ids_json TEXT,
      backup_paper_ids_json TEXT,
      secondary_paper_ids_json TEXT,
      cross_subject_backup_paper_ids_json TEXT,
      off_periods_json TEXT,
      day_off_periods_json TEXT
    );

    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      title_hi TEXT,
      category TEXT,
      category_hi TEXT,
      total_target_sessions INTEGER DEFAULT 45,
      original_target_sessions INTEGER DEFAULT 55,
      color TEXT,
      description TEXT,
      theory_or_practical TEXT DEFAULT 'THEORY',
      max_daily_per_room INTEGER DEFAULT 2,
      priority_tier TEXT DEFAULT 'NORMAL',
      preferred_building TEXT DEFAULT 'FLOATING',
      primary_teacher_ids_json TEXT,
      nearest_paper_ids_json TEXT
    );

    CREATE TABLE IF NOT EXISTS routines (
      id TEXT PRIMARY KEY,
      day_number INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'published',
      is_locked INTEGER DEFAULT 0,
      notes TEXT,
      total_slots INTEGER DEFAULT 0,
      absent_teacher_ids_json TEXT,
      priority_paper_ids_json TEXT,
      room_priority_paper_ids_json TEXT,
      subject_priority_tiers_json TEXT,
      priority_subject_min_periods_json TEXT,
      excluded_paper_ids_json TEXT,
      teacher_off_periods_json TEXT,
      practical_config_json TEXT,
      slots_json TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS routine_rules (
      id TEXT PRIMARY KEY,
      rules_json TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS unavailability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id TEXT NOT NULL,
      date TEXT,
      type TEXT NOT NULL,
      remark TEXT
    );
  `);

  try {
    sqliteDb.exec('ALTER TABLE teachers ADD COLUMN day_off_periods_json TEXT;');
  } catch (_) {
    // Column already exists
  }

  try {
    sqliteDb.exec('ALTER TABLE routines ADD COLUMN practical_config_json TEXT;');
  } catch (_) {
    // Column already exists
  }

  return sqliteDb;
}

/**
 * Persist store to SQLite database
 */
function persistToSqlite(store: ServerStore): void {
  const db = getSqliteDb();

  // Settings
  const upsertSettings = db.prepare(`
    INSERT OR REPLACE INTO app_settings (
      id, institution_name, battalion_unit, training_center_name, sub_title,
      location, address, signatory_designation, tagline, active_routine_id,
      language, admin_password, downloads_config_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  upsertSettings.run(
    'main_settings',
    store.settings.institutionName || 'STC, SAP 4th Bn',
    store.settings.battalionUnit || '',
    store.settings.trainingCenterName || '',
    store.settings.subTitle || '',
    store.settings.location || '',
    store.settings.address || '',
    store.settings.signatoryDesignation || '',
    store.settings.tagline || '',
    store.settings.activeRoutineId || '',
    store.settings.language || 'en',
    store.settings.adminPassword || 'admin123',
    JSON.stringify(store.settings.downloadsConfig || {}),
    new Date().toISOString()
  );

  // Buildings
  db.exec('DELETE FROM buildings;');
  const insertBuilding = db.prepare(`
    INSERT OR REPLACE INTO buildings (id, name, code, floors, total_rooms, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const b of store.buildings) {
    insertBuilding.run(b.id, b.name, b.code, Number(b.floors) || 1, 0, b.description || '');
  }

  // Classrooms
  db.exec('DELETE FROM classrooms;');
  const insertRoom = db.prepare(`
    INSERT OR REPLACE INTO classrooms (id, name, code, building, room_number, floor, capacity, room_type, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of store.classrooms) {
    insertRoom.run(c.id, c.name, c.code || c.id, c.building || 'OLD', Number(c.roomNumber) || 1, Number(c.floor) || 1, Number(c.capacity) || 70, 'standard', 1);
  }

  // Teachers
  db.exec('DELETE FROM teachers;');
  const insertTeacher = db.prepare(`
    INSERT OR REPLACE INTO teachers (
      id, code, name, name_hi, designation, designation_hi, assigned_building,
      status, phone, email, qualification, remarks, max_daily_periods,
      primary_paper_ids_json, backup_paper_ids_json, secondary_paper_ids_json,
      cross_subject_backup_paper_ids_json, off_periods_json, day_off_periods_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const t of store.teachers) {
    insertTeacher.run(
      t.id,
      t.code || t.id,
      t.name,
      t.nameHi || '',
      t.designation || 'Instructor',
      t.designationHi || '',
      t.assignedBuilding || 'FLOATING',
      t.status || 'ACTIVE',
      t.phone || '',
      t.email || '',
      t.qualification || '',
      t.remarks || '',
      Number(t.maxDailyPeriods) || 4,
      JSON.stringify(t.primaryPaperIds || []),
      JSON.stringify(t.backupPaperIds || []),
      JSON.stringify(t.secondaryPaperIds || []),
      JSON.stringify(t.crossSubjectBackupPaperIds || []),
      JSON.stringify(t.offPeriods || []),
      JSON.stringify(t.dayOffPeriods || {})
    );
  }

  // Papers
  db.exec('DELETE FROM papers;');
  const insertPaper = db.prepare(`
    INSERT OR REPLACE INTO papers (
      id, code, title, title_hi, category, category_hi, total_target_sessions,
      original_target_sessions, color, description, theory_or_practical,
      max_daily_per_room, priority_tier, preferred_building,
      primary_teacher_ids_json, nearest_paper_ids_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of store.papers) {
    insertPaper.run(
      p.id,
      p.code || p.id,
      p.title,
      p.titleHi || '',
      p.category || 'General',
      p.categoryHi || '',
      Number(p.totalTargetSessions) || 45,
      Number(p.originalTargetSessions) || 55,
      p.color || '#3B82F6',
      p.description || '',
      p.theoryOrPractical || 'THEORY',
      Number(p.maxDailyPerRoom) || 2,
      p.priorityTier || 'NORMAL',
      p.preferredBuilding || 'FLOATING',
      JSON.stringify(p.primaryTeacherIds || []),
      JSON.stringify(p.nearestPaperIds || [])
    );
  }

  // Routines
  db.exec('DELETE FROM routines;');
  const insertRoutine = db.prepare(`
    INSERT OR REPLACE INTO routines (
      id, day_number, date, status, is_locked, notes, total_slots,
      absent_teacher_ids_json, priority_paper_ids_json, room_priority_paper_ids_json,
      subject_priority_tiers_json, priority_subject_min_periods_json,
      excluded_paper_ids_json, teacher_off_periods_json, practical_config_json, slots_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of store.routines) {
    insertRoutine.run(
      r.id,
      Number(r.dayNumber) || 1,
      r.date || '',
      r.status || 'published',
      r.isLocked ? 1 : 0,
      r.notes || '',
      r.slots ? r.slots.length : 0,
      JSON.stringify(r.absentTeacherIds || []),
      JSON.stringify(r.priorityPaperIds || []),
      JSON.stringify(r.roomPriorityPaperIds || {}),
      JSON.stringify(r.subjectPriorityTiers || {}),
      JSON.stringify(r.prioritySubjectMinPeriods || {}),
      JSON.stringify(r.excludedPaperIds || []),
      JSON.stringify(r.teacherOffPeriods || {}),
      JSON.stringify(r.practicalConfig || {}),
      JSON.stringify(r.slots || []),
      r.createdAt || new Date().toISOString(),
      r.updatedAt || new Date().toISOString()
    );
  }

  // Rules
  const upsertRules = db.prepare(`
    INSERT OR REPLACE INTO routine_rules (id, rules_json, updated_at)
    VALUES (?, ?, ?)
  `);
  upsertRules.run('active_rules', JSON.stringify(store.rules || DEFAULT_ROUTINE_RULES), new Date().toISOString());

  // Unavailability
  db.exec('DELETE FROM unavailability;');
  const insertUnavail = db.prepare(`
    INSERT INTO unavailability (teacher_id, date, type, remark)
    VALUES (?, ?, ?, ?)
  `);
  for (const u of store.unavailability || []) {
    insertUnavail.run(u.teacherId, u.date || '', u.type, u.remark || '');
  }
}

/**
 * Load store directly from SQLite database
 */
function loadStoreFromSqlite(): ServerStore | null {
  try {
    const db = getSqliteDb();
    const settingsRow = db.prepare('SELECT * FROM app_settings WHERE id = ?').get('main_settings') as any;
    const buildingRows = db.prepare('SELECT * FROM buildings ORDER BY id ASC').all() as any[];
    const classroomRows = db.prepare('SELECT * FROM classrooms ORDER BY room_number ASC, id ASC').all() as any[];
    const teacherRows = db.prepare('SELECT * FROM teachers ORDER BY id ASC').all() as any[];
    const paperRows = db.prepare('SELECT * FROM papers ORDER BY id ASC').all() as any[];
    const routineRows = db.prepare('SELECT * FROM routines ORDER BY day_number ASC').all() as any[];
    const rulesRow = db.prepare('SELECT * FROM routine_rules WHERE id = ?').get('active_rules') as any;
    const unavailRows = db.prepare('SELECT * FROM unavailability ORDER BY id ASC').all() as any[];

    if (!buildingRows || buildingRows.length === 0 || !teacherRows || teacherRows.length === 0) {
      return null;
    }

    const settings: ServerSettings = {
      institutionName: settingsRow?.institution_name || 'STC, SAP 4th Bn',
      battalionUnit: settingsRow?.battalion_unit || 'SAP 4th Battalion',
      trainingCenterName: settingsRow?.training_center_name || 'Subsidiary Training Centre',
      subTitle: settingsRow?.sub_title || 'Daily Indoor Class Routine & Instructor Assignment Master Sheet',
      location: settingsRow?.location || 'SAP 4th Bn, Kasba, Raiganj, Uttar Dinajpur',
      address: settingsRow?.address || 'Kasba, Raiganj, Uttar Dinajpur - 733123',
      signatoryDesignation: settingsRow?.signatory_designation || 'O/C STC (Indoor)',
      tagline: settingsRow?.tagline || 'Daily Indoor Class Routine Scheduler',
      activeRoutineId: settingsRow?.active_routine_id || '',
      language: settingsRow?.language || 'en',
      adminPassword: settingsRow?.admin_password || 'admin123',
      downloadsConfig: settingsRow?.downloads_config_json ? JSON.parse(settingsRow.downloads_config_json) : undefined,
    };

    const buildings: BuildingInfo[] = buildingRows.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      floors: Number(b.floors) || 1,
      description: b.description || '',
    }));

    const classrooms: Classroom[] = classroomRows.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code || c.id,
      building: c.building || 'OLD',
      roomNumber: Number(c.room_number) || 1,
      floor: Number(c.floor) || 1,
      capacity: Number(c.capacity) || 70,
    })).sort(compareClassrooms);

    const teachers: Teacher[] = teacherRows.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      nameHi: t.name_hi || undefined,
      designation: t.designation || 'Instructor',
      designationHi: t.designation_hi || undefined,
      assignedBuilding: t.assigned_building || 'FLOATING',
      status: t.status || 'ACTIVE',
      phone: t.phone || '',
      email: t.email || '',
      qualification: t.qualification || '',
      remarks: t.remarks || '',
      maxDailyPeriods: Number(t.max_daily_periods) || 4,
      primaryPaperIds: t.primary_paper_ids_json ? JSON.parse(t.primary_paper_ids_json) : [],
      backupPaperIds: t.backup_paper_ids_json ? JSON.parse(t.backup_paper_ids_json) : [],
      secondaryPaperIds: t.secondary_paper_ids_json ? JSON.parse(t.secondary_paper_ids_json) : [],
      crossSubjectBackupPaperIds: t.cross_subject_backup_paper_ids_json ? JSON.parse(t.cross_subject_backup_paper_ids_json) : [],
      offPeriods: t.off_periods_json ? JSON.parse(t.off_periods_json) : [],
      dayOffPeriods: t.day_off_periods_json ? JSON.parse(t.day_off_periods_json) : {},
    }));
    teachers.sort((a, b) => (a.code || a.id).localeCompare((b.code || b.id), undefined, { numeric: true, sensitivity: 'base' }));

    const papers: Paper[] = paperRows.map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      titleHi: p.title_hi || undefined,
      category: p.category || 'General',
      categoryHi: p.category_hi || undefined,
      totalTargetSessions: Number(p.total_target_sessions) || 45,
      originalTargetSessions: Number(p.original_target_sessions) || 55,
      color: p.color || '#3B82F6',
      description: p.description || '',
      theoryOrPractical: p.theory_or_practical || 'THEORY',
      maxDailyPerRoom: Number(p.max_daily_per_room) || 2,
      priorityTier: p.priority_tier || 'NORMAL',
      preferredBuilding: p.preferred_building || 'FLOATING',
      primaryTeacherIds: p.primary_teacher_ids_json ? JSON.parse(p.primary_teacher_ids_json) : [],
      nearestPaperIds: p.nearest_paper_ids_json ? JSON.parse(p.nearest_paper_ids_json) : [],
    }));

    const routines: DailyRoutine[] = routineRows.map((r) => ({
      id: r.id,
      dayNumber: Number(r.day_number),
      date: r.date,
      status: r.status || 'published',
      isLocked: Boolean(r.is_locked),
      notes: r.notes || '',
      absentTeacherIds: r.absent_teacher_ids_json ? JSON.parse(r.absent_teacher_ids_json) : [],
      priorityPaperIds: r.priority_paper_ids_json ? JSON.parse(r.priority_paper_ids_json) : [],
      roomPriorityPaperIds: r.room_priority_paper_ids_json ? JSON.parse(r.room_priority_paper_ids_json) : {},
      subjectPriorityTiers: r.subject_priority_tiers_json ? JSON.parse(r.subject_priority_tiers_json) : {},
      prioritySubjectMinPeriods: r.priority_subject_min_periods_json ? JSON.parse(r.priority_subject_min_periods_json) : {},
      excludedPaperIds: r.excluded_paper_ids_json ? JSON.parse(r.excluded_paper_ids_json) : [],
      teacherOffPeriods: r.teacher_off_periods_json ? JSON.parse(r.teacher_off_periods_json) : {},
      practicalConfig: r.practical_config_json ? JSON.parse(r.practical_config_json) : undefined,
      slots: r.slots_json ? JSON.parse(r.slots_json) : [],
      createdAt: r.created_at || new Date().toISOString(),
      updatedAt: r.updated_at || new Date().toISOString(),
    }));

    const rules: RoutineRuleConfig = rulesRow?.rules_json
      ? { ...DEFAULT_ROUTINE_RULES, ...JSON.parse(rulesRow.rules_json) }
      : { ...DEFAULT_ROUTINE_RULES };

    const unavailability: UnavailableInstructor[] = unavailRows.map((u) => ({
      teacherId: u.teacher_id,
      type: u.type,
      remark: u.remark || '',
      date: u.date || '',
    }));

    if (!settings.activeRoutineId && routines.length > 0) {
      settings.activeRoutineId = routines[routines.length - 1].id;
    }

    const syncedPapers = syncPapersWithTeachers(papers, teachers);

    return {
      buildings,
      classrooms,
      papers: syncedPapers,
      teachers,
      routines,
      rules,
      settings,
      unavailability,
    };
  } catch (err) {
    console.error('[ServerStorage] Error reading SQLite database:', err);
    return null;
  }
}

function syncPapersWithTeachers(papers: Paper[], teachers: Teacher[]): Paper[] {
  return papers.map((p) => {
    const matchingTeachers = teachers.filter((t) => {
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

function createDefaultStore(): ServerStore {
  const classrooms: Classroom[] = [...INITIAL_CLASSROOMS];
  const papers: Paper[] = [...INITIAL_PAPERS];
  const buildings: BuildingInfo[] = [...INITIAL_BUILDINGS];
  const rules: RoutineRuleConfig = { ...DEFAULT_ROUTINE_RULES };

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

  const day1 = generateDailyRoutine({
    classrooms,
    papers,
    teachers,
    absentTeacherIds: ['T8'],
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
let lastKnownDbSyncMtime = 0;

/**
 * Returns the latest modification timestamp (mtimeMs) across all discrete JSON files.
 */
function getLatestJsonModifiedTime(): number {
  let latest = 0;
  const jsonFiles = [
    TEACHERS_FILE,
    PAPERS_FILE,
    CLASSROOMS_FILE,
    BUILDINGS_FILE,
    RULES_FILE,
    SETTINGS_FILE,
    UNAVAILABILITY_FILE,
    ROUTINES_INDEX_FILE,
  ];
  for (const f of jsonFiles) {
    if (fs.existsSync(f)) {
      try {
        const mtime = fs.statSync(f).mtimeMs;
        if (mtime > latest) latest = mtime;
      } catch (_) {}
    }
  }
  if (fs.existsSync(ROUTINES_DIR)) {
    try {
      const files = fs.readdirSync(ROUTINES_DIR);
      for (const f of files) {
        if (f.endsWith('.json')) {
          const full = path.join(ROUTINES_DIR, f);
          const mtime = fs.statSync(full).mtimeMs;
          if (mtime > latest) latest = mtime;
        }
      }
    } catch (_) {}
  }
  return latest;
}

/**
 * Load store directly from discrete JSON storage files.
 */
function loadStoreFromJsonFiles(): ServerStore | null {
  try {
    ensureDirectories();
    const hasSeparateFiles = fs.existsSync(TEACHERS_FILE);
    if (!hasSeparateFiles) return null;

    const teachers = readJsonSafely<Teacher[]>(TEACHERS_FILE, [...INITIAL_TEACHERS]).sort((a, b) =>
      (a.code || a.id).localeCompare((b.code || b.id), undefined, { numeric: true, sensitivity: 'base' })
    );
    const papers = readJsonSafely<Paper[]>(PAPERS_FILE, [...INITIAL_PAPERS]);
    const classrooms = readJsonSafely<Classroom[]>(CLASSROOMS_FILE, [...INITIAL_CLASSROOMS]).sort(compareClassrooms);
    const buildings = readJsonSafely<BuildingInfo[]>(BUILDINGS_FILE, [...INITIAL_BUILDINGS]);
    const rules = { ...DEFAULT_ROUTINE_RULES, ...readJsonSafely<RoutineRuleConfig>(RULES_FILE, DEFAULT_ROUTINE_RULES) };
    const settings = readJsonSafely<ServerSettings>(SETTINGS_FILE, {
      institutionName: 'STC, SAP 4th Bn',
      activeRoutineId: '',
      language: 'en',
    });
    const unavailability = readJsonSafely<UnavailableInstructor[]>(UNAVAILABILITY_FILE, []);

    const routines: DailyRoutine[] = [];
    if (fs.existsSync(ROUTINES_DIR)) {
      const routineFiles = fs.readdirSync(ROUTINES_DIR).filter((f) => f.endsWith('.json'));
      for (const f of routineFiles) {
        const full = path.join(ROUTINES_DIR, f);
        try {
          const r = JSON.parse(fs.readFileSync(full, 'utf8')) as DailyRoutine;
          if (r && r.id && Array.isArray(r.slots)) {
            routines.push(r);
          }
        } catch (err) {
          console.error(`[ServerStorage] Error reading ${full}:`, err);
        }
      }
    } else if (fs.existsSync(ROUTINES_INDEX_FILE)) {
      const routineIndexItems = readJsonSafely<RoutineIndexItem[]>(ROUTINES_INDEX_FILE, []);
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
    }

    routines.sort((a, b) => a.dayNumber - b.dayNumber);

    if (!settings.activeRoutineId && routines.length > 0) {
      settings.activeRoutineId = routines[routines.length - 1].id;
    }

    const syncedPapers = syncPapersWithTeachers(papers, teachers);
    return {
      teachers,
      papers: syncedPapers,
      classrooms,
      buildings,
      routines,
      rules,
      settings,
      unavailability,
    };
  } catch (err) {
    console.error('[ServerStorage] Error loading from JSON files:', err);
    return null;
  }
}

/**
 * Persist store across SQLite database, readable SQL dump, and JSON backups
 */
function persistStore(store: ServerStore): void {
  ensureDirectories();
  inMemoryCache = store;

  // 1. Commit to relational SQLite Database
  try {
    persistToSqlite(store);
  } catch (err) {
    console.error('[ServerStorage] Error persisting to SQLite:', err);
  }

  // 2. Generate and write human-readable SQL file (Openable in Windows Notepad)
  try {
    const readableSql = generateReadableSqlFile(store);
    writeTextSafely(READABLE_SQL_FILE, readableSql);
  } catch (err) {
    console.error('[ServerStorage] Error writing readable SQL file:', err);
  }

  // 3. Keep JSON backups for secondary compatibility
  try {
    writeJsonSafely(TEACHERS_FILE, store.teachers);
    writeJsonSafely(PAPERS_FILE, store.papers);
    writeJsonSafely(CLASSROOMS_FILE, store.classrooms);
    writeJsonSafely(BUILDINGS_FILE, store.buildings);
    writeJsonSafely(RULES_FILE, store.rules);
    writeJsonSafely(SETTINGS_FILE, store.settings);
    writeJsonSafely(UNAVAILABILITY_FILE, store.unavailability || []);

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
    writeJsonSafely(ROUTINES_INDEX_FILE, routineIndexItems);
  } catch (err) {
    console.error('[ServerStorage] Error writing backup JSON files:', err);
  }

  // Update sync timestamp tracker so internal writes don't trigger false external edit detection
  lastKnownDbSyncMtime = getLatestJsonModifiedTime();
}

/**
 * Load store from disk:
 * 1. Check if external edits were made to JSON files; if so, sync to SQLite
 * 2. Try SQLite database
 * 3. Fall back to JSON files
 * 4. Fall back to default seed store
 */
function readStoreFromDisk(): ServerStore {
  ensureDirectories();

  const jsonLatestMtime = getLatestJsonModifiedTime();
  const dbMtime = fs.existsSync(SQLITE_DB_FILE) ? fs.statSync(SQLITE_DB_FILE).mtimeMs : 0;

  // If JSON files were edited on disk more recently than the SQLite database file,
  // sync the database from the edited JSON files!
  if (jsonLatestMtime > dbMtime + 1000) {
    console.log('[ServerStorage] Detected JSON files were modified on disk. Syncing database from JSON files...');
    const storeFromJson = loadStoreFromJsonFiles();
    if (storeFromJson) {
      persistStore(storeFromJson);
      return storeFromJson;
    }
  }

  // 1. Attempt loading from SQLite
  if (fs.existsSync(SQLITE_DB_FILE)) {
    const sqliteStore = loadStoreFromSqlite();
    if (sqliteStore && sqliteStore.teachers.length > 0) {
      inMemoryCache = sqliteStore;
      lastKnownDbSyncMtime = getLatestJsonModifiedTime();
      // Ensure readable SQL file is up to date
      if (!fs.existsSync(READABLE_SQL_FILE)) {
        writeTextSafely(READABLE_SQL_FILE, generateReadableSqlFile(sqliteStore));
      }
      return sqliteStore;
    }
  }

  // 2. Load from JSON files if DB does not exist
  const storeFromJson = loadStoreFromJsonFiles();
  if (storeFromJson) {
    persistStore(storeFromJson);
    return storeFromJson;
  }

  // 3. Fall back to default seed
  console.log('[ServerStorage] Initializing fresh SQL database store...');
  const fresh = createDefaultStore();
  persistStore(fresh);
  return fresh;
}

export const serverStorage = {
  getStore(): ServerStore {
    // Check if any JSON file was modified externally while the server is running
    const jsonLatestMtime = getLatestJsonModifiedTime();
    if (inMemoryCache && lastKnownDbSyncMtime > 0 && jsonLatestMtime > lastKnownDbSyncMtime + 500) {
      console.log('[ServerStorage] External modification in storage JSON files detected. Updating database from JSON files...');
      const updatedStore = loadStoreFromJsonFiles();
      if (updatedStore) {
        persistStore(updatedStore);
        return updatedStore;
      }
    }
    return inMemoryCache || readStoreFromDisk();
  },

  syncFromJson(): ServerStore {
    console.log('[ServerStorage] Manual sync requested: updating database from JSON storage files...');
    const updatedStore = loadStoreFromJsonFiles() || createDefaultStore();
    persistStore(updatedStore);
    return updatedStore;
  },

  // 1. Teachers / Instructors
  saveTeachers(teachers: Teacher[]): ServerStore {
    const store = this.getStore();
    const sortedTeachers = [...teachers].sort((a, b) =>
      (a.code || a.id).localeCompare((b.code || b.id), undefined, { numeric: true, sensitivity: 'base' })
    );
    store.teachers = sortedTeachers;
    store.papers = syncPapersWithTeachers(store.papers, sortedTeachers);
    persistStore(store);
    return store;
  },

  // 2. Subjects / Papers
  savePapers(papers: Paper[]): ServerStore {
    const store = this.getStore();
    store.papers = syncPapersWithTeachers(papers, store.teachers);
    persistStore(store);
    return store;
  },

  // 3. Classrooms
  saveClassrooms(classrooms: Classroom[]): ServerStore {
    const store = this.getStore();
    store.classrooms = [...classrooms].sort(compareClassrooms);
    persistStore(store);
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
    store.classrooms.sort(compareClassrooms);
    persistStore(store);
    return store;
  },

  updateClassroom(id: string, updated: Classroom): ServerStore {
    const store = this.getStore();
    store.classrooms = store.classrooms.map((c) => (c.id === id ? updated : c)).sort(compareClassrooms);
    persistStore(store);
    return store;
  },

  deleteClassroom(id: string): ServerStore {
    const store = this.getStore();
    store.classrooms = store.classrooms.filter((c) => c.id !== id).sort(compareClassrooms);
    persistStore(store);
    return store;
  },

  // 4. Buildings
  saveBuildings(buildings: BuildingInfo[]): ServerStore {
    const store = this.getStore();
    store.buildings = buildings;
    persistStore(store);
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
    persistStore(store);
    return store;
  },

  // 5. Routines
  saveRoutines(routines: DailyRoutine[]): ServerStore {
    const store = this.getStore();
    store.routines = routines;
    persistStore(store);
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
    persistStore(store);
    return store;
  },

  deleteRoutine(id: string): ServerStore {
    const store = this.getStore();
    store.routines = store.routines.filter((r) => r.id !== id);
    if (store.settings.activeRoutineId === id) {
      store.settings.activeRoutineId = store.routines[store.routines.length - 1]?.id || '';
    }

    const routineFilePath = path.resolve(ROUTINES_DIR, `routine_${id}.json`);
    if (fs.existsSync(routineFilePath)) {
      try { fs.unlinkSync(routineFilePath); } catch {}
    }

    persistStore(store);
    return store;
  },

  // 6. Routine Rules
  saveRules(rules: RoutineRuleConfig): ServerStore {
    const store = this.getStore();
    store.rules = rules;
    persistStore(store);
    return store;
  },

  // 7. Settings
  saveSettings(settings: Partial<ServerSettings>): ServerStore {
    const store = this.getStore();
    store.settings = { ...store.settings, ...settings };
    persistStore(store);
    return store;
  },

  // 8. Unavailability Register
  saveUnavailability(unavailability: UnavailableInstructor[]): ServerStore {
    const store = this.getStore();
    store.unavailability = unavailability;
    persistStore(store);
    return store;
  },

  // Reset to Factory Default
  resetToDefault(): ServerStore {
    const fresh = createDefaultStore();
    persistStore(fresh);
    return fresh;
  },
};
