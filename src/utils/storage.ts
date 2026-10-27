/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Legacy client-side localStorage has been completely superseded by Server-Side
// persistent disk database (see src/utils/api.ts and server/serverStorage.ts).
// All data (teachers, classrooms, buildings, papers, routines, rules, settings)
// is stored directly on the server disk in `data/routine_store.json`.

export interface AppSettings {
  language: 'en';
  activeRoutineId: string;
}

export { api } from './api';
