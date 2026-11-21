/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppSettings, BrowserPrintConfig, BuildingInfo, Classroom, ColumnConfig, Paper, PracticalSubject, ReportPageSetupConfig, RoutineRuleConfig, Teacher } from '../types/index.ts';

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
    description: '7 Classrooms (Room No. 9 to Room No. 15), Capacity 52 candidates each'
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
  // Note: Rule 1 (Zero Double-Booking) and Rule 2 (Absentee Exclusion)
  // are inviolable core constraints and are always active (never toggleable).
  // Teacher daily max periods are enforced directly from Instructor Mapping.
  // ==========================================
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
    key: 'enableBuildingChangeGapPeriod3To4Exemption',
    ruleNumber: '4A',
    title: '4A. Exclude Period 3 to Period 4 Transit from Mandatory Gap (Recess Break)',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'P3->P4 Recess Transit',
    tierNumber: 1,
    dependsOn: 'enableBuildingChangeGap',
    disabledHint: 'Available only when Rule 4 is ON',
    description:
      'Available only when Rule 4 is ON. When enabled, instructors changing buildings between Period 3 and Period 4 are exempt from the mandatory 1-period gap because the 15-minute recess break (11:50 - 12:05) provides ample travel time across campus.',
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
    key: 'enableInstructorDesignatedOffPeriods',
    ruleNumber: '7',
    title: '7. Strict Instructor Designated Off-Period Protection (Excuse Rule)',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Excuse Protection',
    tierNumber: 1,
    description:
      'Strictly protects designated off/excused periods (Period 1 to 5) configured for instructors in Master Setup or Teacher Mapping. Excused instructors are never scheduled during their designated off periods.',
  },
  {
    key: 'enableTeacherLoadEqualizationPriority',
    ruleNumber: 8,
    title: '8. Teacher Load Equalization Priority (Teacher-First Detailment)',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Teacher-First Equalizer',
    tierNumber: 1,
    description:
      'Forces equal sessions across all instructors regardless of classroom/paper quotas. Detailment prioritizes instructors with fewer cumulative sessions. In any classroom, instructors of the same paper category will not repeat. Curriculum targets are bypassed, subject is filled by teacher primary paper, and teachers are placed in classrooms with lowest prior deployments.',
  },
  {
    key: 'enablePracticalConsecutiveDoublePeriodLimit',
    ruleNumber: 9,
    title: '9. Practical Consecutive Double-Period & Daily Quota Rule',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Practical Block 2x2=4',
    tierNumber: 1,
    description:
      'Jab practical sessions active hon: (1) Practical aamtaur par 2 consecutive periods (Period 2 & 3 ya Period 4 & 5) me detail hota hai, aur single-period option se 1 period ka practical bhi configure ho sakta hai. (2) Ek classroom ek din me max 4 practical periods le sakti hai (alag-alag practical subjects ke sath). (3) Single-period practical 1 period count karta hai aur double-period practical 2 periods count karta hai teacher workload equalization me.',
  },
  {
    key: 'enableSinglePeriodPractical',
    ruleNumber: '9A',
    title: '9A. Single-Period (1-Period) Practical Option & Flexibility',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Practical 1P / 2P Option',
    tierNumber: 1,
    description:
      'Practical classes aamtaur par 2 consecutive periods (P2-P3 ya P4-P5) ki hoti hain, par kuch practical sessions 1-period (single period) ke bhi ho sakte hain. Is option/rule ke enable hone par practical ko 1 period ya 2 period ke roop me configure kiya ja sakta hai, jisse room schedule aur faculty deployment workload accurately 1 ya 2 periods ke hisab se distribute hota hai.',
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
    key: 'enableUnvisitedRoomTeacherPrioritization',
    ruleNumber: 22,
    title: '22. Unvisited Classroom Instructor Prioritization & Exposure Balance',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Room Exposure & Balance',
    tierNumber: 3,
    description:
      'Prioritizes assigning instructors to classrooms they have never visited (0 visits), and strictly enforces the classroom exposure balance cap so that the difference between the most-visited and least-visited classroom for any instructor never exceeds 2.',
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
  enableBuildingChangeGapPeriod3To4Exemption: true,
  enableRoomQuotaCompletionLock: true,
  enableMaxOnePeriodPerSubjectPerRoomDaily: true,
  enableMaxRoomDailyLimit: false,
  enableNonConsecutiveGapForSameSubject: false,
  enableDailyWorkloadMaxCap: true,
  enableInstructorDesignatedOffPeriods: true,
  enableTeacherLoadEqualizationPriority: false,
  enablePracticalConsecutiveDoublePeriodLimit: true,
  enableSinglePeriodPractical: true,

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
  enableUnvisitedRoomTeacherPrioritization: true,
  enablePracticalFlexible: true,
  enableCaravanFlow: false,
};

/**
 * Subject detailment rules (Tier 2: Curriculum Progression).
 * When Rule 8 (Teacher Load Equalization) is ON, these rules are unavailable.
 */
export const SUBJECT_DETAILMENT_RULES: (keyof RoutineRuleConfig)[] = [
  'enableClassroomSubjectEqualization',
  'enableSubjectFacultyLoadBalancing',
  'enablePaperRotationalFlow',
  'enableProportionalRemainingRatio',
  'enableSubjectPriorityTiers',
  'enableGuaranteedPriorityPeriods',
  'enableDayToDayProgression',
];

/**
 * Teacher-specific detailment rules (Tier 3: Teacher Workload & Placement).
 * When Rule 8 (Teacher Load Equalization) is OFF, these rules are unavailable.
 */
export const TEACHER_DETAILMENT_RULES: (keyof RoutineRuleConfig)[] = [
  'enableWorkloadEqualization',
  'enableDailyWorkloadSoftCap',
  'enableUnvisitedRoomTeacherPrioritization',
  'enableCaravanFlow',
];

/**
 * Returns whether a given rule is currently disabled/locked based on its dependencies
 * and Rule 8 mutual exclusivity.
 */
export function isRuleDisabled(key: keyof RoutineRuleConfig, rules: RoutineRuleConfig): boolean {
  // Mutual exclusivity between Teacher-First (Rule 8) and Curriculum-First detailment:
  if (rules.enableTeacherLoadEqualizationPriority) {
    // When Rule 8 is ON: Subject detailment rules (Rules 10-16) are unavailable
    if (SUBJECT_DETAILMENT_RULES.includes(key)) return true;
  } else {
    // When Rule 8 is OFF: Teacher-specific detailment rules (Rules 17, 18, 22, 24) are unavailable
    if (TEACHER_DETAILMENT_RULES.includes(key)) return true;
  }

  if (key === 'enableBuildingChangeGapPeriod3To4Exemption') {
    // Rule 4A is disabled when Rule 4 is OFF
    return !rules.enableBuildingChangeGap;
  }
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
 * Returns a human-friendly explanation of why a rule is locked/unavailable.
 */
export function getRuleDisabledHint(key: keyof RoutineRuleConfig, rules: RoutineRuleConfig): string | undefined {
  if (rules.enableTeacherLoadEqualizationPriority && SUBJECT_DETAILMENT_RULES.includes(key)) {
    return 'Unavailable: Teacher-First Equalization (Rule 8) is ON';
  }
  if (!rules.enableTeacherLoadEqualizationPriority && TEACHER_DETAILMENT_RULES.includes(key)) {
    return 'Unavailable: Rule 8 (Teacher-First Equalization) is OFF (Curriculum-First Mode)';
  }
  if (key === 'enableBuildingChangeGapPeriod3To4Exemption') {
    return 'Available only when Rule 4 is ON';
  }
  if (key === 'enableMaxRoomDailyLimit') {
    return 'Available only when Rule 6 is OFF';
  }
  if (key === 'enableNonConsecutiveGapForSameSubject') {
    return 'Available only when Rule 6 is OFF and Rule 6A is ON';
  }
  if (key === 'replaceWithAvailableSubjectIfNoPrimary') {
    return 'Available only when Rule 19 (No Substitute) is ON';
  }
  return undefined;
}

/**
 * Normalizes rule configuration to guarantee that dependent and mutually exclusive rules
 * are kept inactive whenever their prerequisites are not met.
 * Also permanently enforces inviolable core rules (Rule 1 & Rule 2).
 */
export function normalizeRuleConfig(rules: Partial<RoutineRuleConfig> = {}): RoutineRuleConfig {
  const merged: RoutineRuleConfig = {
    ...DEFAULT_ROUTINE_RULES,
    ...rules,
  };

  // Rule 1 & Rule 2 are inviolable core constraints (always enforced)
  merged.enableZeroDoubleBooking = true;
  merged.enableStrictAbsenteeExclusion = true;
  merged.enableDailyWorkloadMaxCap = true;

  // Mutual exclusivity between Rule 8 (Teacher-First) and Curriculum-First rules:
  if (merged.enableTeacherLoadEqualizationPriority) {
    // Rule 8 is ON: deactivate subject detailment rules
    for (const k of SUBJECT_DETAILMENT_RULES) {
      (merged as any)[k] = false;
    }
  } else {
    // Rule 8 is OFF: deactivate teacher-specific detailment rules
    for (const k of TEACHER_DETAILMENT_RULES) {
      (merged as any)[k] = false;
    }
  }

  // Rule 4 -> Rule 4A dependency
  if (!merged.enableBuildingChangeGap) {
    merged.enableBuildingChangeGapPeriod3To4Exemption = false;
  } else if (merged.enableBuildingChangeGapPeriod3To4Exemption === undefined) {
    merged.enableBuildingChangeGapPeriod3To4Exemption = true;
  }

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
  const result: any = {
    ...DEFAULT_ROUTINE_RULES,
    ...stored,
  };
  if (result.enableUnvisitedRoomTeacherPrioritization === undefined) {
    result.enableUnvisitedRoomTeacherPrioritization = true;
  }
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

  // New School Building (7 Classrooms, Capacity: 52, Room No. 9 to Room No. 15)
  { id: 'NB-1', code: 'NB-01', name: 'Room No. 9', building: 'NEW', roomNumber: 9, floor: 1, capacity: 52 },
  { id: 'NB-2', code: 'NB-02', name: 'Room No. 10', building: 'NEW', roomNumber: 10, floor: 1, capacity: 52 },
  { id: 'NB-3', code: 'NB-03', name: 'Room No. 11', building: 'NEW', roomNumber: 11, floor: 1, capacity: 52 },
  { id: 'NB-4', code: 'NB-04', name: 'Room No. 12', building: 'NEW', roomNumber: 12, floor: 2, capacity: 52 },
  { id: 'NB-5', code: 'NB-05', name: 'Room No. 13', building: 'NEW', roomNumber: 13, floor: 2, capacity: 52 },
  { id: 'NB-6', code: 'NB-06', name: 'Room No. 14', building: 'NEW', roomNumber: 14, floor: 2, capacity: 52 },
  { id: 'NB-7', code: 'NB-07', name: 'Room No. 15', building: 'NEW', roomNumber: 15, floor: 3, capacity: 52 },
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
    primaryTeacherIds: ['T24', 'T25', 'T26', 'T27'], // 4 Teachers: T24 (New), T25 (Old), T26 (Floating), T27 (Floating)
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
  {
    id: 'P14',
    code: 'Paper-14',
    title: 'Examination / Assessment',
    titleHi: 'परीक्षा / मूल्यांकन',
    category: 'Examination & Assessment',
    categoryHi: 'परीक्षा एवं मूल्यांकन',
    totalTargetSessions: 30, // 30 Exam sessions as specified
    originalTargetSessions: 30,
    // Flexible: Any available instructor can be detailed for exam supervision
    primaryTeacherIds: [],
    nearestPaperIds: [],
    color: '#DC2626', // Crimson / Red
    description: 'Weekly / Module End Examination, Test and Assessment Session',
    theoryOrPractical: 'EXAM',
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
  {
    id: 'T27',
    code: 'T27',
    name: 'SI(AB) Biswajit Deb',
    designation: 'Ethics',
    assignedBuilding: 'FLOATING',
    primaryPaperIds: ['P12'],
    backupPaperIds: ['P10', 'P08'],
    secondaryPaperIds: ['P10', 'P08'],
    maxDailyPeriods: 3,
    phone: '+91 747 914 2044',
    status: 'ACTIVE'
  },
];

export const PERIOD_TIMINGS = [
  { period: 1, label: 'Period 1', time: '09:40 - 10:20', duration: '40 min' },
  { period: 2, label: 'Period 2', time: '10:25 - 11:05', duration: '40 min' },
  { period: 3, label: 'Period 3', time: '11:10 - 11:50', duration: '40 min' },
  { period: 4, label: 'Period 4', time: '12:05 - 12:45', duration: '40 min' },
  { period: 5, label: 'Period 5', time: '12:50 - 13:30', duration: '40 min' },
];

export const APP_DEVELOPER_MAINTAINER = 'Abdul Barique Ansari';

export const DEFAULT_BROWSER_PRINT_CONFIG: BrowserPrintConfig = {
  orientation: 'landscape',
  paperSize: 'a4',
  showTimings: true,
  showCapacities: true,
  showTeacherCodes: true,
  showSubjectCodes: true,
  showPriorityBadge: true,
  showSubstituteBadge: true,
  showSessionCount: true,
  showHeader: true,
  showSignatures: true,
  showReserveTable: true,
  showLeaveTable: true,
  customTitle: 'DAILY INDOOR CLASS ROUTINE & INSTRUCTOR ASSIGNMENT MASTER SHEET',
  customSubtitle: '15 Classrooms (8 Old Building + 7 New Building) · 75 Daily Slots',
};

export const DEFAULT_REPORT_PAGE_CONFIGS: Record<string, ReportPageSetupConfig> = {
  'indoor-routine': {
    id: 'indoor-routine',
    name: 'Daily Indoor Class Routine Master Sheet',
    enabled: true,
    orientation: 'landscape',
    paperSize: 'a4',
    includeHeader: true,
    includeSignatures: true,
    columns: [
      { key: 'roomName', defaultLabel: 'Room Name', customLabel: 'Room Name', enabled: true },
      { key: 'roomCode', defaultLabel: 'Room Code', customLabel: 'Room Code', enabled: true },
      { key: 'building', defaultLabel: 'Building', customLabel: 'Building', enabled: true },
      { key: 'capacity', defaultLabel: 'Capacity', customLabel: 'Capacity', enabled: true },
      { key: 'p1', defaultLabel: 'Period 1 (09:40-10:20)', customLabel: 'Period 1 (09:40-10:20)', enabled: true },
      { key: 'p2', defaultLabel: 'Period 2 (10:25-11:05)', customLabel: 'Period 2 (10:25-11:05)', enabled: true },
      { key: 'p3', defaultLabel: 'Period 3 (11:10-11:50)', customLabel: 'Period 3 (11:10-11:50)', enabled: true },
      { key: 'p4', defaultLabel: 'Period 4 (12:05-12:45)', customLabel: 'Period 4 (12:05-12:45)', enabled: true },
      { key: 'p5', defaultLabel: 'Period 5 (12:50-13:30)', customLabel: 'Period 5 (12:50-13:30)', enabled: true },
    ],
  },
  'session-counter': {
    id: 'session-counter',
    name: 'Session Counter (Room-wise Subject Progress)',
    enabled: true,
    orientation: 'landscape',
    paperSize: 'a4',
    includeHeader: true,
    includeSignatures: true,
    columns: [
      { key: 'roomName', defaultLabel: 'Room Name', customLabel: 'Room Name', enabled: true },
      { key: 'building', defaultLabel: 'Building', customLabel: 'Building', enabled: true },
      { key: 'paperCode', defaultLabel: 'Paper Code', customLabel: 'Paper Code', enabled: true },
      { key: 'paperTitle', defaultLabel: 'Paper Title', customLabel: 'Paper Title', enabled: true },
      { key: 'targetSessions', defaultLabel: 'Target Sessions', customLabel: 'Target Sessions', enabled: true },
      { key: 'pastCompleted', defaultLabel: 'Past Completed', customLabel: 'Past Completed', enabled: true },
      { key: 'todayScheduled', defaultLabel: 'Today Scheduled', customLabel: 'Today Scheduled', enabled: true },
      { key: 'totalCompleted', defaultLabel: 'Total Completed', customLabel: 'Total Completed', enabled: true },
      { key: 'remainingQuota', defaultLabel: 'Remaining Quota', customLabel: 'Remaining Quota', enabled: true },
      { key: 'progressPercent', defaultLabel: 'Progress %', customLabel: 'Progress %', enabled: true },
    ],
  },
  'deployment-tracker': {
    id: 'deployment-tracker',
    name: 'Instructor Deployment Tracker (Classroom Visits)',
    enabled: true,
    orientation: 'landscape',
    paperSize: 'a4',
    includeHeader: true,
    includeSignatures: true,
    columns: [
      { key: 'teacherCode', defaultLabel: 'Teacher Code', customLabel: 'Teacher Code', enabled: true },
      { key: 'teacherName', defaultLabel: 'Instructor Name', customLabel: 'Instructor Name', enabled: true },
      { key: 'roomVisits', defaultLabel: 'Classroom Visit Columns', customLabel: 'Classrooms Visited', enabled: true },
      { key: 'totalSessions', defaultLabel: 'Total Sessions', customLabel: 'Total Sessions', enabled: true },
    ],
  },
  'instructor-ledger': {
    id: 'instructor-ledger',
    name: 'Instructor Academic Workload Ledger',
    enabled: true,
    orientation: 'portrait',
    paperSize: 'a4',
    includeHeader: true,
    includeSignatures: true,
    columns: [
      { key: 'slNo', defaultLabel: 'Sl No', customLabel: 'Sl No', enabled: true },
      { key: 'teacherCode', defaultLabel: 'Teacher Code', customLabel: 'Teacher Code', enabled: true },
      { key: 'teacherName', defaultLabel: 'Instructor Name', customLabel: 'Instructor Name', enabled: true },
      { key: 'primarySubject', defaultLabel: 'Primary Subject(s)', customLabel: 'Primary Subject(s)', enabled: true },
      { key: 'pastLoad', defaultLabel: 'Past Days Load', customLabel: 'Past Days Load', enabled: true },
      { key: 'todayLoad', defaultLabel: "Today's Load", customLabel: "Today's Load", enabled: true },
      { key: 'cumulativeTotal', defaultLabel: 'Cumulative Total', customLabel: 'Cumulative Total', enabled: true },
      { key: 'dailyAverage', defaultLabel: 'Daily Average', customLabel: 'Daily Average', enabled: true },
      { key: 'equalizationStatus', defaultLabel: 'Equalization Status', customLabel: 'Equalization Status', enabled: true },
    ],
  },
  'instructor-duty': {
    id: 'instructor-duty',
    name: 'Instructor Daily Duty Roster',
    enabled: true,
    orientation: 'landscape',
    paperSize: 'a4',
    includeHeader: true,
    includeSignatures: true,
    columns: [
      { key: 'teacherCode', defaultLabel: 'Teacher Code', customLabel: 'Teacher Code', enabled: true },
      { key: 'teacherName', defaultLabel: 'Instructor Name', customLabel: 'Instructor Name', enabled: true },
      { key: 'p1', defaultLabel: 'Period 1 (09:40-10:20)', customLabel: 'Period 1 (09:40-10:20)', enabled: true },
      { key: 'p2', defaultLabel: 'Period 2 (10:25-11:05)', customLabel: 'Period 2 (10:25-11:05)', enabled: true },
      { key: 'p3', defaultLabel: 'Period 3 (11:10-11:50)', customLabel: 'Period 3 (11:10-11:50)', enabled: true },
      { key: 'p4', defaultLabel: 'Period 4 (12:05-12:45)', customLabel: 'Period 4 (12:05-12:45)', enabled: true },
      { key: 'p5', defaultLabel: 'Period 5 (12:50-13:30)', customLabel: 'Period 5 (12:50-13:30)', enabled: true },
      { key: 'totalPeriods', defaultLabel: 'Total Periods Today', customLabel: 'Total Periods Today', enabled: true },
      { key: 'facultyStatus', defaultLabel: 'Faculty Status', customLabel: 'Faculty Status', enabled: true },
    ],
  },
  'instructor-mapping': {
    id: 'instructor-mapping',
    name: 'Instructor Mapping Matrix (Faculty Profiles)',
    enabled: true,
    orientation: 'landscape',
    paperSize: 'a4',
    includeHeader: true,
    includeSignatures: true,
    columns: [
      { key: 'slNo', defaultLabel: 'Sl No', customLabel: 'Sl No', enabled: true },
      { key: 'teacherCode', defaultLabel: 'Teacher Code', customLabel: 'Teacher Code', enabled: true },
      { key: 'teacherName', defaultLabel: 'Instructor Name', customLabel: 'Instructor Name', enabled: true },
      { key: 'designation', defaultLabel: 'Designation', customLabel: 'Designation', enabled: true },
      { key: 'campusBase', defaultLabel: 'Campus Base', customLabel: 'Campus Base', enabled: true },
      { key: 'primaryPapers', defaultLabel: 'Primary Paper Assignments', customLabel: 'Primary Paper Assignments', enabled: true },
      { key: 'backupPapers', defaultLabel: 'Backup Papers', customLabel: 'Backup Papers', enabled: true },
      { key: 'secondaryPapers', defaultLabel: 'Secondary Papers', customLabel: 'Secondary Papers', enabled: true },
      { key: 'maxDailyLimit', defaultLabel: 'Max Daily Limit', customLabel: 'Max Daily Limit', enabled: true },
      { key: 'contactNumber', defaultLabel: 'Contact Number', customLabel: 'Contact Number', enabled: true },
      { key: 'facultyStatus', defaultLabel: 'Faculty Status', customLabel: 'Faculty Status', enabled: true },
    ],
  },
  'subject-main-teachers': {
    id: 'subject-main-teachers',
    name: 'Subject-wise Primary Instructors Directory',
    enabled: true,
    orientation: 'portrait',
    paperSize: 'a4',
    includeHeader: true,
    includeSignatures: true,
    columns: [
      { key: 'paperCode', defaultLabel: 'Paper Code', customLabel: 'Paper Code', enabled: true },
      { key: 'subjectTitle', defaultLabel: 'Subject Title', customLabel: 'Subject Title', enabled: true },
      { key: 'category', defaultLabel: 'Category', customLabel: 'Category', enabled: true },
      { key: 'quotaSessions', defaultLabel: 'Quota Sessions', customLabel: 'Quota Sessions', enabled: true },
      { key: 'primaryInstructors', defaultLabel: 'Main / Primary Instructors', customLabel: 'Main / Primary Instructors', enabled: true },
      { key: 'mainCount', defaultLabel: 'Main Faculty Count', customLabel: 'Main Faculty Count', enabled: true },
      { key: 'teacherCodes', defaultLabel: 'Teacher Codes', customLabel: 'Teacher Codes', enabled: true },
      { key: 'contacts', defaultLabel: 'Instructor Contact Numbers', customLabel: 'Instructor Contact Numbers', enabled: true },
    ],
  },
  'subject-hierarchy': {
    id: 'subject-hierarchy',
    name: 'Subject-wise Staffing Hierarchy (Main + Backups)',
    enabled: true,
    orientation: 'portrait',
    paperSize: 'a4',
    includeHeader: true,
    includeSignatures: true,
    columns: [
      { key: 'paperCode', defaultLabel: 'Paper Code', customLabel: 'Paper Code', enabled: true },
      { key: 'subjectTitle', defaultLabel: 'Subject Title', customLabel: 'Subject Title', enabled: true },
      { key: 'primaryFaculty', defaultLabel: 'Main Primary Teacher(s)', customLabel: 'Main Primary Teacher(s)', enabled: true },
      { key: 'backup1', defaultLabel: 'Backup Slot 1', customLabel: 'Backup Slot 1', enabled: true },
      { key: 'backup2', defaultLabel: 'Backup Slot 2', customLabel: 'Backup Slot 2', enabled: true },
      { key: 'secondaryFaculty', defaultLabel: 'Secondary Eligible Pool', customLabel: 'Secondary Eligible Pool', enabled: true },
      { key: 'totalFacultyCount', defaultLabel: 'Total Faculty Strength', customLabel: 'Total Faculty Strength', enabled: true },
    ],
  },
  'instructor-directory': {
    id: 'instructor-directory',
    name: 'Faculty Contact & Telephone Directory',
    enabled: true,
    orientation: 'portrait',
    paperSize: 'a4',
    includeHeader: true,
    includeSignatures: true,
    columns: [
      { key: 'slNo', defaultLabel: 'Sl No', customLabel: 'Sl No', enabled: true },
      { key: 'teacherCode', defaultLabel: 'Teacher Code', customLabel: 'Teacher Code', enabled: true },
      { key: 'teacherName', defaultLabel: 'Instructor Name', customLabel: 'Instructor Name', enabled: true },
      { key: 'rank', defaultLabel: 'Rank / Designation', customLabel: 'Rank / Designation', enabled: true },
      { key: 'phone', defaultLabel: 'Mobile / Telephone Number', customLabel: 'Mobile / Telephone Number', enabled: true },
      { key: 'campusBase', defaultLabel: 'Campus Base', customLabel: 'Campus Base', enabled: true },
      { key: 'primaryCode', defaultLabel: 'Primary Subject Code', customLabel: 'Primary Subject Code', enabled: true },
      { key: 'primaryTitle', defaultLabel: 'Subject Title', customLabel: 'Subject Title', enabled: true },
      { key: 'dutyStatus', defaultLabel: 'Duty Status', customLabel: 'Duty Status', enabled: true },
      { key: 'email', defaultLabel: 'Official Email', customLabel: 'Official Email', enabled: true },
    ],
  },
  'instructor-unavailability': {
    id: 'instructor-unavailability',
    name: 'Faculty Unavailability Incident Log',
    enabled: true,
    orientation: 'landscape',
    paperSize: 'a4',
    includeHeader: true,
    includeSignatures: true,
    columns: [
      { key: 'slNo', defaultLabel: 'Sl No', customLabel: 'Sl No', enabled: true },
      { key: 'teacherCode', defaultLabel: 'Teacher Code', customLabel: 'Teacher Code', enabled: true },
      { key: 'teacherName', defaultLabel: 'Instructor Name', customLabel: 'Instructor Name', enabled: true },
      { key: 'designation', defaultLabel: 'Designation', customLabel: 'Designation', enabled: true },
      { key: 'campusBase', defaultLabel: 'Campus Base', customLabel: 'Campus Base', enabled: true },
      { key: 'totalDays', defaultLabel: 'Total Unavailable Days', customLabel: 'Total Unavailable Days', enabled: true },
      { key: 'leave', defaultLabel: 'Leave (Casual/Earned)', customLabel: 'Leave (Casual/Earned)', enabled: true },
      { key: 'duty', defaultLabel: 'Special Duty', customLabel: 'Special Duty', enabled: true },
      { key: 'sick', defaultLabel: 'Sick / Medical', customLabel: 'Sick / Medical', enabled: true },
      { key: 'rest', defaultLabel: 'Rest (Standby Reserve)', customLabel: 'Rest (Standby Reserve)', enabled: true },
      { key: 'absent', defaultLabel: 'Absent (Uninformed)', customLabel: 'Absent (Uninformed)', enabled: true },
      { key: 'attendanceRate', defaultLabel: 'Attendance Rate (%)', customLabel: 'Attendance Rate (%)', enabled: true },
      { key: 'remarksLog', defaultLabel: 'Date-wise Details & Remarks Log', customLabel: 'Date-wise Details & Remarks Log', enabled: true },
    ],
  },
  'unavailability-incident-log': {
    id: 'unavailability-incident-log',
    name: 'Unavailability Incident Log (Chronological)',
    enabled: true,
    orientation: 'landscape',
    paperSize: 'a4',
    includeHeader: true,
    includeSignatures: true,
    columns: [
      { key: 'slNo', defaultLabel: 'Sl No', customLabel: 'Sl No', enabled: true },
      { key: 'routineDay', defaultLabel: 'Routine Day', customLabel: 'Routine Day', enabled: true },
      { key: 'routineDate', defaultLabel: 'Routine Date', customLabel: 'Routine Date', enabled: true },
      { key: 'teacherCode', defaultLabel: 'Teacher Code', customLabel: 'Teacher Code', enabled: true },
      { key: 'teacherName', defaultLabel: 'Instructor Name', customLabel: 'Instructor Name', enabled: true },
      { key: 'designation', defaultLabel: 'Designation', customLabel: 'Designation', enabled: true },
      { key: 'type', defaultLabel: 'Unavailability Type', customLabel: 'Unavailability Type', enabled: true },
      { key: 'periods', defaultLabel: 'Period(s) Affected', customLabel: 'Period(s) Affected', enabled: true },
      { key: 'remark', defaultLabel: 'Official Remark / Reason', customLabel: 'Official Remark / Reason', enabled: true },
    ],
  },
};

/**
 * Initial practical subject modules (Paper-13 breakdown).
 * The sum of target sessions equals Paper-13's total target quota of 188 sessions.
 */
export const INITIAL_PRACTICAL_SUBJECTS: PracticalSubject[] = [
  {
    id: 'PRAC-01',
    code: 'PRAC-01',
    name: 'Computer Lab & CCTNS Live Data Entry',
    targetSessions: 48,
    color: '#0284c7', // Sky
    description: 'CCTNS portal training, online FIR registration, digital GD entry, ICJS integration & case tracking',
  },
  {
    id: 'PRAC-02',
    code: 'PRAC-02',
    name: 'Crime Scene Management & Forensics Lab',
    targetSessions: 46,
    color: '#16a34a', // Green
    description: 'Crime scene cordon, physical evidence collection, fingerprint lifting, ballistics & forensic kit handling',
  },
  {
    id: 'PRAC-03',
    code: 'PRAC-03',
    name: 'Moot Court, Legal Procedures & Case Diary Drafting',
    targetSessions: 46,
    color: '#d97706', // Amber
    description: 'Mock court examination, cross-examination, case diary (CD) drafting, seizure list & inquest preparation',
  },
  {
    id: 'PRAC-04',
    code: 'PRAC-04',
    name: 'Cyber Crime, Digital Evidence & IT',
    targetSessions: 48,
    color: '#7c3aed', // Purple
    description: 'Digital evidence seizure (65B certification), mobile extraction, CDR/IPDR analysis & cyber fraud investigation',
  },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  institutionName: 'STC, SAP 4th Bn',
  battalionUnit: 'Special Armed Police 4th Battalion',
  trainingCenterName: 'Specialised Training Centre',
  subTitle: 'Daily Indoor Class Routine & Instructor Assignment Master Sheet',
  location: 'SAP 4th Bn Campus',
  address: 'Kasba, Purnea, Bihar - 854330',
  signatoryDesignation: 'O/C STC (Indoor)',
  tagline: 'Daily Indoor Class Routine Scheduler · 15 Rooms · Multi-Instructor Matrix',
  activeRoutineId: '',
  language: 'en',
  adminPassword: 'admin123',
  downloadsConfig: {
    reports: { ...DEFAULT_REPORT_PAGE_CONFIGS },
    browserPrint: { ...DEFAULT_BROWSER_PRINT_CONFIG },
  },
  practicalSubjects: [...INITIAL_PRACTICAL_SUBJECTS],
};
