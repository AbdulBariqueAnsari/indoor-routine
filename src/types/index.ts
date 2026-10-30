/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Building = 'OLD' | 'NEW' | string;

export interface BuildingInfo {
  id: string; // e.g. 'OLD', 'NEW', 'ANNEX'
  name: string; // e.g. 'Old School Building', 'New School Building'
  code: string; // e.g. 'OB', 'NB'
  floors: number;
  description?: string;
}

export type SubjectPriorityTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL' | 'EXCLUDE';

export type UnavailabilityType = 'ABSENT' | 'LEAVE' | 'DUTY' | 'SICK';

export interface UnavailableInstructor {
  teacherId: string;
  type: UnavailabilityType; // 'ABSENT' | 'LEAVE' | 'DUTY' | 'SICK'
  remark?: string;
  date?: string;
}

export interface RoutineRuleConfig {
  // === TIER 1: Inviolable Operational Constraints (Hard Rules: Priority Tier 1: Rules 1, 2, 3, 4, 5, 6, 6A, 6B, 7) ===
  enableZeroDoubleBooking: boolean; // Rule 1: Zero Double-Booking: Instructor cannot teach in 2 rooms at the same time
  enableStrictAbsenteeExclusion: boolean; // Rule 2: Strict Absentee/Leave Exclusion: Absent/Leave/Duty/Sick teachers strictly excluded
  enableStrictBuildingBinding: boolean; // Rule 3: Strict Building Binding (Old strictly in OB, New strictly in NB; only Floating can cross)
  enableBuildingChangeGap: boolean; // Rule 4: Mandatory 1-Period Transit Gap on Floating Building Transition
  enableRoomQuotaCompletionLock: boolean; // Rule 5: 100% Quota Lockout: Room cannot receive paper once reaching 100% target quota
  enableMaxOnePeriodPerSubjectPerRoomDaily: boolean; // Rule 6: Single Period per Subject per Room per Day (5 different subjects/day)
  enableMaxRoomDailyLimit: boolean; // Rule 6A: Maximum Two Periods per Subject per Class/Room per Day (available when Rule 6 is OFF)
  enableNonConsecutiveGapForSameSubject: boolean; // Rule 6B: Prevent Consecutive Periods of the Same Subject (available when Rule 6A is ON)
  enableDailyWorkloadMaxCap: boolean; // Rule 7: Strict Hard-Cap: Max 4 Periods/Day per Instructor (formerly Rule 9)

  // === TIER 2: Curriculum Progression & Subject Placement (Moto I & IV: Priority Tier 2) ===
  enableClassroomSubjectEqualization: boolean; // Rule 10: Moto I: Equalize subject completion % across all rooms (lowest % first)
  enableSubjectFacultyLoadBalancing: boolean; // Rule 11: Detail subjects to equalize instructor loads over 6-day cycle
  enablePaperRotationalFlow: boolean; // Rule 12: Moto IV: Sequential Subject Rotation across Classrooms (Room K in P -> Room K+1 in P+1)
  enableProportionalRemainingRatio: boolean; // Rule 13: Proportional session ratio based on remaining syllabus quota
  enableSubjectPriorityTiers: boolean; // Rule 14: Priority scaling (High: +50%, Low: -50%)
  enableGuaranteedPriorityPeriods: boolean; // Rule 15: Strictly deliver minimum required periods for prioritized subjects
  enableDayToDayProgression: boolean; // Rule 16: Day-to-day progression carry-over from previous day

  // === TIER 3: Instructor Staffing & Workload Balancing (Moto III: Priority Tier 3) ===
  enableWorkloadEqualization: boolean; // Rule 17: Cumulative instructor session balancing across the academy
  enableDailyWorkloadSoftCap: boolean; // Rule 18: Daily workload soft-cap (target <= 3 periods/day)
  enableNoSubstituteAllotment: boolean; // Rule 19: Strict main teacher only: no substitute allotted, slot left blank if primary unavailable
  replaceWithAvailableSubjectIfNoPrimary: boolean; // Rule 20: Sub-rule of No Substitute: replace with alternate available subject if primary unavailable
  enableDesignatedBackup: boolean; // Rule 21: Designated backup instructors (when substitution is permitted)
  enableUnvisitedRoomTeacherPrioritization: boolean; // Rule 22: Unvisited Classroom Instructor Prioritization (Building-Wise Exposure)
  enableCrossMutualBackup?: boolean; // Deprecated Rule 22 (removed by user request; preserved for legacy JSON compatibility)
  enablePracticalFlexible: boolean; // Rule 23: Practical (Paper-13) flexible staffing across campus
  enableCaravanFlow: boolean; // Rule 24: Instructor-bound caravan flow (default OFF in favor of Subject Rotation)
}

export interface Classroom {
  id: string; // e.g. 'OB-1' .. 'OB-8', 'NB-1' .. 'NB-7'
  code: string;
  name: string;
  nameHi?: string;
  building: string;
  roomNumber: number;
  floor: number;
  capacity: number;
}

export interface Paper {
  id: string; // 'P01' .. 'P13'
  code: string; // 'PAP-01'
  title: string;
  titleHi?: string;
  category: string;
  categoryHi?: string;
  totalTargetSessions: number; // Training period quota (scaled for 5 sessions/day)
  originalTargetSessions?: number; // Original 6 sessions/day quota (for reference/scaling comparison)
  primaryTeacherIds: string[]; // Assigned teachers
  nearestPaperIds: string[]; // Related papers for nearest substitute
  color: string;
  description?: string;
  theoryOrPractical?: 'THEORY' | 'PRACTICAL';
  maxDailyPerRoom?: number; // Default 2 periods/room/day
  priorityTier?: SubjectPriorityTier; // Default NORMAL
  preferredBuilding?: string; // e.g. 'FLOATING', 'OLD', 'NEW', 'ALL'
}

export type AssignedBuilding = 'OLD' | 'NEW' | 'FLOATING' | string;

export interface Teacher {
  id: string; // 'T1' .. 'T26'
  code: string; // 'T1' .. 'T26'
  name: string;
  nameHi?: string;
  designation: string;
  designationHi?: string;
  assignedBuilding: AssignedBuilding; // default 'FLOATING'
  primaryPaperIds: string[];
  backupPaperIds?: string[]; // Backup / substitute subject assignments
  secondaryPaperIds: string[];
  crossSubjectBackupPaperIds?: string[]; // e.g. Forensics <-> ICT, Police Admin <-> Criminology
  maxDailyPeriods: number; // default 3 or 4
  phone?: string;
  email?: string;
  status?: 'ACTIVE' | 'ABSENT' | 'LEAVE' | 'DUTY' | 'SICK';
  qualification?: string;
  remarks?: string;
}

export interface ClassSlot {
  id: string;
  roomId: string;
  period: number; // 1 to 5
  paperId: string;
  teacherId: string;
  isSubstitute: boolean;
  originalTeacherId?: string;
  substituteReason?: string;
  isPriority?: boolean;
}

export interface DailyRoutine {
  id: string;
  dayNumber: number; // Day 1, Day 2, Day 3...
  date: string; // YYYY-MM-DD
  absentTeacherIds: string[];
  unavailableTeachers?: UnavailableInstructor[]; // Absent, Leave, Duty, Sick remarks
  priorityPaperIds: string[];
  roomPriorityPaperIds?: Record<string, string[]>; // roomId -> array of priority paperIds
  subjectPriorityTiers?: Record<string, SubjectPriorityTier>; // paperId -> HIGH | MEDIUM | LOW | NORMAL | EXCLUDE
  prioritySubjectMinPeriods?: Record<string, number>; // paperId -> guaranteed minimum periods
  excludedPaperIds?: string[]; // Subject papers explicitly excluded/removed from this routine
  slots: ClassSlot[]; // 15 classrooms * 5 periods = 75 slots
  createdAt: string;
  updatedAt: string;
  isLocked: boolean; // Only the latest routine is editable!
  status: 'draft' | 'published';
  notes?: string;
  generationAudit?: any;
}

export interface ConflictInfo {
  period: number;
  teacherId: string;
  teacherName: string;
  roomIds: string[];
  roomNames: string[];
}

export interface PaperProgress {
  paperId: string;
  paperCode: string;
  title: string;
  titleHi?: string;
  targetSessions: number;
  singleRoomTarget?: number;
  completedSessions: number;
  todaySessions: number;
  remainingSessions: number;
  progressPercent: number;
  color: string;
  isPriority: boolean;
  priorityTier?: SubjectPriorityTier;
}

export interface ClassroomPaperProgress {
  paperId: string;
  paperCode: string;
  title: string;
  titleHi?: string;
  category: string;
  targetSessions: number;
  completedSessions: number; // completed before today in this room
  todaySessions: number; // scheduled today in this room
  totalCompleted: number; // completedSessions + todaySessions
  remainingSessions: number;
  progressPercent: number;
  color: string;
  isPriority: boolean;
  priorityTier?: SubjectPriorityTier;
}

export interface ClassroomTotalProgress {
  classroom: Classroom;
  totalTargetSessions: number;
  completedBeforeToday: number;
  todaySessions: number;
  totalCompleted: number;
  remainingSessions: number;
  progressPercent: number;
  paperProgress: ClassroomPaperProgress[];
}

export interface TeacherDailyDuty {
  teacherId: string;
  teacherCode: string;
  teacherName: string;
  teacherNameHi?: string;
  isAbsent: boolean;
  periodsAssigned: {
    period: number;
    roomId: string;
    roomName: string;
    paperId: string;
    paperCode: string;
    isSubstitute: boolean;
  }[];
  totalPeriods: number;
}
