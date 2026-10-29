/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BuildingInfo, Classroom, Paper, RoutineRuleConfig, Teacher } from '../types/index.ts';

export const INITIAL_BUILDINGS: BuildingInfo[] = [
  {
    id: 'OLD',
    name: 'Old School Building',
    code: 'OB',
    floors: 2,
    description: '8 Classrooms (Room No. 1 to Room No. 8), Capacity 70 candidates each'
  },
  {
    id: 'NEW',
    name: 'New School Building',
    code: 'NB',
    floors: 3,
    description: '7 Classrooms (Room No. 1 to Room No. 7), Capacity 52 candidates each'
  }
];

export interface MasterRuleDefinition {
  key: keyof RoutineRuleConfig;
  ruleNumber: number | string;
  title: string;
  category: 'Tier 1: Inviolable Constraints' | 'Tier 2: Curriculum & Progression (Moto I & IV)' | 'Tier 3: Staffing & Substitution (Moto III)';
  tierNumber: 1 | 2 | 3;
  badge: string;
  description: string;
  dependsOn?: keyof RoutineRuleConfig;
  disabledHint?: string;
}

export const MASTER_ROUTINE_RULES: MasterRuleDefinition[] = [
  // ==========================================
  // TIER 1: INVIOLABLE CONSTRAINTS (HARD RULES)
  // Active Rules: 1, 2, 3, 4, 5, 6, 6A, 6B, 7
  // ==========================================
  {
    key: 'enableZeroDoubleBooking',
    ruleNumber: 1,
    title: '1. Strict Zero Double-Booking Guarantee',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Hard Rule 1',
    tierNumber: 1,
    description:
      'Strictly prohibits any instructor from being scheduled in multiple classrooms simultaneously during the exact same period.',
  },
  {
    key: 'enableStrictAbsenteeExclusion',
    ruleNumber: 2,
    title: '2. Faculty Unavailability & Leave Exclusion',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Hard Rule 2',
    tierNumber: 1,
    description:
      'Instructors marked Absent, On Leave, Duty, or Sick in the Unavailability Register are strictly excluded from routine creation.',
  },
  {
    key: 'enableStrictBuildingBinding',
    ruleNumber: 3,
    title: '3. Strict Building-Bound Faculty Detailment (Moto III)',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Moto III: Hard Rule',
    tierNumber: 1,
    description:
      'Old Building (OB) teachers are strictly bound to Old Building classrooms (OB-1 to OB-8). New Building (NB) teachers are strictly bound to New Building (NB-1 to NB-7). Only Floating teachers can cross between buildings.',
  },
  {
    key: 'enableBuildingChangeGap',
    ruleNumber: 4,
    title: '4. Mandatory 1-Period Gap on Floating Campus Transit (Moto III)',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Transit Gap',
    tierNumber: 1,
    description:
      'When a Floating instructor crosses between Old School Building and New School Building, a mandatory 1-period buffer is enforced to allow physical movement across campus.',
  },
  {
    key: 'enableRoomQuotaCompletionLock',
    ruleNumber: 5,
    title: '5. Classroom 100% Syllabus Quota Lockout',
    category: 'Tier 1: Inviolable Constraints',
    badge: '100% Quota Lock',
    tierNumber: 1,
    description:
      'Strictly locks and excludes any subject paper from being allocated to a classroom once that classroom has reached 100% of its target sessions for that subject, preserving class periods for lagging subjects.',
  },
  {
    key: 'enableMaxOnePeriodPerSubjectPerRoomDaily',
    ruleNumber: '6',
    title: '6. Single Period per Subject per Room per Day',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Single Period/Room',
    tierNumber: 1,
    description:
      'When enabled, a particular subject must not be assigned more than once in the same room/class on the same day (5 different subjects daily). When ON, Rules 6A and 6B are disabled.',
  },
  {
    key: 'enableMaxRoomDailyLimit',
    ruleNumber: '6A',
    title: '6A. Maximum Two Periods per Subject per Class/Room per Day',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Max 2 Periods/Room',
    tierNumber: 1,
    dependsOn: 'enableMaxOnePeriodPerSubjectPerRoomDaily',
    disabledHint: 'Available only when Rule 6 is OFF',
    description:
      'Available only when Rule 6 is OFF. When enabled, the same subject may be assigned to the same room/class a maximum of two times per day.',
  },
  {
    key: 'enableNonConsecutiveGapForSameSubject',
    ruleNumber: '6B',
    title: '6B. Prevent Consecutive Periods of the Same Subject',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'No Back-to-Back',
    tierNumber: 1,
    dependsOn: 'enableMaxRoomDailyLimit',
    disabledHint: 'Available only when Rule 6 is OFF and Rule 6A is ON',
    description:
      'Available only when Rule 6A is ON. When enabled, the same subject must not be assigned in consecutive periods within the same room/class on the same day (e.g. Periods 1 and 3 allowed, Periods 1 and 2 prohibited).',
  },
  {
    key: 'enableDailyWorkloadMaxCap',
    ruleNumber: 7,
    title: '7. Strict Hard-Cap: Max 4 Periods/Day per Instructor',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Hard Cap <= 4',
    tierNumber: 1,
    description:
      'Kisi bhi instructor ko ek din me 4 se jyada period allot nahi hoga (Strict hard-cap of max 4 periods per day). No instructor will ever receive a 5th period.',
  },

  // ==========================================
  // TIER 2: CURRICULUM PROGRESSION (MOTO I & IV)
  // ==========================================
  {
    key: 'enableClassroomSubjectEqualization',
    ruleNumber: 10,
    title: '10. Room-Wise Syllabus Completion % Equalization (Moto I)',
    category: 'Tier 2: Curriculum & Progression (Moto I & IV)',
    badge: 'Moto I: % Equalizer',
    tierNumber: 2,
    description:
      'Subject aise detailment ho har rooms me ki overall sessions completion percentage (completed / target quota %) har room aur subject me lagbhag equal aur balanced rahe.',
  },
  {
    key: 'enableSubjectFacultyLoadBalancing',
    ruleNumber: 11,
    title: '11. Subject Detailment for 6-Day Faculty Load Equalization',
    category: 'Tier 2: Curriculum & Progression (Moto I & IV)',
    badge: '6-Day Equalizer',
    tierNumber: 2,
    description:
      'Subjects ko rooms me aise detail karein jisse jin instructors ke sessions kam huye hain, unke subjects ko preference mile. Isse 6 din ke cycle me sabhi instructors ke sessions lagbhag barabar (approx 17-18 periods) equalize ho jaate hain.',
  },
  {
    key: 'enablePaperRotationalFlow',
    ruleNumber: 12,
    title: '12. Sequential Subject Rotational Flow Across Classrooms (Moto IV)',
    category: 'Tier 2: Curriculum & Progression (Moto I & IV)',
    badge: 'Moto IV: Wave Flow',
    tierNumber: 2,
    description:
      'Subject detailment har next period me next room me detail ho (Room K in Period P -> Room K+1 in Period P+1). Teachers subject ke upar building-wise aur floating aadhar par allot honge.',
  },
  {
    key: 'enableProportionalRemainingRatio',
    ruleNumber: 13,
    title: '13. Proportional Remaining Quota Fill-Up (75 Daily Sessions)',
    category: 'Tier 2: Curriculum & Progression (Moto I & IV)',
    badge: 'Remaining % Ratio',
    tierNumber: 2,
    description:
      'Fills daily classroom sessions (5 periods x 15 classrooms = 75 total sessions) in exact proportion to each subject remaining session percentage across classrooms.',
  },
  {
    key: 'enableSubjectPriorityTiers',
    ruleNumber: 14,
    title: '14. Percentage-Based Priority Scaling (High: +50%, Low: -50%)',
    category: 'Tier 2: Curriculum & Progression (Moto I & IV)',
    badge: 'Priority % Scale',
    tierNumber: 2,
    description:
      'Awards +50% allocation to High Priority subjects and reduces Low Priority by -50%, capped at classroom count.',
  },
  {
    key: 'enableGuaranteedPriorityPeriods',
    ruleNumber: 15,
    title: '15. Guaranteed Priority Minimum Periods Delivery',
    category: 'Tier 2: Curriculum & Progression (Moto I & IV)',
    badge: 'Strict Priority Delivery',
    tierNumber: 2,
    description:
      'Guarantees that subjects prioritized during routine generation strictly receive their minimum required periods (at least 1 period per prioritized classroom or designated quota).',
  },
  {
    key: 'enableDayToDayProgression',
    ruleNumber: 16,
    title: '16. Day-to-Day Room Progression Carryover',
    category: 'Tier 2: Curriculum & Progression (Moto I & IV)',
    badge: 'Daily Stepper',
    tierNumber: 2,
    description:
      'Seeds Period 1 starting rooms based on where routine ended on the previous day (e.g. Room 1 advances to Room 2 on next day).',
  },

  // ==========================================
  // TIER 3: STAFFING & WORKLOAD (MOTO III)
  // ==========================================
  {
    key: 'enableWorkloadEqualization',
    ruleNumber: 17,
    title: '17. Cumulative Faculty Workload Equalization',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Fair Workload',
    tierNumber: 3,
    description:
      'Dynamically prioritizes lagging instructors in Practical and Backup slots so all 26 instructors gradually converge to approximately equal total sessions.',
  },
  {
    key: 'enableDailyWorkloadSoftCap',
    ruleNumber: 18,
    title: '18. Daily Workload Soft-Cap (Max 3 Periods/Day)',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Soft-Cap (<=3)',
    tierNumber: 3,
    description:
      'Prioritizes instructors with fewer than 3 periods today before assigning a 4th period, keeping daily teaching load balanced across campus.',
  },
  {
    key: 'enableNoSubstituteAllotment',
    ruleNumber: 19,
    title: '19. Strict Main Teacher Only (No Substitute Allotment)',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'No Substitute Allotment',
    tierNumber: 3,
    description:
      'Agar kisi subject ke liye main teacher nahi hai to koi substitute teacher apply nahi hoga. Wo jagah bilkul khali (blank) rahegi.',
  },
  {
    key: 'replaceWithAvailableSubjectIfNoPrimary',
    ruleNumber: 20,
    title: '20. Replace with Alternate Available Subject (Sub-Rule)',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Alternate Subject Fill',
    tierNumber: 3,
    description:
      'Sub-rule under No Substitute: Agar main teacher unavailable ho to khali chhodne ke bajaye slot ko dusre available subject aur uske available primary teacher se replace karein.',
  },
  {
    key: 'enableDesignatedBackup',
    ruleNumber: 21,
    title: '21. Designated Backup Instructor Substitution',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Backup Slots 1 & 2',
    tierNumber: 3,
    description:
      'When substitution is allowed: Automatically appoints designated Backup Slot 1 and Backup Slot 2 instructors (acting 100% Floating across campus) when primary instructor is absent.',
  },
  {
    key: 'enableCrossMutualBackup',
    ruleNumber: 22,
    title: '22. Cross-Subject Mutual Instructor Backup',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Subject Pairings',
    tierNumber: 3,
    description:
      'Enforces mutual cross-backup pairs: Forensics (Paper-5) <-> ICT Cyber (Paper-6) and Police Admin (Paper-8/9) <-> Criminology (Paper-7).',
  },
  {
    key: 'enablePracticalFlexible',
    ruleNumber: 23,
    title: '23. Flexible Practical (Paper-13) Staffing',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Staffing Equalizer',
    tierNumber: 3,
    description:
      'Practical does not have dedicated instructors; permits any qualified available instructor to conduct Practical sessions to balance workloads.',
  },
  {
    key: 'enableCaravanFlow',
    ruleNumber: 24,
    title: '24. Instructor-Bound Caravan Flow (Default: OFF)',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Teacher Caravan',
    tierNumber: 3,
    description:
      'Forces the specific instructor to physically travel with their subject consecutively from Room K to Room K+1. Kept OFF by default in favor of Subject Rotational Flow.',
  },
];

export const DEFAULT_ROUTINE_RULES: RoutineRuleConfig = {
  // Tier 1: Inviolable Constraints
  enableZeroDoubleBooking: true,
  enableStrictAbsenteeExclusion: true,
  enableStrictBuildingBinding: true,
  enableBuildingChangeGap: true,
  enableRoomQuotaCompletionLock: true,
  enableMaxOnePeriodPerSubjectPerRoomDaily: true,
  enableMaxRoomDailyLimit: false,
  enableNonConsecutiveGapForSameSubject: false,
  enableDailyWorkloadMaxCap: true,

  // Tier 2: Curriculum Progression (Moto I & IV)
  enableClassroomSubjectEqualization: true,
  enableSubjectFacultyLoadBalancing: true,
  enablePaperRotationalFlow: true,
  enableProportionalRemainingRatio: true,
  enableSubjectPriorityTiers: true,
  enableGuaranteedPriorityPeriods: true,
  enableDayToDayProgression: true,

  // Tier 3: Staffing & Workload (Moto III)
  enableWorkloadEqualization: true,
  enableDailyWorkloadSoftCap: true,
  enableNoSubstituteAllotment: false,
  replaceWithAvailableSubjectIfNoPrimary: false,
  enableDesignatedBackup: true,
  enableCrossMutualBackup: true,
  enablePracticalFlexible: true,
  enableCaravanFlow: false,
};

/**
 * Returns whether a given rule is currently disabled/locked based on its dependencies.
 */
export function isRuleDisabled(key: keyof RoutineRuleConfig, rules: RoutineRuleConfig): boolean {
  if (key === 'enableMaxRoomDailyLimit') {
    // Rule 6A is disabled when Rule 6 is ON
    return Boolean(rules.enableMaxOnePeriodPerSubjectPerRoomDaily);
  }
  if (key === 'enableNonConsecutiveGapForSameSubject') {
    // Rule 6B is disabled when Rule 6 is ON OR Rule 6A is OFF
    return Boolean(rules.enableMaxOnePeriodPerSubjectPerRoomDaily) || !rules.enableMaxRoomDailyLimit;
  }
  if (key === 'replaceWithAvailableSubjectIfNoPrimary') {
    // Rule 20 is disabled when Rule 19 (No Substitute) is OFF
    return !rules.enableNoSubstituteAllotment;
  }
  return false;
}

/**
 * Normalizes rule configuration to guarantee that dependent rules are kept inactive
 * whenever their prerequisites are not met.
 */
export function normalizeRuleConfig(rules: Partial<RoutineRuleConfig> = {}): RoutineRuleConfig {
  const merged: RoutineRuleConfig = {
    ...DEFAULT_ROUTINE_RULES,
    ...rules,
  };

  // Rule 6 -> Rule 6A -> Rule 6B dependency matrix
  if (merged.enableMaxOnePeriodPerSubjectPerRoomDaily) {
    // Rule 6 is ON -> 6A and 6B are inactive
    merged.enableMaxRoomDailyLimit = false;
    merged.enableNonConsecutiveGapForSameSubject = false;
  } else if (!merged.enableMaxRoomDailyLimit) {
    // Rule 6 is OFF, 6A is OFF -> 6B is inactive
    merged.enableNonConsecutiveGapForSameSubject = false;
  }

  // Rule 19 -> Rule 20 dependency
  if (!merged.enableNoSubstituteAllotment) {
    merged.replaceWithAvailableSubjectIfNoPrimary = false;
  }

  return merged;
}

/**
 * Safely migrates legacy stored rules without losing valid user configurations.
 */
export function migrateLegacyRules(stored: any): RoutineRuleConfig {
  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_ROUTINE_RULES };
  }
  const result: RoutineRuleConfig = {
    ...DEFAULT_ROUTINE_RULES,
    ...stored,
  };
  return normalizeRuleConfig(result);
}

export const INITIAL_CLASSROOMS: Classroom[] = [
  // Old School Building (8 Classrooms, Capacity: 70)
  { id: 'OB-1', code: 'OB-01', name: 'Room No. 1', building: 'OLD', roomNumber: 1, floor: 1, capacity: 70 },
  { id: 'OB-2', code: 'OB-02', name: 'Room No. 2', building: 'OLD', roomNumber: 2, floor: 1, capacity: 70 },
  { id: 'OB-3', code: 'OB-03', name: 'Room No. 3', building: 'OLD', roomNumber: 3, floor: 1, capacity: 70 },
  { id: 'OB-4', code: 'OB-04', name: 'Room No. 4', building: 'OLD', roomNumber: 4, floor: 1, capacity: 70 },
  { id: 'OB-5', code: 'OB-05', name: 'Room No. 5', building: 'OLD', roomNumber: 5, floor: 2, capacity: 70 },
  { id: 'OB-6', code: 'OB-06', name: 'Room No. 6', building: 'OLD', roomNumber: 6, floor: 2, capacity: 70 },
  { id: 'OB-7', code: 'OB-07', name: 'Room No. 7', building: 'OLD', roomNumber: 7, floor: 2, capacity: 70 },
  { id: 'OB-8', code: 'OB-08', name: 'Room No. 8', building: 'OLD', roomNumber: 8, floor: 2, capacity: 70 },

  // New School Building (7 Classrooms, Capacity: 52)
  { id: 'NB-1', code: 'NB-01', name: 'Room No. 1', building: 'NEW', roomNumber: 1, floor: 1, capacity: 52 },
  { id: 'NB-2', code: 'NB-02', name: 'Room No. 2', building: 'NEW', roomNumber: 2, floor: 1, capacity: 52 },
  { id: 'NB-3', code: 'NB-03', name: 'Room No. 3', building: 'NEW', roomNumber: 3, floor: 1, capacity: 52 },
  { id: 'NB-4', code: 'NB-04', name: 'Room No. 4', building: 'NEW', roomNumber: 4, floor: 2, capacity: 52 },
  { id: 'NB-5', code: 'NB-05', name: 'Room No. 5', building: 'NEW', roomNumber: 5, floor: 2, capacity: 52 },
  { id: 'NB-6', code: 'NB-06', name: 'Room No. 6', building: 'NEW', roomNumber: 6, floor: 2, capacity: 52 },
  { id: 'NB-7', code: 'NB-07', name: 'Room No. 7', building: 'NEW', roomNumber: 7, floor: 3, capacity: 52 },
];

export const INITIAL_PAPERS: Paper[] = [
  {
    id: 'P01',
    code: 'Paper-1',
    title: 'Bharatiya Nagarik Suraksha Sanhita 2023 (BNSS)',
    category: 'Legal Studies',
    totalTargetSessions: 46, // Scaled for 5 sessions/day (Original 55 @ 6/day)
    originalTargetSessions: 55,
    primaryTeacherIds: ['T1', 'T2', 'T3'], // 3 Teachers: T1 (Old), T2 (New), T3 (Floating)
    nearestPaperIds: ['P02', 'P04', 'P03'],
    color: '#3B82F6', // Blue
    description: 'Arrest procedures, custody, summons, charge sheet, trial procedures under BNSS 2023'
  },
  {
    id: 'P02',
    code: 'Paper-2',
    title: 'Bharatiya Nyaya Sanhita 2023 (BNS)',
    category: 'Legal Studies',
    totalTargetSessions: 56, // Scaled for 5 sessions/day (Original 67 @ 6/day)
    originalTargetSessions: 67,
    primaryTeacherIds: ['T4', 'T5', 'T6', 'T7'], // 4 Teachers: 2 Old (T4, T5), 2 New (T6, T7)
    nearestPaperIds: ['P01', 'P04', 'P03'],
    color: '#0284C7', // Sky Blue
    description: 'Offences against body, property, state, public tranquility under BNS 2023'
  },
  {
    id: 'P03',
    code: 'Paper-3',
    title: 'Central Minor Acts and Special Laws',
    category: 'Legal Studies',
    totalTargetSessions: 50, // Scaled for 5 sessions/day (Original 60 @ 6/day)
    originalTargetSessions: 60,
    primaryTeacherIds: ['T8', 'T9', 'T10'], // 3 Teachers: T8 (Old), T9 (New), T10 (Floating)
    nearestPaperIds: ['P01', 'P02', 'P04'],
    color: '#6366F1', // Indigo
    description: 'NDPS Act, POCSO Act, Arms Act, Motor Vehicles Act, Excise & Local Acts'
  },
  {
    id: 'P04',
    code: 'Paper-4',
    title: 'Bharatiya Sakshya Adhiniyam 2023 (BSA)',
    category: 'Legal Studies',
    totalTargetSessions: 23, // Scaled for 5 sessions/day (Original 28 @ 6/day)
    originalTargetSessions: 28,
    primaryTeacherIds: ['T11'], // 1 Teacher: T11 (Floating - serves both buildings)
    nearestPaperIds: ['P01', 'P02', 'P03'],
    color: '#8B5CF6', // Violet
    description: 'Admissibility, electronic evidence, burden of proof, expert witness under BSA 2023'
  },
  {
    id: 'P05',
    code: 'Paper-5',
    title: 'Forensics',
    category: 'Forensics & Investigation',
    totalTargetSessions: 34, // Scaled for 5 sessions/day (Original 41 @ 6/day)
    originalTargetSessions: 41,
    primaryTeacherIds: ['T12', 'T13'], // 2 Teachers: T12 (Old), T13 (New) - cross-backup with Paper-6 (ICT)
    nearestPaperIds: ['P06', 'P13', 'P07'],
    color: '#EC4899', // Pink
    description: 'Crime scene examination, ballistics, biology, DNA, fingerprint science, toxicology'
  },
  {
    id: 'P06',
    code: 'Paper-6',
    title: 'ICT and Cyber Investigation',
    category: 'Cyber & Technical',
    totalTargetSessions: 39, // Scaled for 5 sessions/day (Original 47 @ 6/day)
    originalTargetSessions: 47,
    primaryTeacherIds: ['T14', 'T15'], // 2 Teachers: T14 (Old), T15 (New) - cross-backup with Paper-5 (Forensics)
    nearestPaperIds: ['P05', 'P13'],
    color: '#06B6D4', // Cyan
    description: 'Cyber forensics, CDR/IPDR analysis, financial fraud, social media investigation'
  },
  {
    id: 'P07',
    code: 'Paper-7',
    title: 'Criminology and Crime Prevention',
    category: 'Criminology & Security',
    totalTargetSessions: 17, // Scaled for 5 sessions/day (Original 20 @ 6/day)
    originalTargetSessions: 20,
    primaryTeacherIds: ['T16'], // 1 Teacher: T16 (Floating) - cross-backup with Paper-8/Paper-9 (Police Admin)
    nearestPaperIds: ['P08', 'P09', 'P05'],
    color: '#F97316', // Orange
    description: 'Theories of crime, criminal psychology, juvenile delinquency, surveillance, preventive policing'
  },
  {
    id: 'P08',
    code: 'Paper-8',
    title: 'Police Organization and Administration',
    category: 'Police Administration',
    totalTargetSessions: 8, // Scaled for 5 sessions/day (Original 10 @ 6/day)
    originalTargetSessions: 10,
    primaryTeacherIds: ['T17'], // 1 Teacher: T17 (Floating) - cross-backup with Paper-7 (Criminology)
    nearestPaperIds: ['P07', 'P09', 'P10'],
    color: '#EAB308', // Yellow
    description: 'Organizational hierarchy, command structure, police manuals, disciplinary regulations'
  },
  {
    id: 'P09',
    code: 'Paper-9',
    title: 'Police Station Management',
    category: 'Police Administration',
    totalTargetSessions: 30, // Scaled for 5 sessions/day (Original 36 @ 6/day)
    originalTargetSessions: 36,
    primaryTeacherIds: ['T18', 'T19'], // 2 Teachers: T18 (Old), T19 (New) - cross-backup with Paper-7 Criminology
    nearestPaperIds: ['P08', 'P07', 'P10'],
    color: '#10B981', // Emerald
    description: 'GD entries, FIR registration, malkhana management, lockup rules, station records'
  },
  {
    id: 'P10',
    code: 'Paper-10',
    title: 'Personal Development',
    category: 'Behavioral & Leadership',
    totalTargetSessions: 40, // Scaled for 5 sessions/day (Original 48 @ 6/day)
    originalTargetSessions: 48,
    primaryTeacherIds: ['T20', 'T21'], // 2 Teachers: T20 (Old), T21 (New) - mutual absence backup
    nearestPaperIds: ['P12', 'P11', 'P08'],
    color: '#14B8A6', // Teal
    description: 'Leadership, stress management, public speaking, conflict resolution, mental fitness'
  },
  {
    id: 'P11',
    code: 'Paper-11',
    title: 'Internal Security and Public Order',
    category: 'Field & Public Order',
    totalTargetSessions: 38, // Scaled for 5 sessions/day (Original 45 @ 6/day)
    originalTargetSessions: 45,
    primaryTeacherIds: ['T22', 'T23'], // 2 Teachers: T22 (Old), T23 (New) - mutual absence backup
    nearestPaperIds: ['P09', 'P13', 'P07'],
    color: '#D97706', // Amber dark
    description: 'Riot control tactics, mob dispersal, VIP security, intelligence collection, counter-insurgency'
  },
  {
    id: 'P12',
    code: 'Paper-12',
    title: 'Ethics and Accountability',
    category: 'Behavioral & Ethics',
    totalTargetSessions: 54, // Scaled for 5 sessions/day (Original 65 @ 6/day)
    originalTargetSessions: 65,
    primaryTeacherIds: ['T24', 'T25', 'T26'], // 3 Teachers: T24 (Old), T25 (New), T26 (Floating backup)
    nearestPaperIds: ['P10', 'P08'],
    color: '#64748B', // Slate
    description: 'Police integrity, anti-corruption norms, human rights, custodial ethics, constitutional values'
  },
  {
    id: 'P13',
    code: 'Paper-13',
    title: 'Practical (Hands on)',
    category: 'Practical & Applied',
    totalTargetSessions: 188, // Scaled for 5 sessions/day (Original 226 @ 6/day)
    originalTargetSessions: 226,
    // As per user specification: Practical does not have fixed teachers; any available instructor can conduct practical classes!
    primaryTeacherIds: [],
    nearestPaperIds: ['P05', 'P06', 'P11'],
    color: '#84CC16', // Lime green
    description: 'Moot courts, crime scene simulations, CCTNS live entry, mob control drills, case diary drafting'
  },
];

export const INITIAL_TEACHERS: Teacher[] = [
  // Paper-1 (BNSS, 3 Teachers: 1 Old, 1 New, 1 Floating)
  {
    id: 'T1',
    code: 'T1',
    name: 'Insp. R. K. Sharma',
    designation: 'Senior Law Instructor',
    assignedBuilding: 'OLD',
    primaryPaperIds: ['P01'],
    backupPaperIds: ['P02', 'P03'],
    secondaryPaperIds: ['P02', 'P03'],
    maxDailyPeriods: 4,
    phone: '+91 94120 10001'
  },
  {
    id: 'T2',
    code: 'T2',
    name: 'Insp. Ajay Dev',
    designation: 'Procedural Law Instructor',
    assignedBuilding: 'NEW',
    primaryPaperIds: ['P01'],
    backupPaperIds: ['P02', 'P04'],
    secondaryPaperIds: ['P02', 'P04'],
    maxDailyPeriods: 4,
    phone: '+91 94120 10002'
  },
  {
    id: 'T3',
    code: 'T3',
    name: 'Insp. Sunita Rao',
    designation: 'Criminal Law Floating Instructor',
    assignedBuilding: 'FLOATING',
    primaryPaperIds: ['P01'],
    backupPaperIds: ['P02', 'P03'],
    secondaryPaperIds: ['P02', 'P03'],
    maxDailyPeriods: 4,
    phone: '+91 94120 10003'
  },

  // Paper-2 (BNS, 4 Teachers: 2 Old, 2 New)
  {
    id: 'T4',
    code: 'T4',
    name: 'SI Meenakshi Singh',
    designation: 'Substantive Law Specialist',
    assignedBuilding: 'OLD',
    primaryPaperIds: ['P02'],
    backupPaperIds: ['P01', 'P04'],
    secondaryPaperIds: ['P01', 'P04'],
    maxDailyPeriods: 3,
    phone: '+91 94120 10004'
  },
  {
    id: 'T5',
    code: 'T5',
    name: 'SI Rajesh Prasad',
    designation: 'Substantive Law Master',
    assignedBuilding: 'NEW',
    primaryPaperIds: ['P02'],
    backupPaperIds: ['P01', 'P04'],
    secondaryPaperIds: ['P01', 'P04'],
    maxDailyPeriods: 3,
    phone: '+91 94120 10005'
  },
  {
    id: 'T6',
    code: 'T6',
    name: 'Insp. Harinder Singh',
    designation: 'BNS Senior Instructor',
    assignedBuilding: 'OLD',
    primaryPaperIds: ['P02'],
    backupPaperIds: ['P01', 'P03'],
    secondaryPaperIds: ['P01', 'P03'],
    maxDailyPeriods: 4,
    phone: '+91 94120 10006'
  },
  {
    id: 'T7',
    code: 'T7',
    name: 'Insp. Santosh Mishra',
    designation: 'BNS Instructor Specialist',
    assignedBuilding: 'NEW',
    primaryPaperIds: ['P02'],
    backupPaperIds: ['P01', 'P03'],
    secondaryPaperIds: ['P01', 'P03'],
    maxDailyPeriods: 4,
    phone: '+91 94120 10007'
  },

  // Paper-3 (Central Minor Acts, 3 Teachers: 1 Old, 1 New, 1 Floating)
  {
    id: 'T8',
    code: 'T8',
    name: 'SI Vikash Chandra',
    designation: 'Central & Local Laws Instructor',
    assignedBuilding: 'OLD',
    primaryPaperIds: ['P03'],
    backupPaperIds: ['P01', 'P02'],
    secondaryPaperIds: ['P01', 'P02'],
    maxDailyPeriods: 3,
    phone: '+91 94120 10008'
  },
  {
    id: 'T9',
    code: 'T9',
    name: 'Insp. B. P. Tiwari',
    designation: 'Special Acts Specialist',
    assignedBuilding: 'NEW',
    primaryPaperIds: ['P03'],
    backupPaperIds: ['P01', 'P02'],
    secondaryPaperIds: ['P01', 'P02'],
    maxDailyPeriods: 4,
    phone: '+91 94120 10009'
  },
  {
    id: 'T10',
    code: 'T10',
    name: 'SI Narendra Verma',
    designation: 'Minor Acts Floating Master',
    assignedBuilding: 'FLOATING',
    primaryPaperIds: ['P03'],
    backupPaperIds: ['P01', 'P04'],
    secondaryPaperIds: ['P01', 'P04'],
    maxDailyPeriods: 3,
    phone: '+91 94120 10010'
  },

  // Paper-4 (BSA, 1 Teacher: Floating)
  {
    id: 'T11',
    code: 'T11',
    name: 'SI Balwant Chauhan',
    designation: 'Evidence Law & BSA Specialist',
    assignedBuilding: 'FLOATING',
    primaryPaperIds: ['P04'],
    backupPaperIds: ['P01', 'P02', 'P03'],
    secondaryPaperIds: ['P01', 'P02', 'P03'],
    maxDailyPeriods: 3,
    phone: '+91 94120 10011'
  },

  // Paper-5 (Forensics, 2 Teachers: 1 Old, 1 New)
  {
    id: 'T12',
    code: 'T12',
    name: 'Dr. Suresh Joshi',
    designation: 'Forensics Director',
    assignedBuilding: 'OLD',
    primaryPaperIds: ['P05'],
    backupPaperIds: ['P06', 'P04'],
    secondaryPaperIds: ['P06', 'P04'],
    maxDailyPeriods: 3,
    phone: '+91 94120 10012'
  },
  {
    id: 'T13',
    code: 'T13',
    name: 'SI Poonam Pathak',
    designation: 'Ballistics & Forensics Expert',
    assignedBuilding: 'NEW',
    primaryPaperIds: ['P05'],
    backupPaperIds: ['P06', 'P07'],
    secondaryPaperIds: ['P06', 'P07'],
    maxDailyPeriods: 3,
    phone: '+91 94120 10013'
  },

  // Paper-6 (ICT & Cyber Investigation, 2 Teachers: 1 Old, 1 New)
  {
    id: 'T14',
    code: 'T14',
    name: 'SI Rohit Malhotra',
    designation: 'Cyber Investigation Master',
    assignedBuilding: 'OLD',
    primaryPaperIds: ['P06'],
    backupPaperIds: ['P05', 'P09'],
    secondaryPaperIds: ['P05', 'P09'],
    maxDailyPeriods: 4,
    phone: '+91 94120 10014'
  },
  {
    id: 'T15',
    code: 'T15',
    name: 'SI Ankit Kumar',
    designation: 'Cyber Investigation Trainer',
    assignedBuilding: 'NEW',
    primaryPaperIds: ['P06'],
    backupPaperIds: ['P05', 'P09'],
    secondaryPaperIds: ['P05', 'P09'],
    maxDailyPeriods: 3,
    phone: '+91 94120 10015'
  },

  // Paper-7 (Criminology, 1 Teacher: Floating)
  {
    id: 'T16',
    code: 'T16',
    name: 'Insp. Deepak Tripathi',
    designation: 'Criminology & Crime Prevention Expert',
    assignedBuilding: 'FLOATING',
    primaryPaperIds: ['P07'],
    backupPaperIds: ['P08', 'P09'],
    secondaryPaperIds: ['P08', 'P09'],
    maxDailyPeriods: 4,
    phone: '+91 94120 10016'
  },

  // Paper-8 (Police Organization & Admin, 1 Teacher: Floating)
  {
    id: 'T17',
    code: 'T17',
    name: 'Insp. Vandana Shukla',
    designation: 'Police Organization & Admin Master',
    assignedBuilding: 'FLOATING',
    primaryPaperIds: ['P08'],
    backupPaperIds: ['P07', 'P09'],
    secondaryPaperIds: ['P07', 'P09'],
    maxDailyPeriods: 4,
    phone: '+91 94120 10017'
  },

  // Paper-9 (Police Station Management, 2 Teachers: 1 Old, 1 New)
  {
    id: 'T18',
    code: 'T18',
    name: 'SI Manoj K. Yadav',
    designation: 'Station Administration Instructor',
    assignedBuilding: 'OLD',
    primaryPaperIds: ['P09'],
    backupPaperIds: ['P07', 'P08'],
    secondaryPaperIds: ['P07', 'P08'],
    maxDailyPeriods: 3,
    phone: '+91 94120 10018'
  },
  {
    id: 'T19',
    code: 'T19',
    name: 'SI Preeti Mathur',
    designation: 'Station Records & Investigation Instructor',
    assignedBuilding: 'NEW',
    primaryPaperIds: ['P09'],
    backupPaperIds: ['P07', 'P08'],
    secondaryPaperIds: ['P07', 'P08'],
    maxDailyPeriods: 3,
    phone: '+91 94120 10019'
  },

  // Paper-10 (Personal Development, 2 Teachers: 1 Old, 1 New)
  {
    id: 'T20',
    code: 'T20',
    name: 'SI Geeta Rawat',
    designation: 'Personal Development Counselor',
    assignedBuilding: 'OLD',
    primaryPaperIds: ['P10'],
    backupPaperIds: ['P11', 'P12'],
    secondaryPaperIds: ['P11', 'P12'],
    maxDailyPeriods: 3,
    phone: '+91 94120 10020'
  },
  {
    id: 'T21',
    code: 'T21',
    name: 'SI Kavita Rathore',
    designation: 'Behavioral Skills & Leadership Counselor',
    assignedBuilding: 'NEW',
    primaryPaperIds: ['P10'],
    backupPaperIds: ['P11', 'P12'],
    secondaryPaperIds: ['P11', 'P12'],
    maxDailyPeriods: 3,
    phone: '+91 94120 10021'
  },

  // Paper-11 (Internal Security & Public Order, 2 Teachers: 1 Old, 1 New)
  {
    id: 'T22',
    code: 'T22',
    name: 'Insp. Ashok Kumar',
    designation: 'Internal Security & Public Order Master',
    assignedBuilding: 'OLD',
    primaryPaperIds: ['P11'],
    backupPaperIds: ['P09', 'P10'],
    secondaryPaperIds: ['P09', 'P10'],
    maxDailyPeriods: 4,
    phone: '+91 94120 10022'
  },
  {
    id: 'T23',
    code: 'T23',
    name: 'Insp. Gaurav Saxena',
    designation: 'Internal Security & Tactical Head',
    assignedBuilding: 'NEW',
    primaryPaperIds: ['P11'],
    backupPaperIds: ['P09', 'P10'],
    secondaryPaperIds: ['P09', 'P10'],
    maxDailyPeriods: 4,
    phone: '+91 94120 10023'
  },

  // Paper-12 (Ethics and Accountability, 3 Teachers: 1 Old, 1 New, 1 Floating backup)
  {
    id: 'T24',
    code: 'T24',
    name: 'SI Pradeep Kumar',
    designation: 'Ethics & Police Accountability Instructor',
    assignedBuilding: 'NEW',
    primaryPaperIds: ['P12'],
    backupPaperIds: ['P10', 'P08'],
    secondaryPaperIds: ['P10', 'P08'],
    maxDailyPeriods: 3,
    phone: '+91 94120 10024'
  },
  {
    id: 'T25',
    code: 'T25',
    name: 'Insp. K. K. Pandey',
    designation: 'Ethics, Integrity & Values Trainer',
    assignedBuilding: 'OLD',
    primaryPaperIds: ['P12'],
    backupPaperIds: ['P10', 'P08'],
    secondaryPaperIds: ['P10', 'P08'],
    maxDailyPeriods: 4,
    phone: '+91 94120 10025'
  },
  {
    id: 'T26',
    code: 'T26',
    name: 'Insp. R. S. Negi',
    designation: 'Ethics & Accountability Floating Master',
    assignedBuilding: 'FLOATING',
    primaryPaperIds: ['P12'],
    backupPaperIds: ['P10', 'P11'],
    secondaryPaperIds: ['P10', 'P11'],
    maxDailyPeriods: 4,
    phone: '+91 94120 10026'
  },
];

export const PERIOD_TIMINGS = [
  { period: 1, label: 'Period 1', time: '09:40 - 10:20', duration: '40 min' },
  { period: 2, label: 'Period 2', time: '10:25 - 11:05', duration: '40 min' },
  { period: 3, label: 'Period 3', time: '11:10 - 11:50', duration: '40 min' },
  { period: 4, label: 'Period 4', time: '12:05 - 12:45', duration: '40 min' },
  { period: 5, label: 'Period 5', time: '12:50 - 13:30', duration: '40 min' },
];
