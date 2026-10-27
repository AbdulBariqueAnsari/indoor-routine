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

export interface AppSettings {
  institutionName: string;
  activeRoutineId: string;
  language?: string;
}

export interface FullServerData {
  buildings: BuildingInfo[];
  classrooms: Classroom[];
  papers: Paper[];
  teachers: Teacher[];
  routines: DailyRoutine[];
  rules: RoutineRuleConfig;
  settings: AppSettings;
  unavailability?: UnavailableInstructor[];
}

const API_BASE = '/api';

export const api = {
  /**
   * Load entire database from the server hard drive
   */
  async loadAllData(): Promise<FullServerData> {
    try {
      const res = await fetch(`${API_BASE}/data`);
      if (!res.ok) {
        throw new Error(`Failed to load server data: ${res.statusText}`);
      }
      const data: FullServerData = await res.json();
      return data;
    } catch (err) {
      console.error('[API] Error loading server data:', err);
      throw err;
    }
  },

  /**
   * Save teachers list to the server disk
   */
  async saveTeachers(teachers: Teacher[]): Promise<Teacher[]> {
    try {
      const res = await fetch(`${API_BASE}/teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teachers }),
      });
      if (!res.ok) throw new Error(`Failed to save teachers: ${res.statusText}`);
      const data = await res.json();
      return data.teachers;
    } catch (err) {
      console.error('[API] Error saving teachers:', err);
      throw err;
    }
  },

  /**
   * Save classrooms list to the server disk
   */
  async saveClassrooms(classrooms: Classroom[]): Promise<Classroom[]> {
    try {
      const res = await fetch(`${API_BASE}/classrooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classrooms }),
      });
      if (!res.ok) throw new Error(`Failed to save classrooms: ${res.statusText}`);
      const data = await res.json();
      return data.classrooms;
    } catch (err) {
      console.error('[API] Error saving classrooms:', err);
      throw err;
    }
  },

  /**
   * Add a single classroom to the server disk
   */
  async addClassroom(classroom: Classroom): Promise<Classroom[]> {
    try {
      const res = await fetch(`${API_BASE}/classrooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(classroom),
      });
      if (!res.ok) throw new Error(`Failed to add classroom: ${res.statusText}`);
      const data = await res.json();
      return data.classrooms;
    } catch (err) {
      console.error('[API] Error adding classroom:', err);
      throw err;
    }
  },

  /**
   * Delete a classroom from the server disk
   */
  async deleteClassroom(id: string): Promise<Classroom[]> {
    try {
      const res = await fetch(`${API_BASE}/classrooms/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Failed to delete classroom: ${res.statusText}`);
      const data = await res.json();
      return data.classrooms;
    } catch (err) {
      console.error('[API] Error deleting classroom:', err);
      throw err;
    }
  },

  /**
   * Save papers list to the server disk
   */
  async savePapers(papers: Paper[]): Promise<Paper[]> {
    try {
      const res = await fetch(`${API_BASE}/papers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papers }),
      });
      if (!res.ok) throw new Error(`Failed to save papers: ${res.statusText}`);
      const data = await res.json();
      return data.papers;
    } catch (err) {
      console.error('[API] Error saving papers:', err);
      throw err;
    }
  },

  /**
   * Save buildings list to the server disk
   */
  async saveBuildings(buildings: BuildingInfo[]): Promise<BuildingInfo[]> {
    try {
      const res = await fetch(`${API_BASE}/buildings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildings }),
      });
      if (!res.ok) throw new Error(`Failed to save buildings: ${res.statusText}`);
      const data = await res.json();
      return data.buildings;
    } catch (err) {
      console.error('[API] Error saving buildings:', err);
      throw err;
    }
  },

  /**
   * Add a new building to the server disk
   */
  async addBuilding(building: BuildingInfo): Promise<BuildingInfo[]> {
    try {
      const res = await fetch(`${API_BASE}/buildings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(building),
      });
      if (!res.ok) throw new Error(`Failed to add building: ${res.statusText}`);
      const data = await res.json();
      return data.buildings;
    } catch (err) {
      console.error('[API] Error adding building:', err);
      throw err;
    }
  },

  /**
   * Save all routines to the server disk
   */
  async saveRoutines(routines: DailyRoutine[]): Promise<DailyRoutine[]> {
    try {
      const res = await fetch(`${API_BASE}/routines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routines }),
      });
      if (!res.ok) throw new Error(`Failed to save routines: ${res.statusText}`);
      const data = await res.json();
      return data.routines;
    } catch (err) {
      console.error('[API] Error saving routines:', err);
      throw err;
    }
  },

  /**
   * Save or update a single routine on the server disk
   */
  async saveRoutine(routine: DailyRoutine): Promise<{ routines: DailyRoutine[]; activeRoutineId: string }> {
    try {
      const res = await fetch(`${API_BASE}/routines/save-one`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine }),
      });
      if (!res.ok) throw new Error(`Failed to save routine: ${res.statusText}`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('[API] Error saving routine:', err);
      throw err;
    }
  },

  /**
   * Delete a routine from the server disk
   */
  async deleteRoutine(id: string): Promise<{ routines: DailyRoutine[]; activeRoutineId: string }> {
    try {
      const res = await fetch(`${API_BASE}/routines/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Failed to delete routine: ${res.statusText}`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('[API] Error deleting routine:', err);
      throw err;
    }
  },

  /**
   * Save routine preparation check rules to the server disk
   */
  async saveRules(rules: RoutineRuleConfig): Promise<RoutineRuleConfig> {
    try {
      const res = await fetch(`${API_BASE}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      if (!res.ok) throw new Error(`Failed to save rules: ${res.statusText}`);
      const data = await res.json();
      return data.rules;
    } catch (err) {
      console.error('[API] Error saving rules:', err);
      throw err;
    }
  },

  /**
   * Save settings to the server disk
   */
  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error(`Failed to save settings: ${res.statusText}`);
      const data = await res.json();
      return data.settings;
    } catch (err) {
      console.error('[API] Error saving settings:', err);
      throw err;
    }
  },

  /**
   * Save faculty unavailability register to the server disk
   */
  async saveUnavailability(unavailability: UnavailableInstructor[]): Promise<UnavailableInstructor[]> {
    try {
      const res = await fetch(`${API_BASE}/unavailability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unavailability }),
      });
      if (!res.ok) throw new Error(`Failed to save unavailability: ${res.statusText}`);
      const data = await res.json();
      return data.unavailability;
    } catch (err) {
      console.error('[API] Error saving unavailability:', err);
      throw err;
    }
  },

  /**
   * Reset all server data to factory defaults
   */
  async resetAllData(): Promise<FullServerData> {
    try {
      const res = await fetch(`${API_BASE}/reset`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Failed to reset data: ${res.statusText}`);
      const data = await res.json();
      return data.store;
    } catch (err) {
      console.error('[API] Error resetting data:', err);
      throw err;
    }
  },
};
