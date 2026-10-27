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

export interface RoutineRuleConfig {
  enableWorkloadEqualization: boolean; // Balance instructor cumulative sessions gradually
  enableCaravanFlow: boolean; // Same-building room progression carrying ongoing subject (K -> K+1) [teacher caravan]
  enablePaperRotationalFlow: boolean; // Sequential Classroom Subject Rotation (Paper in Room K in Period P moves to Room K+1 in Period P+1)
  enableBuildingChangeGap: boolean; // Mandatory 1-period gap on building shifts
  enableDayToDayProgression: boolean; // Room progression carry-over from previous day's last slot
  enableZeroDoubleBooking: boolean; // Guarantee no instructor double-booked in same period
  enableStrictAbsenteeExclusion: boolean; // Strictly exclude absent / on-leave instructors
  enableDesignatedBackup: boolean; // Appoint backup slot 1 & 2 instructors when primary unavailable
  enableCrossMutualBackup: boolean; // Cross-subject mutual backup (Forensics <-> ICT, Police Admin <-> Criminology)
  enableSubjectPriorityTiers: boolean; // Enforce High (+50%), Low (-50%) Priority Scaling (capped at classroom count)
  enableProportionalRemainingRatio: boolean; // Fill 75 daily sessions in proportion to remaining session percentage per subject
  enableGuaranteedPriorityPeriods: boolean; // Strictly deliver minimum required periods for priority subjects
  enableClassroomSubjectEqualization: boolean; // Equalize cumulative sessions per subject within each individual classroom
  enableRoomQuotaCompletionLock: boolean; // Lock and exclude subjects from being allocated to a classroom once reaching 100% quota in that room
  enableMaxRoomDailyLimit: boolean; // Maximum 2 periods of same subject per room per day
  enableDailyWorkloadSoftCap: boolean; // Instructor daily load soft-cap (target <= 3 periods)
  enablePracticalFlexible: boolean; // Flexible staffing for Practical (Paper-13) across campus
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
  status?: 'ACTIVE' | 'LEAVE' | 'DEPUTED';
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
