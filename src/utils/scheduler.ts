/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Classroom,
  ClassroomPaperProgress,
  ClassroomTotalProgress,
  ClassSlot,
  compareClassrooms,
  compareTeacherCodes,
  DailyRoutine,
  ExamConfig,
  Paper,
  PaperProgress,
  PracticalClassConfig,
  PracticalConfig,
  RoutineRuleConfig,
  SubjectPriorityTier,
  Teacher,
} from '../types/index.ts';
import { DEFAULT_ROUTINE_RULES, normalizeRuleConfig } from '../data/initialData.ts';
import { validateRoutine, validateSlotAssignmentTier1, ValidationResult } from './routineValidator.ts';

export interface SchedulerOptions {
  classrooms: Classroom[];
  papers: Paper[];
  teachers: Teacher[];
  absentTeacherIds?: string[];
  priorityPaperIds?: string[];
  roomPriorityPaperIds?: Record<string, string[]>; // room-wise priority papers
  subjectPriorityTiers?: Record<string, SubjectPriorityTier>; // paperId -> HIGH | MEDIUM | LOW | NORMAL | EXCLUDE
  prioritySubjectMinPeriods?: Record<string, number>; // paperId -> guaranteed minimum periods
  excludedPaperIds?: string[]; // subjects explicitly omitted/removed from this routine
  teacherOffPeriods?: Record<string, number[]>; // teacherId -> off periods designated for this routine
  excusedInstructors?: any; // alias / excused instructors config
  generationMode?: string;
  practicalConfig?: PracticalConfig;
  examConfig?: ExamConfig;
  rules?: Partial<RoutineRuleConfig>; // Toggleable routine preparation constraints
  historicalRoutines?: DailyRoutine[];
  targetDayNumber: number;
  targetDate: string;
  notes?: string;
}

export interface SubjectAllocationDetail {
  paperId: string;
  paperCode: string;
  title: string;
  remainingSessions: number;
  priorityTier: SubjectPriorityTier;
  priorityMultiplier: number;
  adjustedDemand: number;
  allocationPercentage: number;
  idealSessions: number;
  integerTarget: number;
  assignedCount: number;
}

export interface RoutineGenerationAudit {
  totalCapacity: number;
  totalRemainingDemand: number;
  totalAdjustedDemand: number;
  allocations: SubjectAllocationDetail[];
  teacherWorkloads: {
    teacherId: string;
    teacherName: string;
    initialLoad: number;
    todayLoad: number;
    totalLoad: number;
  }[];
  maxTeacherLoad: number;
  minTeacherLoad: number;
  workloadDifference: number;
  vacanciesFilledCount: number;
  replacementsCount: number;
  noInstructorCount: number;
  tier1Validation: ValidationResult;
}

/**
 * Normalizes teacher ID (e.g. 'T01' -> 'T1', 'T1' -> 'T1')
 */
export function normalizeTeacherId(id: string): string {
  if (!id) return '';
  const match = id.match(/^T0*(\d+)$/i);
  if (match) return `T${match[1]}`;
  return id;
}

/**
 * Calculates classroom-wise completed sessions for each classroom and each paper.
 * Strictly avoids double-counting: current routine slots are counted as today's sessions,
 * while historical routines exclude the current routine.
 */
export function calculateClassroomCumulativeStats(
  classrooms: Classroom[],
  papers: Paper[],
  historicalRoutines: DailyRoutine[],
  currentRoutineSlots: ClassSlot[] = [],
  priorityPaperIds: string[] = [],
  currentRoutineId?: string
): ClassroomTotalProgress[] {
  const pastRoutines = historicalRoutines.filter((routine) => {
    if (currentRoutineId && routine.id === currentRoutineId) return false;
    if (currentRoutineSlots.length > 0 && routine.slots.length === currentRoutineSlots.length) {
      if (routine.slots[0]?.id === currentRoutineSlots[0]?.id) return false;
    }
    return true;
  });

  const roomHistorical = new Map<string, Map<string, number>>();
  const roomToday = new Map<string, Map<string, number>>();

  for (const room of classrooms) {
    const histMap = new Map<string, number>();
    const todayMap = new Map<string, number>();
    for (const paper of papers) {
      histMap.set(paper.id, 0);
      todayMap.set(paper.id, 0);
    }
    roomHistorical.set(room.id, histMap);
    roomToday.set(room.id, todayMap);
  }

  for (const routine of pastRoutines) {
    for (const slot of routine.slots) {
      const roomHist = roomHistorical.get(slot.roomId);
      if (roomHist && roomHist.has(slot.paperId)) {
        roomHist.set(slot.paperId, (roomHist.get(slot.paperId) || 0) + 1);
      }
    }
  }

  for (const slot of currentRoutineSlots) {
    const rToday = roomToday.get(slot.roomId);
    if (rToday && rToday.has(slot.paperId)) {
      rToday.set(slot.paperId, (rToday.get(slot.paperId) || 0) + 1);
    }
  }

  return classrooms.map((classroom) => {
    let roomCompletedAll = 0;
    let roomTodayAll = 0;
    let roomTargetAll = 0;

    const paperProgressList: ClassroomPaperProgress[] = papers.map((paper) => {
      const singleTarget = paper.totalTargetSessions > 0 ? paper.totalTargetSessions : 30;
      const histDone = roomHistorical.get(classroom.id)?.get(paper.id) || 0;
      const todayCount = roomToday.get(classroom.id)?.get(paper.id) || 0;
      const totalDone = histDone + todayCount;
      const remaining = Math.max(0, singleTarget - totalDone);
      const percent = singleTarget > 0 ? Math.min(100, Math.round((totalDone / singleTarget) * 100)) : 0;

      roomCompletedAll += totalDone;
      roomTodayAll += todayCount;
      roomTargetAll += singleTarget;

      return {
        paperId: paper.id,
        paperCode: paper.code,
        title: paper.title,
        titleHi: paper.titleHi,
        category: paper.category || '',
        color: paper.color || '#3b82f6',
        targetSessions: singleTarget,
        completedSessions: histDone,
        todaySessions: todayCount,
        totalCompleted: totalDone,
        remainingSessions: remaining,
        progressPercent: percent,
        isPriority: priorityPaperIds.includes(paper.id),
      };
    });

    const totalPercent = roomTargetAll > 0 ? Math.min(100, Math.round((roomCompletedAll / roomTargetAll) * 100)) : 0;

    return {
      classroom,
      totalTargetSessions: roomTargetAll,
      completedBeforeToday: roomCompletedAll - roomTodayAll,
      todaySessions: roomTodayAll,
      totalCompleted: roomCompletedAll,
      remainingSessions: Math.max(0, roomTargetAll - roomCompletedAll),
      progressPercent: totalPercent,
      paperProgress: paperProgressList,
    };
  });
}

/**
 * Calculates academy-wide cumulative stats for each paper.
 */
export function calculateCumulativeStats(
  papers: Paper[],
  historicalRoutines: DailyRoutine[],
  currentRoutineSlots: ClassSlot[] = [],
  priorityPaperIds: string[] = [],
  totalClassroomsMultiplier: number = 15,
  currentRoutineId?: string
): PaperProgress[] {
  const pastRoutines = historicalRoutines.filter((routine) => {
    if (currentRoutineId && routine.id === currentRoutineId) return false;
    if (currentRoutineSlots.length > 0 && routine.slots.length === currentRoutineSlots.length) {
      if (routine.slots[0]?.id === currentRoutineSlots[0]?.id) return false;
    }
    return true;
  });

  const historicalCounts = new Map<string, number>();
  papers.forEach((p) => historicalCounts.set(p.id, 0));

  for (const routine of pastRoutines) {
    for (const slot of routine.slots) {
      if (historicalCounts.has(slot.paperId)) {
        historicalCounts.set(slot.paperId, (historicalCounts.get(slot.paperId) || 0) + 1);
      }
    }
  }

  const todayCounts = new Map<string, number>();
  papers.forEach((p) => todayCounts.set(p.id, 0));
  for (const slot of currentRoutineSlots) {
    if (todayCounts.has(slot.paperId)) {
      todayCounts.set(slot.paperId, (todayCounts.get(slot.paperId) || 0) + 1);
    }
  }

  return papers.map((paper) => {
    const historical = historicalCounts.get(paper.id) || 0;
    const today = todayCounts.get(paper.id) || 0;
    const completed = historical + today;
    const singleQuota = paper.totalTargetSessions > 0 ? paper.totalTargetSessions : 30;
    const target = singleQuota * (totalClassroomsMultiplier || 15);
    const remaining = Math.max(0, target - completed);
    const progressPercent = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;

    return {
      paperId: paper.id,
      paperCode: paper.code,
      title: paper.title,
      titleHi: paper.titleHi,
      color: paper.color || '#3b82f6',
      targetSessions: target,
      singleRoomTarget: singleQuota,
      completedSessions: historical,
      todaySessions: today,
      remainingSessions: remaining,
      progressPercent,
      isPriority: priorityPaperIds.includes(paper.id),
    };
  });
}

/**
 * Calculates priority-weighted curriculum allocation and deterministic integer targets
 * using the Largest Remainder (Hamilton) method.
 * Part B–D of Master Prompt.
 */
export function calculateCurriculumAllocation(
  classrooms: Classroom[],
  papers: Paper[],
  roomPaperCompletedMap: Map<string, Map<string, number>>,
  subjectPriorityTiers: Record<string, SubjectPriorityTier> = {},
  priorityPaperIds: string[] = [],
  excludedPaperIds: string[] = [],
  rules?: Partial<RoutineRuleConfig>,
  prioritySubjectMinPeriods: Record<string, number> = {}
): {
  totalCapacity: number;
  totalRemainingDemand: number;
  totalAdjustedDemand: number;
  allocations: Map<string, SubjectAllocationDetail>;
} {
  const activeRules: RoutineRuleConfig = normalizeRuleConfig(rules);
  const totalCapacity = classrooms.length * 5; // e.g. 15 * 5 = 75
  const combinedExcludedSet = new Set(excludedPaperIds.map((id) => id.trim()));

  for (const [pid, tier] of Object.entries(subjectPriorityTiers)) {
    if (tier === 'EXCLUDE') {
      combinedExcludedSet.add(pid);
    }
  }

  const allocations = new Map<string, SubjectAllocationDetail>();
  let totalRemainingDemand = 0;
  let totalAdjustedDemand = 0;

  // 1. Calculate remaining curriculum demand and priority multipliers
  for (const paper of papers) {
    const isExcluded = combinedExcludedSet.has(paper.id);
    let remaining = 0;

    if (!isExcluded) {
      const singleQuota = paper.totalTargetSessions > 0 ? paper.totalTargetSessions : 30;
      for (const room of classrooms) {
        const done = roomPaperCompletedMap.get(room.id)?.get(paper.id) || 0;
        const remInRoom = Math.max(0, singleQuota - done);
        if (!activeRules.enableRoomQuotaCompletionLock || done < singleQuota) {
          remaining += remInRoom;
        }
      }
    }

    const tier = subjectPriorityTiers[paper.id] || (priorityPaperIds.includes(paper.id) ? 'HIGH' : 'NORMAL');
    let multiplier = 1.0;

    if (isExcluded || tier === 'EXCLUDE') {
      multiplier = 0.0;
    } else if (tier === 'HIGH' || priorityPaperIds.includes(paper.id)) {
      multiplier = 1.5; // +50% allocation
    } else if (tier === 'LOW') {
      multiplier = 0.5; // -50% allocation
    } else {
      multiplier = 1.0; // Medium / Normal: unchanged
    }

    const adjusted = isExcluded ? 0 : remaining * multiplier;

    totalRemainingDemand += remaining;
    totalAdjustedDemand += adjusted;

    allocations.set(paper.id, {
      paperId: paper.id,
      paperCode: paper.code,
      title: paper.title,
      remainingSessions: remaining,
      priorityTier: isExcluded ? 'EXCLUDE' : tier,
      priorityMultiplier: multiplier,
      adjustedDemand: adjusted,
      allocationPercentage: 0,
      idealSessions: 0,
      integerTarget: 0,
      assignedCount: 0,
    });
  }

  // 2. Calculate percentages and ideal sessions
  const eligiblePapers = papers.filter((p) => {
    const alloc = allocations.get(p.id)!;
    return alloc.adjustedDemand > 0 && !combinedExcludedSet.has(p.id);
  });

  if (totalAdjustedDemand > 0 && eligiblePapers.length > 0) {
    for (const p of eligiblePapers) {
      const alloc = allocations.get(p.id)!;
      alloc.allocationPercentage = (alloc.adjustedDemand / totalAdjustedDemand) * 100;
      alloc.idealSessions = (alloc.allocationPercentage * totalCapacity) / 100;
    }

    // 3. Deterministic Integer Allocation via Largest Remainder (Hamilton) Method
    let sumFloors = 0;
    for (const p of eligiblePapers) {
      const alloc = allocations.get(p.id)!;
      const floorVal = Math.floor(alloc.idealSessions);
      alloc.integerTarget = floorVal;
      sumFloors += floorVal;
    }

    let surplus = totalCapacity - sumFloors;

    // Sort by remainder descending, then adjusted demand descending, then paper code
    const sortedByRemainder = [...eligiblePapers].sort((a, b) => {
      const allocA = allocations.get(a.id)!;
      const allocB = allocations.get(b.id)!;
      const remA = allocA.idealSessions - Math.floor(allocA.idealSessions);
      const remB = allocB.idealSessions - Math.floor(allocB.idealSessions);
      if (Math.abs(remA - remB) > 0.0001) return remB - remA;
      if (allocA.adjustedDemand !== allocB.adjustedDemand) return allocB.adjustedDemand - allocA.adjustedDemand;
      return a.code.localeCompare(b.code);
    });

    for (let i = 0; i < surplus && i < sortedByRemainder.length; i++) {
      const alloc = allocations.get(sortedByRemainder[i].id)!;
      alloc.integerTarget += 1;
    }

    // 3b. Guaranteed Priority Delivery (High = 15 rooms, Medium = 9 rooms, Low = 3 rooms)
    if (activeRules.enableSubjectPriorityTiers || activeRules.enableGuaranteedPriorityPeriods) {
      for (const p of eligiblePapers) {
        const alloc = allocations.get(p.id)!;
        const tier = subjectPriorityTiers[p.id] || (priorityPaperIds.includes(p.id) ? 'HIGH' : undefined);
        let minTarget = 0;
        if (tier === 'HIGH') minTarget = classrooms.length; // 15
        else if (tier === 'MEDIUM') minTarget = Math.round(classrooms.length * 0.6); // 9
        else if (tier === 'LOW') minTarget = Math.max(1, Math.min(3, Math.round(classrooms.length * 0.2))); // 3

        if (prioritySubjectMinPeriods[p.id]) {
          minTarget = prioritySubjectMinPeriods[p.id];
        }

        if (minTarget > alloc.integerTarget) {
          alloc.integerTarget = minTarget;
        }
      }

      // Reconcile total back to totalCapacity
      let currentTotal = 0;
      for (const p of eligiblePapers) {
        currentTotal += allocations.get(p.id)!.integerTarget;
      }

      if (currentTotal > totalCapacity) {
        const canTrim = eligiblePapers
          .filter((p) => {
            const tier = subjectPriorityTiers[p.id];
            return tier !== 'HIGH' && !priorityPaperIds.includes(p.id);
          })
          .sort((a, b) => {
            const allocA = allocations.get(a.id)!;
            const allocB = allocations.get(b.id)!;
            return allocA.adjustedDemand - allocB.adjustedDemand;
          });

        let overage = currentTotal - totalCapacity;
        for (const p of canTrim) {
          if (overage <= 0) break;
          const alloc = allocations.get(p.id)!;
          const tier = subjectPriorityTiers[p.id];
          const minAllowed = tier === 'MEDIUM' ? Math.round(classrooms.length * 0.6) : (tier === 'LOW' ? 3 : 1);
          const reducable = Math.max(0, alloc.integerTarget - minAllowed);
          const deduct = Math.min(overage, reducable);
          alloc.integerTarget -= deduct;
          overage -= deduct;
        }
      }
    }

    // 4. Reconcile with max room limits
    // Under Rule 6: Max 1 period per room -> Max total per subject across all classrooms = classrooms.length (15)
    // Under Rule 6A: Max 2 periods per room -> Max total per subject across all classrooms = 2 * classrooms.length (30)
    const maxPerRoomLimit = activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily
      ? 1
      : activeRules.enableMaxRoomDailyLimit
      ? 2
      : 5;
    const maxTotalPerSubject = classrooms.length * maxPerRoomLimit;

    let excessToRedistribute = 0;
    for (const p of eligiblePapers) {
      const alloc = allocations.get(p.id)!;
      if (alloc.integerTarget > maxTotalPerSubject) {
        excessToRedistribute += alloc.integerTarget - maxTotalPerSubject;
        alloc.integerTarget = maxTotalPerSubject;
      }
    }

    if (excessToRedistribute > 0) {
      const canReceiveMore = eligiblePapers.filter((p) => {
        const alloc = allocations.get(p.id)!;
        return alloc.integerTarget < maxTotalPerSubject;
      });

      for (let i = 0; i < excessToRedistribute && canReceiveMore.length > 0; i++) {
        const targetPaper = canReceiveMore[i % canReceiveMore.length];
        const alloc = allocations.get(targetPaper.id)!;
        if (alloc.integerTarget < maxTotalPerSubject) {
          alloc.integerTarget += 1;
        }
      }
    }
  } else {
    // If no adjusted demand (e.g. all excluded or zero remaining), distribute capacity safely across available non-excluded
    const nonExcluded = papers.filter((p) => !combinedExcludedSet.has(p.id));
    if (nonExcluded.length > 0) {
      const perPaper = Math.floor(totalCapacity / nonExcluded.length);
      let rem = totalCapacity % nonExcluded.length;
      for (const p of nonExcluded) {
        const alloc = allocations.get(p.id)!;
        alloc.integerTarget = perPaper + (rem > 0 ? 1 : 0);
        if (rem > 0) rem--;
      }
    }
  }

  return {
    totalCapacity,
    totalRemainingDemand,
    totalAdjustedDemand,
    allocations,
  };
}

/**
 * Cross-subject mutual backup map:
 * Forensics (P05) <-> ICT Cyber (P06)
 * Police Admin (P08, P09) <-> Criminology (P07)
 */
export const CROSS_SUBJECT_BACKUP_MAP: Record<string, { backupPaperIds: string[]; pairLabel: string }> = {
  P05: { backupPaperIds: ['P06'], pairLabel: 'Forensics ↔ ICT Cyber Instructor Mutual Backup' },
  P06: { backupPaperIds: ['P05'], pairLabel: 'ICT Cyber ↔ Forensics Instructor Mutual Backup' },
  P07: { backupPaperIds: ['P08', 'P09'], pairLabel: 'Criminology ↔ Police Admin Instructor Mutual Backup' },
  P08: { backupPaperIds: ['P07', 'P09'], pairLabel: 'Police Admin ↔ Criminology Instructor Mutual Backup' },
  P09: { backupPaperIds: ['P07', 'P08'], pairLabel: 'Station Mgmt ↔ Criminology Instructor Mutual Backup' },
};

/**
 * Helper to dynamically resolve primary teachers for a paper from the instructor mapping.
 * Any teacher whose main subject (primaryPaperIds) matches this paper is a primary teacher.
 */
export function getPaperPrimaryTeachers(paper: Paper, teachers: Teacher[]): Teacher[] {
  // Find all teachers whose main subject in instructor mapping matches this paper (by ID, code, or title)
  const matching = teachers.filter((t) => {
    if (!t.primaryPaperIds || t.primaryPaperIds.length === 0) return false;
    return t.primaryPaperIds.some((pid) => {
      if (!pid) return false;
      const cleanPid = pid.trim().toLowerCase();
      const pId = paper.id.trim().toLowerCase();
      const pCode = paper.code.trim().toLowerCase();
      const pTitle = paper.title.trim().toLowerCase();
      return (
        cleanPid === pId ||
        cleanPid === pCode ||
        cleanPid === pTitle ||
        pCode.replace(/[^a-z0-9]/g, '') === cleanPid.replace(/[^a-z0-9]/g, '') ||
        (cleanPid.length > 3 && pTitle.includes(cleanPid))
      );
    });
  });

  if (matching.length > 0) {
    return matching;
  }

  // Fallback to paper.primaryTeacherIds if no teacher has it in primaryPaperIds (e.g. Practical P13 or unmapped papers)
  if (paper.primaryTeacherIds && paper.primaryTeacherIds.length > 0) {
    const fromIds = paper.primaryTeacherIds
      .map((tid) => teachers.find((t) => t.id === tid || t.code === tid))
      .filter(Boolean) as Teacher[];
    if (fromIds.length > 0) return fromIds;
  }

  return [];
}

/**
 * Primary Routine Generation Engine implementing Tier 1 Hard Constraints,
 * Tier 2 Priority-Based Curriculum Allocation, Rotational Wave Sequencing,
 * and Fair Teacher Balancing.
 */
export function generateDailyRoutine(options: SchedulerOptions): DailyRoutine {
  const {
    classrooms: rawClassrooms,
    papers: rawPapers,
    teachers,
    absentTeacherIds = [],
    priorityPaperIds = [],
    roomPriorityPaperIds = {},
    subjectPriorityTiers = {},
    prioritySubjectMinPeriods = {},
    excludedPaperIds = [],
    rules,
    historicalRoutines = [],
    targetDayNumber,
    targetDate,
    notes,
  } = options;

  // Strict serial numeric ordering of classrooms (Room No. 1 to Room No. 15)
  const classrooms = [...rawClassrooms].sort(compareClassrooms);

  // Synchronize primary teacher assignments from instructor mapping (teacher.primaryPaperIds)
  // Rule: Any subject's teacher will be whichever teacher has that subject as their main subject in instructor mapping
  const papers = rawPapers.map((p) => {
    const primaryTeachers = getPaperPrimaryTeachers(p, teachers);
    return {
      ...p,
      primaryTeacherIds: primaryTeachers.map((t) => t.id),
    };
  });

  const activeRules: RoutineRuleConfig = normalizeRuleConfig(rules);
  const totalDailySlots = classrooms.length * 5; // 75 slots
  const paperMap = new Map(papers.map((p) => [p.id, p]));
  const classroomMap = new Map(classrooms.map((c) => [c.id, c]));
  const classroomIndexMap = new Map<string, number>();
  classrooms.forEach((c, idx) => classroomIndexMap.set(c.id, idx + 1));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));

  const getTeacherOffPeriods = (tid: string): number[] => {
    const fromOpts = options.teacherOffPeriods?.[tid];
    if (fromOpts && fromOpts.length > 0) return fromOpts;
    const t = teacherMap.get(tid);
    const dayKey = String(targetDayNumber);
    if (t?.dayOffPeriods && (t.dayOffPeriods[dayKey] || t.dayOffPeriods[targetDayNumber])) {
      return t.dayOffPeriods[dayKey] || t.dayOffPeriods[targetDayNumber];
    }
    return t?.offPeriods || [];
  };

  const combinedExcludedSet = new Set(excludedPaperIds.map((id) => id.trim()));
  for (const [pid, tier] of Object.entries(subjectPriorityTiers)) {
    if (tier === 'EXCLUDE') {
      combinedExcludedSet.add(pid);
    }
  }

  // If practical is explicitly disabled via practicalConfig
  if (options.practicalConfig && options.practicalConfig.enabled === false) {
    combinedExcludedSet.add('P13');
  }

  // Examination Session setup (When Exam is active, Period 5 across all classrooms is an Exam Session)
  const isExamActive = Boolean(options.examConfig?.enabled);
  const examPaper: Paper = papers.find(
    (p) => p.theoryOrPractical === 'EXAM' || p.category.toLowerCase().includes('exam')
  ) || {
    id: 'P_EXAM',
    code: 'Paper-EXAM',
    title: options.examConfig?.name || 'Examination / Assessment',
    titleHi: 'परीक्षा / मूल्यांकन',
    category: 'Examination & Assessment',
    categoryHi: 'परीक्षा एवं मूल्यांकन',
    totalTargetSessions: 30,
    originalTargetSessions: 30,
    color: '#DC2626',
    description: 'Weekly / Module End Examination, Test and Assessment Session',
    theoryOrPractical: 'EXAM',
    maxDailyPerRoom: 1,
    preferredBuilding: 'ALL',
    primaryTeacherIds: [],
    nearestPaperIds: [],
  };

  // If exam is NOT explicitly enabled for this routine, exclude it from general period 1-4 rotation
  if (!isExamActive) {
    if (examPaper && papers.some((p) => p.id === examPaper.id) && (examPaper.theoryOrPractical === 'EXAM' || examPaper.category.toLowerCase().includes('exam'))) {
      combinedExcludedSet.add(examPaper.id);
    }
  }

  // Active papers ordered by paper code (Paper 1, Paper 2, ... Paper 13)
  const sortedPapers = [...papers].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const schedulingPapers = sortedPapers.filter((p) => !combinedExcludedSet.has(p.id));

  // 1. Calculate cumulative historical counts per classroom
  const pastHistoricalRoutines = historicalRoutines.filter((r) => r.dayNumber < targetDayNumber);
  const roomProgressList = calculateClassroomCumulativeStats(
    classrooms,
    papers,
    pastHistoricalRoutines,
    [],
    priorityPaperIds
  );

  const roomPaperCompletedMap = new Map<string, Map<string, number>>();
  for (const rp of roomProgressList) {
    const cMap = new Map<string, number>();
    for (const pp of rp.paperProgress) {
      cMap.set(pp.paperId, pp.completedSessions);
    }
    roomPaperCompletedMap.set(rp.classroom.id, cMap);
  }

  // Quota Lockout Helper (Rule 5)
  const isPaperRoomQuotaCompleted = (roomId: string, paperId: string, plannedInRoomToday: number = 0): boolean => {
    if (!activeRules.enableRoomQuotaCompletionLock) return false;
    const completed = (roomPaperCompletedMap.get(roomId)?.get(paperId) || 0) + plannedInRoomToday;
    const p = paperMap.get(paperId);
    const target = p && p.totalTargetSessions > 0 ? p.totalTargetSessions : 30;
    return completed >= target;
  };

  // 2. Part B–D: Calculate Curriculum Allocation and Integer Targets
  const curriculumPlan = calculateCurriculumAllocation(
    classrooms,
    papers,
    roomPaperCompletedMap,
    subjectPriorityTiers,
    priorityPaperIds,
    Array.from(combinedExcludedSet),
    activeRules,
    prioritySubjectMinPeriods
  );

  // Teacher availability and historical load setup
  const normalizedAbsentSet = activeRules.enableStrictAbsenteeExclusion
    ? new Set(absentTeacherIds.map(normalizeTeacherId))
    : new Set<string>();

  const availableTeachers = teachers.filter((t) => !normalizedAbsentSet.has(normalizeTeacherId(t.id)));
  const availableTeacherIds = new Set(availableTeachers.map((t) => t.id));

  // Teacher historical sessions across past routines (accounting scope)
  const teacherHistoricalSessions = new Map<string, number>();
  teachers.forEach((t) => teacherHistoricalSessions.set(t.id, 0));

  // Teacher Classroom Deployment Tracker: teacherId -> roomId -> visits count
  const teacherRoomDeploymentCount = new Map<string, Map<string, number>>();
  teachers.forEach((t) => {
    const rMap = new Map<string, number>();
    classrooms.forEach((r) => rMap.set(r.id, 0));
    teacherRoomDeploymentCount.set(t.id, rMap);
  });

  // Teacher Building Deployment Tracker: teacherId -> building ('OLD' | 'NEW') -> visits count
  const teacherBuildingDeploymentCount = new Map<string, Map<string, number>>();
  teachers.forEach((t) => {
    const bMap = new Map<string, number>();
    bMap.set('OLD', 0);
    bMap.set('NEW', 0);
    teacherBuildingDeploymentCount.set(t.id, bMap);
  });

  pastHistoricalRoutines.forEach((r) => {
    r.slots.forEach((s) => {
      if (s.teacherId) {
        teacherHistoricalSessions.set(s.teacherId, (teacherHistoricalSessions.get(s.teacherId) || 0) + 1);
        if (teacherRoomDeploymentCount.has(s.teacherId)) {
          const rMap = teacherRoomDeploymentCount.get(s.teacherId)!;
          if (rMap.has(s.roomId)) {
            rMap.set(s.roomId, (rMap.get(s.roomId) || 0) + 1);
          }
        }
        const roomObj = classroomMap.get(s.roomId);
        if (roomObj && teacherBuildingDeploymentCount.has(s.teacherId)) {
          const bMap = teacherBuildingDeploymentCount.get(s.teacherId)!;
          bMap.set(roomObj.building, (bMap.get(roomObj.building) || 0) + 1);
        }
      }
    });
  });

  const teacherDailyLoad = new Map<string, number>();
  teachers.forEach((t) => teacherDailyLoad.set(t.id, 0));

  // Yesterday's room visits per teacher (Day N-1) for consecutive-day anti-clustering
  const teacherYesterdayRooms = new Map<string, Set<string>>();
  teachers.forEach((t) => teacherYesterdayRooms.set(t.id, new Set()));

  const previousRoutines = historicalRoutines
    .filter((r) => r.dayNumber < targetDayNumber)
    .sort((a, b) => b.dayNumber - a.dayNumber);
  const previousDayRoutine = previousRoutines[0];

  if (previousDayRoutine && previousDayRoutine.slots) {
    for (const s of previousDayRoutine.slots) {
      if (s.teacherId && s.roomId) {
        teacherYesterdayRooms.get(s.teacherId)?.add(s.roomId);
      }
    }
  }

  // Helper to check strict building binding (Rule 3)
  const isTeacherAllowedInRoomBuilding = (t: Teacher, rBuilding: string): boolean => {
    if (!activeRules.enableStrictBuildingBinding) return true;
    if (t.assignedBuilding === 'FLOATING') return true;
    return t.assignedBuilding === rBuilding;
  };

  // Helper to get total room visits for a teacher
  const getTeacherRoomVisits = (teacherId: string, roomId: string): number => {
    return teacherRoomDeploymentCount.get(teacherId)?.get(roomId) || 0;
  };

  // Helper to get minimum visits across all eligible rooms for a teacher
  const getTeacherMinEligibleRoomVisits = (t: Teacher): number => {
    const eligible = classrooms.filter((r) => isTeacherAllowedInRoomBuilding(t, r.building));
    if (eligible.length === 0) return 0;
    let minV = Infinity;
    for (const r of eligible) {
      const v = teacherRoomDeploymentCount.get(t.id)?.get(r.id) || 0;
      if (v < minV) minV = v;
    }
    return minV === Infinity ? 0 : minV;
  };

  // Classroom Exposure Balance Cap: Difference between max and min room visits <= 2
  // If visits in roomId is already >= minEligible + 2, adding another visit makes it minEligible + 3,
  // causing max - min to be at least 3, which violates maxDiff <= 2.
  const isTeacherRoomVisitBalanced = (t: Teacher, roomId: string): boolean => {
    const v = getTeacherRoomVisits(t.id, roomId);
    const minV = getTeacherMinEligibleRoomVisits(t);
    return v < minV + 2;
  };

  // Rule 9 (Tier 1 Constraint): Practical Consecutive Double-Period & Daily Quota Rule setup
  const isPracticalActive =
    options.practicalConfig?.enabled === true &&
    !combinedExcludedSet.has('P13') &&
    papers.some((p) => p.id === 'P13' || p.theoryOrPractical === 'PRACTICAL');

  const practicalPaper: Paper = papers.find((p) => p.id === 'P13' || p.theoryOrPractical === 'PRACTICAL') || {
    id: 'P13',
    code: 'P13',
    title: options.practicalConfig?.name || 'Practical',
    category: 'Practical',
    totalTargetSessions: 40,
    color: '#10B981',
    description: 'Practical / Applied Training',
    theoryOrPractical: 'PRACTICAL',
    maxDailyPerRoom: 2,
    preferredBuilding: 'ALL',
    primaryTeacherIds: [],
    nearestPaperIds: [],
  };

  // Teacher Equalization Check:
  // "aur.. techer equalisation rule me.. teacher. ko. ko jyda deplyoment hone se.. practical ka kewal do period hi ho.. taki techer ka deplyment v equialisation ho sake"
  const activeTeacherLoads = availableTeachers.map((t) => teacherHistoricalSessions.get(t.id) || 0);
  const avgTeacherLoad =
    activeTeacherLoads.length > 0
      ? activeTeacherLoads.reduce((a, b) => a + b, 0) / activeTeacherLoads.length
      : 0;
  const minTeacherHistLoad = activeTeacherLoads.length > 0 ? Math.min(...activeTeacherLoads) : 0;
  const maxTeacherHistLoad = activeTeacherLoads.length > 0 ? Math.max(...activeTeacherLoads) : 0;

  const isTeacherEqualizationActive =
    Boolean(activeRules.enableTeacherLoadEqualizationPriority) ||
    Boolean(activeRules.enableWorkloadEqualization);

  const highDeploymentPracticalTeacherIds = new Set<string>();

  interface ScheduledPractical {
    id: string;
    name: string;
    practicalSubjectId?: string;
    teacher: Teacher;
    room: Classroom;
    periods: number[];
  }
  const scheduledPracticals: ScheduledPractical[] = [];

  if (isPracticalActive && availableTeachers.length > 0 && classrooms.length > 0) {
    const hasConfigItems = Boolean(options.practicalConfig?.items && options.practicalConfig.items.length > 0);
    const configItems = hasConfigItems ? options.practicalConfig!.items! : [];

    if (hasConfigItems) {
      // MULTI-PRACTICAL / CONFIGURED ITEMS MODE
      const usedTeacherIds = new Set<string>();
      const roomPracticalSessionsCount = new Map<string, number>();
      const roomPracticalSubjects = new Map<string, Set<string>>();
      const usedRoomPeriodKeys = new Set<string>();

      for (let i = 0; i < configItems.length; i++) {
        const item = configItems[i];
        const itemPracticalKey = item.practicalSubjectId || item.name || `prac-${i + 1}`;

        // 1. Pick Teacher
        let itemTeacher: Teacher | undefined;
        if (item.teacherId) {
          itemTeacher = availableTeachers.find((t) => t.id === item.teacherId);
        }
        if (!itemTeacher) {
          // Auto-assign: available lagging teacher not yet used in another practical
          const candidateTeachers = availableTeachers.filter((t) => !usedTeacherIds.has(t.id));
          const sortedCandidates = [...(candidateTeachers.length > 0 ? candidateTeachers : availableTeachers)].sort(
            (a, b) => (teacherHistoricalSessions.get(a.id) || 0) - (teacherHistoricalSessions.get(b.id) || 0)
          );
          itemTeacher = sortedCandidates[0];
        }
        if (!itemTeacher) continue;
        usedTeacherIds.add(itemTeacher.id);

        // Check equalization high deployment for this teacher
        const tHistLoad = teacherHistoricalSessions.get(itemTeacher.id) || 0;
        if (isTeacherEqualizationActive && maxTeacherHistLoad > minTeacherHistLoad && tHistLoad > avgTeacherLoad) {
          highDeploymentPracticalTeacherIds.add(itemTeacher.id);
        }

        // 2. Pick Periods (pair of consecutive periods: [2, 3] or [4, 5]; or single period [p])
        const tOff = getTeacherOffPeriods(itemTeacher.id);
        const itemDuration = item.duration || (item.periods && item.periods.length === 1 ? 1 : 2);
        let chosenPeriods: number[] = item.periods && item.periods.length > 0 ? [...item.periods] : [];

        if (chosenPeriods.length === 0) {
          if (itemDuration === 1) {
            // Single-period practical: pick open period (P2, P3, P4, P5, or P1)
            const candidatePeriods = isExamActive ? [2, 3, 4] : [2, 3, 4, 5, 1];
            for (const p of candidatePeriods) {
              if (!tOff.includes(p)) {
                chosenPeriods = [p];
                break;
              }
            }
            if (chosenPeriods.length === 0) chosenPeriods = [2];
          } else {
            // Double-period practical (consecutive 2 periods)
            const candidatePairs: [number, number][] = isExamActive
              ? [[2, 3]]
              : [
                  i % 2 === 0 ? [2, 3] : [4, 5],
                  i % 2 === 0 ? [4, 5] : [2, 3],
                ];
            for (const pair of candidatePairs) {
              if (!pair.some((p) => tOff.includes(p))) {
                chosenPeriods = pair;
                break;
              }
            }
            if (chosenPeriods.length === 0) chosenPeriods = [2, 3];
          }
        } else {
          // If periods were provided, adjust if exam is active and period 5 is included
          if (isExamActive && chosenPeriods.includes(5)) {
            if (chosenPeriods.length === 2) {
              chosenPeriods = [2, 3];
            } else {
              chosenPeriods = [4];
            }
          }
        }

        // 3. Pick Room:
        // A single classroom can take up to 2 practical sessions (4 periods) in one day,
        // BUT they must be DIFFERENT practical subjects (variety rule: no repeating the same practical subject in same room).
        let itemRoom: Classroom | undefined;
        if (item.roomId) {
          const roomSessCount = roomPracticalSessionsCount.get(item.roomId) || 0;
          const roomSubs = roomPracticalSubjects.get(item.roomId);
          const hasPeriodConflict = chosenPeriods.some((p) => usedRoomPeriodKeys.has(`${item.roomId}-P${p}`));
          const hasSameSubject = roomSubs?.has(itemPracticalKey);
          if (roomSessCount < 2 && !hasSameSubject && !hasPeriodConflict) {
            itemRoom = classrooms.find((c) => c.id === item.roomId);
          }
        }
        if (!itemRoom) {
          const eligibleRooms = classrooms.filter((r) => {
            const roomSessCount = roomPracticalSessionsCount.get(r.id) || 0;
            // Max 2 practical sessions (4 periods) per room per day
            if (roomSessCount >= 2) return false;
            // Variety check: A classroom cannot have the same practical subject twice on the same day
            const roomSubs = roomPracticalSubjects.get(r.id);
            if (roomSubs?.has(itemPracticalKey)) return false;

            if (itemTeacher && activeRules.enableStrictBuildingBinding) {
              if (itemTeacher.assignedBuilding !== 'FLOATING' && itemTeacher.assignedBuilding !== r.building) {
                return false;
              }
            }
            if (chosenPeriods.some((p) => usedRoomPeriodKeys.has(`${r.id}-P${p}`))) {
              return false;
            }
            if (activeRules.enableRoomQuotaCompletionLock && isPaperRoomQuotaCompleted(r.id, practicalPaper.id)) {
              return false;
            }
            return true;
          });
          const pool = eligibleRooms.length > 0 ? eligibleRooms : classrooms.filter((r) => (roomPracticalSessionsCount.get(r.id) || 0) < 2);
          const effectivePool = pool.length > 0 ? pool : classrooms;
          const sortedRooms = [...effectivePool].sort((a, b) => {
            // Prefer rooms that haven't received any practical yet today
            const countPracA = roomPracticalSessionsCount.get(a.id) || 0;
            const countPracB = roomPracticalSessionsCount.get(b.id) || 0;
            if (countPracA !== countPracB) return countPracA - countPracB;

            if (itemTeacher) {
              const yestA = teacherYesterdayRooms.get(itemTeacher.id)?.has(a.id) ? 1 : 0;
              const yestB = teacherYesterdayRooms.get(itemTeacher.id)?.has(b.id) ? 1 : 0;
              if (yestA !== yestB) return yestA - yestB;

              const tVisitsA = teacherRoomDeploymentCount.get(itemTeacher.id)?.get(a.id) || 0;
              const tVisitsB = teacherRoomDeploymentCount.get(itemTeacher.id)?.get(b.id) || 0;
              if (tVisitsA !== tVisitsB) return tVisitsA - tVisitsB;
            }

            const countA = pastHistoricalRoutines.reduce(
              (sum, h) =>
                sum +
                h.slots.filter(
                  (s) => s.roomId === a.id && (s.paperId === 'P13' || paperMap.get(s.paperId)?.theoryOrPractical === 'PRACTICAL')
                ).length,
              0
            );
            const countB = pastHistoricalRoutines.reduce(
              (sum, h) =>
                sum +
                h.slots.filter(
                  (s) => s.roomId === b.id && (s.paperId === 'P13' || paperMap.get(s.paperId)?.theoryOrPractical === 'PRACTICAL')
                ).length,
              0
            );
            if (countA !== countB) return countA - countB;

            const poolIdxA = effectivePool.findIndex((r) => r.id === a.id);
            const poolIdxB = effectivePool.findIndex((r) => r.id === b.id);
            const dayOffset = (targetDayNumber + i * 2) % effectivePool.length;
            const distA = (poolIdxA - dayOffset + effectivePool.length) % effectivePool.length;
            const distB = (poolIdxB - dayOffset + effectivePool.length) % effectivePool.length;
            return distA - distB;
          });
          itemRoom = sortedRooms[0];
        }

        if (itemRoom) {
          roomPracticalSessionsCount.set(itemRoom.id, (roomPracticalSessionsCount.get(itemRoom.id) || 0) + 1);
          const curSubs = roomPracticalSubjects.get(itemRoom.id) || new Set<string>();
          curSubs.add(itemPracticalKey);
          roomPracticalSubjects.set(itemRoom.id, curSubs);

          chosenPeriods.forEach((p) => usedRoomPeriodKeys.add(`${itemRoom!.id}-P${p}`));

          scheduledPracticals.push({
            id: item.id || `prac-${i + 1}`,
            name: item.name || options.practicalConfig?.name || 'Practical',
            practicalSubjectId: item.practicalSubjectId,
            teacher: itemTeacher,
            room: itemRoom,
            periods: chosenPeriods,
          });
        }
      }
    } else {
      // SINGLE PRACTICAL / LEGACY MODE (1 instructor details 2 or 4 periods)
      let designatedTeacher: Teacher | undefined;
      if (options.practicalConfig?.teacherIds && options.practicalConfig.teacherIds.length > 0) {
        designatedTeacher = availableTeachers.find((t) => t.id === options.practicalConfig!.teacherIds![0]);
      }
      if (!designatedTeacher) {
        const sortedByWorkload = [...availableTeachers].sort((a, b) => {
          const offA = getTeacherOffPeriods(a.id).length;
          const offB = getTeacherOffPeriods(b.id).length;
          const canDoA = (5 - offA) >= 4 ? 0 : 1;
          const canDoB = (5 - offB) >= 4 ? 0 : 1;
          if (canDoA !== canDoB) return canDoA - canDoB;
          const loadA = teacherHistoricalSessions.get(a.id) || 0;
          const loadB = teacherHistoricalSessions.get(b.id) || 0;
          return loadA - loadB;
        });
        designatedTeacher = sortedByWorkload[0];
      }

      if (designatedTeacher) {
        const tHistLoad = teacherHistoricalSessions.get(designatedTeacher.id) || 0;
        const isHighDeployment =
          isTeacherEqualizationActive &&
          maxTeacherHistLoad > minTeacherHistLoad &&
          tHistLoad > avgTeacherLoad;

        if (isHighDeployment) {
          highDeploymentPracticalTeacherIds.add(designatedTeacher.id);
        }

        const roomCount = isHighDeployment || classrooms.length < 2 ? 1 : 2;

        const eligibleRooms = classrooms.filter((r) => {
          if (activeRules.enableStrictBuildingBinding && designatedTeacher!.assignedBuilding !== 'FLOATING') {
            if (designatedTeacher!.assignedBuilding !== r.building) return false;
          }
          if (activeRules.enableRoomQuotaCompletionLock && isPaperRoomQuotaCompleted(r.id, practicalPaper.id)) {
            return false;
          }
          return true;
        });
        const pool = eligibleRooms.length >= roomCount ? eligibleRooms : classrooms;
        const sortedRooms = [...pool].sort((a, b) => {
          // 1. Avoid room if designated teacher taught in it yesterday
          const yestA = teacherYesterdayRooms.get(designatedTeacher!.id)?.has(a.id) ? 1 : 0;
          const yestB = teacherYesterdayRooms.get(designatedTeacher!.id)?.has(b.id) ? 1 : 0;
          if (yestA !== yestB) return yestA - yestB;

          // 2. Prioritize room where designated teacher has lowest cumulative visits across all subjects
          const tVisitsA = teacherRoomDeploymentCount.get(designatedTeacher!.id)?.get(a.id) || 0;
          const tVisitsB = teacherRoomDeploymentCount.get(designatedTeacher!.id)?.get(b.id) || 0;
          if (tVisitsA !== tVisitsB) return tVisitsA - tVisitsB;

          const countA = pastHistoricalRoutines.reduce(
            (sum, h) =>
              sum +
              h.slots.filter(
                (s) => s.roomId === a.id && (s.paperId === 'P13' || paperMap.get(s.paperId)?.theoryOrPractical === 'PRACTICAL')
              ).length,
            0
          );
          const countB = pastHistoricalRoutines.reduce(
            (sum, h) =>
              sum +
              h.slots.filter(
                (s) => s.roomId === b.id && (s.paperId === 'P13' || paperMap.get(s.paperId)?.theoryOrPractical === 'PRACTICAL')
              ).length,
            0
          );
          if (countA !== countB) return countA - countB;

          const poolIdxA = pool.findIndex((r) => r.id === a.id);
          const poolIdxB = pool.findIndex((r) => r.id === b.id);
          const dayOffset = targetDayNumber % pool.length;
          const distA = (poolIdxA - dayOffset + pool.length) % pool.length;
          const distB = (poolIdxB - dayOffset + pool.length) % pool.length;
          return distA - distB;
        });

        const pOff = getTeacherOffPeriods(designatedTeacher.id);
        const pName = options.practicalConfig?.name || 'Practical';

        if (roomCount === 1 || isExamActive) {
          let pair: [number, number] = [2, 3];
          const singleCandidatePairs: [number, number][] = isExamActive ? [[2, 3]] : [[2, 3], [4, 5]];
          for (const cand of singleCandidatePairs) {
            if (!cand.some((p) => pOff.includes(p))) {
              pair = cand;
              break;
            }
          }
          scheduledPracticals.push({
            id: 'prac-1',
            name: pName,
            teacher: designatedTeacher,
            room: sortedRooms[0],
            periods: pair,
          });
        } else {
          let pair1: [number, number] = [2, 3];
          let pair2: [number, number] = [4, 5];
          const dualCandidatePairs: [[number, number], [number, number]][] = [
            [[2, 3], [4, 5]],
          ];
          for (const [c1, c2] of dualCandidatePairs) {
            if (!c1.some((p) => pOff.includes(p)) && !c2.some((p) => pOff.includes(p))) {
              pair1 = c1;
              pair2 = c2;
              break;
            }
          }
          const room1 = sortedRooms[0];
          const room2 = sortedRooms.find((r) => r.id !== room1.id) || classrooms.find((c) => c.id !== room1.id) || room1;
          scheduledPracticals.push({
            id: 'prac-1',
            name: pName,
            teacher: designatedTeacher,
            room: room1,
            periods: pair1,
          });
          scheduledPracticals.push({
            id: 'prac-2',
            name: pName,
            teacher: designatedTeacher,
            room: room2,
            periods: pair2,
          });
        }
      }
    }
  }

  // Tracking maps for practical assignments
  const scheduledPracticalRoomIds = new Set(scheduledPracticals.map((p) => p.room.id));
  const totalPracticalSlotsCount = scheduledPracticals.length * 2;
  const teacherPracticalPeriodsMap = new Map<string, number[]>();
  const teacherPracticalCounts = new Map<string, number>();
  const practicalTeachersList: Teacher[] = [];
  const scheduledPracticalSlots = new Set<string>();

  for (const sp of scheduledPracticals) {
    if (!practicalTeachersList.some((t) => t.id === sp.teacher.id)) {
      practicalTeachersList.push(sp.teacher);
    }
    const curPeriods = teacherPracticalPeriodsMap.get(sp.teacher.id) || [];
    teacherPracticalPeriodsMap.set(sp.teacher.id, [...curPeriods, ...sp.periods]);
    teacherPracticalCounts.set(sp.teacher.id, (teacherPracticalCounts.get(sp.teacher.id) || 0) + 2);

    for (const p of sp.periods) {
      scheduledPracticalSlots.add(`${sp.room.id}-P${p}-${sp.teacher.id}`);
    }
  }

  const designatedPracticalTeacher: Teacher | undefined = practicalTeachersList[0];
  const practicalRoomsCount = scheduledPracticals.length;
  const practicalPeriodsQuota = totalPracticalSlotsCount;
  const practicalRoom1 = scheduledPracticals[0]?.room || classrooms[0];
  const practicalRoom2 = scheduledPracticals[1]?.room || practicalRoom1;
  const practicalPeriodsRoom1 = scheduledPracticals[0]?.periods || [2, 3];
  const practicalPeriodsRoom2 = scheduledPracticals[1]?.periods || [4, 5];

  // 3. Part E: Subject Distribution Across Classrooms Starting From Paper 1
  // Classroom assigned paper buckets: roomId -> Paper[]
  const roomAssignedPapers = new Map<string, Paper[]>();
  for (const r of classrooms) {
    roomAssignedPapers.set(r.id, []);
  }

  const paperAllocatedCount = new Map<string, number>();
  for (const p of papers) {
    paperAllocatedCount.set(p.id, 0);
  }

  // Pre-seed room-specific priorities from roomPriorityPaperIds
  for (const r of classrooms) {
    const userPrios = roomPriorityPaperIds[r.id] || [];
    for (const pid of userPrios) {
      if (roomAssignedPapers.get(r.id)!.length >= 5) break;
      const p = paperMap.get(pid);
      if (p && !combinedExcludedSet.has(pid) && !isPaperRoomQuotaCompleted(r.id, pid)) {
        roomAssignedPapers.get(r.id)!.push(p);
        paperAllocatedCount.set(pid, (paperAllocatedCount.get(pid) || 0) + 1);
      }
    }
  }

  const isHighPriorityPaper = (pid: string): boolean => {
    return subjectPriorityTiers[pid] === 'HIGH' || priorityPaperIds.includes(pid);
  };

  // Helper to check if paper can fit in room based on Rules 5, 6, 6A, 9
  const canAddPaperToRoom = (paperId: string, roomId: string): boolean => {
    if (combinedExcludedSet.has(paperId)) return false;
    const currentInRoom = roomAssignedPapers.get(roomId) || [];
    if (currentInRoom.length >= 5) return false;
    if (isPaperRoomQuotaCompleted(roomId, paperId, currentInRoom.filter((p) => p.id === paperId).length)) {
      return false;
    }
    const countInRoom = currentInRoom.filter((p) => p.id === paperId).length;

    // Rule 9 (Tier 1 Constraint): Practical Double-Period Limit
    const isPracticalPaper = paperId === 'P13' || paperMap.get(paperId)?.theoryOrPractical === 'PRACTICAL';
    if (activeRules.enablePracticalConsecutiveDoublePeriodLimit !== false && isPracticalActive) {
      if (isPracticalPaper) {
        if (!scheduledPracticalRoomIds.has(roomId)) return false;
        if (countInRoom >= 2) return false;
        return true;
      }
    }

    // Rule 6: Max 1 period per subject per room daily
    if (activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && countInRoom >= 1) return false;

    // Rule 6A: Max 2 periods per subject per class/room daily
    if (!activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && activeRules.enableMaxRoomDailyLimit && countInRoom >= 2) {
      return false;
    }

    // Reserve room slots for High Priority / Guaranteed papers that still need this classroom
    if (!isHighPriorityPaper(paperId)) {
      let highPriorityNeeded = 0;
      for (const hp of schedulingPapers) {
        if (isHighPriorityPaper(hp.id) && !currentInRoom.some((p) => p.id === hp.id)) {
          const alloc = curriculumPlan.allocations.get(hp.id);
          const target = alloc ? alloc.integerTarget : 0;
          if (target >= classrooms.length && !isPaperRoomQuotaCompleted(roomId, hp.id)) {
            highPriorityNeeded++;
          }
        }
      }
      if (currentInRoom.length + highPriorityNeeded >= 5) {
        return false;
      }
    }

    return true;
  };

  // Helper: calculate class-specific remaining percentage
  const getClassRemainingPercentage = (paperId: string, roomId: string): number => {
    const p = paperMap.get(paperId);
    const target = p && p.totalTargetSessions > 0 ? p.totalTargetSessions : 30;
    const completed = roomPaperCompletedMap.get(roomId)?.get(paperId) || 0;
    const remaining = Math.max(0, target - completed);
    return target > 0 ? (remaining / target) * 100 : 0;
  };

  // 3. Subject Room Distribution: Round-robin by paper (Paper 1 -> Paper 2 -> ... -> Paper 13 -> repeat)
  // "perhle paper 1 ka koi v. ek count filling hoga.. fir paper 2 ka ek count fir paper 3 so on.. aur firse paper 13 k baad repeat hoga.. jab tak distribution alloted subjects complete na ho.. and rooms are ranked b remaining demand percentage.. for indivusual subject"
  
  // Rule 9 (Tier 1 Constraint): Pre-seed practical slots in each scheduled practical room
  if (activeRules.enablePracticalConsecutiveDoublePeriodLimit !== false && isPracticalActive && classrooms.length >= practicalRoomsCount) {
    for (const sp of scheduledPracticals) {
      for (const _p of sp.periods) {
        roomAssignedPapers.get(sp.room.id)!.push(practicalPaper);
      }
    }
    const totalPracticalPeriods = scheduledPracticals.reduce((sum, sp) => sum + sp.periods.length, 0);
    paperAllocatedCount.set(practicalPaper.id, totalPracticalPeriods);
  }

  // Pre-seed Exam session (Period 5) across ALL classrooms when Exam is active
  if (isExamActive) {
    for (const r of classrooms) {
      roomAssignedPapers.get(r.id)!.push(examPaper);
    }
    paperAllocatedCount.set(examPaper.id, classrooms.length);
  }

  let addedInRound = true;
  while (addedInRound) {
    addedInRound = false;
    for (const paper of schedulingPapers) {
      // Under Rule 9, practical is pre-allocated with exactly 4 slots across 2 rooms
      if (activeRules.enablePracticalConsecutiveDoublePeriodLimit !== false && isPracticalActive && (paper.id === practicalPaper.id || paper.theoryOrPractical === 'PRACTICAL')) {
        continue;
      }
      // Exam is pre-allocated to Period 5 across all classrooms
      if (isExamActive && (paper.id === examPaper.id || paper.theoryOrPractical === 'EXAM')) {
        continue;
      }
      const alloc = curriculumPlan.allocations.get(paper.id);
      let targetSessions = alloc ? alloc.integerTarget : 0;

      // If explicit minimum periods configured in options, ensure target respects it
      if (prioritySubjectMinPeriods[paper.id] && prioritySubjectMinPeriods[paper.id] > targetSessions) {
        targetSessions = prioritySubjectMinPeriods[paper.id];
      }

      if (targetSessions <= 0) continue;
      const currentAssigned = paperAllocatedCount.get(paper.id) || 0;
      if (currentAssigned >= targetSessions) continue;

      // Rank eligible classrooms for this individual subject: highest remaining demand % first
      const eligibleRooms = classrooms
        .filter((r) => canAddPaperToRoom(paper.id, r.id))
        .sort((a, b) => {
          // Classrooms without this paper yet get it first
          const hasA = (roomAssignedPapers.get(a.id) || []).some((item) => item.id === paper.id) ? 1 : 0;
          const hasB = (roomAssignedPapers.get(b.id) || []).some((item) => item.id === paper.id) ? 1 : 0;
          if (hasA !== hasB) return hasA - hasB;

          // Highest remaining demand % for this individual paper in this room
          const pctA = getClassRemainingPercentage(paper.id, a.id);
          const pctB = getClassRemainingPercentage(paper.id, b.id);
          if (Math.abs(pctA - pctB) > 0.001) return pctB - pctA;

          // Classrooms with fewer periods assigned so far
          const loadA = roomAssignedPapers.get(a.id)?.length || 0;
          const loadB = roomAssignedPapers.get(b.id)?.length || 0;
          if (loadA !== loadB) return loadA - loadB;

          const remA = Math.max(0, (paper.totalTargetSessions || 30) - (roomPaperCompletedMap.get(a.id)?.get(paper.id) || 0));
          const remB = Math.max(0, (paper.totalTargetSessions || 30) - (roomPaperCompletedMap.get(b.id)?.get(paper.id) || 0));
          if (remA !== remB) return remB - remA;

          // Classrooms where candidate primary teachers have fewer visits in this room
          const pPrimaries = (paper.primaryTeacherIds || []).map((tid) => teacherMap.get(tid)).filter(Boolean) as Teacher[];
          if (pPrimaries.length > 0) {
            const anyExcessA = pPrimaries.some((t) => !isTeacherRoomVisitBalanced(t, a.id)) ? 1 : 0;
            const anyExcessB = pPrimaries.some((t) => !isTeacherRoomVisitBalanced(t, b.id)) ? 1 : 0;
            if (anyExcessA !== anyExcessB) return anyExcessA - anyExcessB;

            const minTVa = Math.min(...pPrimaries.map((t) => teacherRoomDeploymentCount.get(t.id)?.get(a.id) || 0));
            const minTVb = Math.min(...pPrimaries.map((t) => teacherRoomDeploymentCount.get(t.id)?.get(b.id) || 0));
            if (minTVa !== minTVb) return minTVa - minTVb;
          }

          // Rotational campus offset so subjects with smaller daily counts (e.g. Paper-12)
          // rotate evenly across both Old Building and New Building instead of clustering in low-index rooms
          const idxA = classroomIndexMap.get(a.id) || 1;
          const idxB = classroomIndexMap.get(b.id) || 1;
          const dayOffset = (targetDayNumber * 3) % classrooms.length;
          const distA = (idxA - dayOffset + classrooms.length) % classrooms.length;
          const distB = (idxB - dayOffset + classrooms.length) % classrooms.length;
          if (distA !== distB) return distA - distB;

          return a.id.localeCompare(b.id);
        });

      if (eligibleRooms.length > 0) {
        const room = eligibleRooms[0];
        roomAssignedPapers.get(room.id)!.push(paper);
        paperAllocatedCount.set(paper.id, currentAssigned + 1);
        addedInRound = true;
      }
    }
  }

  // 4. Part F: Fill Vacant Periods & Balance Classes
  let vacanciesFilledCount = 0;
  for (const room of classrooms) {
    const assigned = roomAssignedPapers.get(room.id)!;
    while (assigned.length < 5) {
      // Find candidate subjects with remaining curriculum demand that satisfy room constraints
      const candidatePapers = schedulingPapers
        .filter((p) => {
          if (activeRules.enablePracticalConsecutiveDoublePeriodLimit !== false && isPracticalActive && (p.id === practicalPaper.id || p.theoryOrPractical === 'PRACTICAL')) {
            return false;
          }
          return canAddPaperToRoom(p.id, room.id);
        })
        .sort((a, b) => {
          const allocA = curriculumPlan.allocations.get(a.id);
          const allocB = curriculumPlan.allocations.get(b.id);
          const deficitA = (allocA ? allocA.integerTarget : 0) - (paperAllocatedCount.get(a.id) || 0);
          const deficitB = (allocB ? allocB.integerTarget : 0) - (paperAllocatedCount.get(b.id) || 0);
          if (deficitA !== deficitB) return deficitB - deficitA; // Under-allocated papers first!

          const pPrimA = (a.primaryTeacherIds || []).map((tid) => teacherMap.get(tid)).filter(Boolean) as Teacher[];
          const pPrimB = (b.primaryTeacherIds || []).map((tid) => teacherMap.get(tid)).filter(Boolean) as Teacher[];
          const excessA = pPrimA.some((t) => !isTeacherRoomVisitBalanced(t, room.id)) ? 1 : 0;
          const excessB = pPrimB.some((t) => !isTeacherRoomVisitBalanced(t, room.id)) ? 1 : 0;
          if (excessA !== excessB) return excessA - excessB;

          const pctA = getClassRemainingPercentage(a.id, room.id);
          const pctB = getClassRemainingPercentage(b.id, room.id);
          return pctB - pctA;
        });

      if (candidatePapers.length === 0) break;
      const chosen = candidatePapers[0];
      assigned.push(chosen);
      paperAllocatedCount.set(chosen.id, (paperAllocatedCount.get(chosen.id) || 0) + 1);
      vacanciesFilledCount++;
    }
  }

  // Update audit allocation assigned counts
  for (const [pid, count] of paperAllocatedCount.entries()) {
    const alloc = curriculumPlan.allocations.get(pid);
    if (alloc) alloc.assignedCount = count;
  }

  // 5. Part G: Subject Rotational Wave Sequencing (Rule 12 & Rule 6B)
  const roomDailyPlans = new Map<string, Paper[]>();
  const paperWavePhase = new Map<string, number>();
  schedulingPapers.forEach((p, idx) => {
    paperWavePhase.set(p.id, (idx * 2) % 5);
  });

  const permute5 = (arr: Paper[]): Paper[][] => {
    if (arr.length <= 1) return [arr];
    const res: Paper[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const cur = arr[i];
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const p of permute5(rest)) {
        res.push([cur, ...p]);
      }
    }
    return res;
  };

  for (let rIdx = 0; rIdx < classrooms.length; rIdx++) {
    const room = classrooms[rIdx];
    const assigned = roomAssignedPapers.get(room.id) || [];
    if (assigned.length < 5) {
      // Fallback in rare constraint lockout: fill with any non-completed papers
      for (const p of schedulingPapers) {
        if (assigned.length >= 5) break;
        if (
          activeRules.enablePracticalConsecutiveDoublePeriodLimit !== false &&
          isPracticalActive &&
          (p.id === practicalPaper.id || p.theoryOrPractical === 'PRACTICAL')
        ) {
          continue;
        }
        if (!assigned.includes(p) && !isPaperRoomQuotaCompleted(room.id, p.id)) {
          assigned.push(p);
        }
      }
    }

    // Rule 9 (Tier 1 Constraint): Lock practical in designated consecutive periods for practical rooms
    const scheduledPracsForRoom = scheduledPracticals.filter((sp) => sp.room.id === room.id);

    // When Exam is active, Period 5 (index 4) is ALWAYS examPaper across all classrooms!
    if (isExamActive) {
      if (
        activeRules.enablePracticalConsecutiveDoublePeriodLimit !== false &&
        isPracticalActive &&
        scheduledPracsForRoom.length > 0
      ) {
        const practicalIndices = new Set<number>();
        for (const sp of scheduledPracsForRoom) {
          for (const p of sp.periods) {
            if (p < 5) practicalIndices.add(p - 1);
          }
        }
        const theoryCountNeeded = 4 - practicalIndices.size;
        const theoryList = assigned.filter(
          (p) => p.id !== practicalPaper.id && p.id !== examPaper.id && p.theoryOrPractical !== 'PRACTICAL' && p.theoryOrPractical !== 'EXAM'
        );
        while (theoryList.length < theoryCountNeeded) {
          for (const p of schedulingPapers) {
            if (
              p.id !== practicalPaper.id &&
              p.id !== examPaper.id &&
              p.theoryOrPractical !== 'PRACTICAL' &&
              p.theoryOrPractical !== 'EXAM' &&
              !theoryList.includes(p)
            ) {
              theoryList.push(p);
              if (theoryList.length >= theoryCountNeeded) break;
            }
          }
        }
        const fullPerm: Paper[] = new Array(5).fill(null);
        fullPerm[4] = examPaper;
        for (const idx of practicalIndices) {
          fullPerm[idx] = practicalPaper;
        }
        let tIdx = 0;
        for (let i = 0; i < 4; i++) {
          if (!practicalIndices.has(i)) {
            fullPerm[i] = theoryList[tIdx++] || schedulingPapers[0];
          }
        }
        roomDailyPlans.set(room.id, fullPerm);
        continue;
      } else {
        // Room without practical: 4 theory papers + examPaper in Period 5 (index 4)
        const theoryList = assigned.filter(
          (p) => p.id !== practicalPaper.id && p.id !== examPaper.id && p.theoryOrPractical !== 'PRACTICAL' && p.theoryOrPractical !== 'EXAM'
        );
        while (theoryList.length < 4) {
          for (const p of schedulingPapers) {
            if (
              p.id !== practicalPaper.id &&
              p.id !== examPaper.id &&
              p.theoryOrPractical !== 'PRACTICAL' &&
              p.theoryOrPractical !== 'EXAM' &&
              !theoryList.includes(p)
            ) {
              theoryList.push(p);
              if (theoryList.length >= 4) break;
            }
          }
        }
        const perms4 = permute5(theoryList.slice(0, 4));
        let best4 = theoryList.slice(0, 4);
        let minWaveDistance = Infinity;
        for (const p4 of perms4) {
          let dist = 0;
          for (let i = 0; i < 4; i++) {
            const paper = p4[i];
            if (!paper) continue;
            const phase = paperWavePhase.get(paper.id) || 0;
            const idealPeriod = (rIdx - phase + 50) % 5;
            const diff = Math.min(Math.abs(i - idealPeriod), 5 - Math.abs(i - idealPeriod));
            dist += diff;
          }
          if (dist < minWaveDistance) {
            minWaveDistance = dist;
            best4 = p4;
            if (dist === 0) break;
          }
        }
        const fullPerm: Paper[] = [...best4, examPaper];
        roomDailyPlans.set(room.id, fullPerm);
        continue;
      }
    }

    if (
      activeRules.enablePracticalConsecutiveDoublePeriodLimit !== false &&
      isPracticalActive &&
      scheduledPracsForRoom.length > 0
    ) {
      const practicalPeriodIndices = new Set<number>();
      for (const sp of scheduledPracsForRoom) {
        for (const p of sp.periods) {
          practicalPeriodIndices.add(p - 1); // 0-based
        }
      }

      const theoryCountNeeded = 5 - practicalPeriodIndices.size;
      const theoryList = assigned.filter((p) => p.id !== practicalPaper.id && p.theoryOrPractical !== 'PRACTICAL');

      while (theoryList.length < theoryCountNeeded) {
        let added = false;
        for (const p of schedulingPapers) {
          if (
            p.id !== practicalPaper.id &&
            p.theoryOrPractical !== 'PRACTICAL' &&
            !theoryList.includes(p) &&
            !isPaperRoomQuotaCompleted(room.id, p.id)
          ) {
            theoryList.push(p);
            added = true;
            if (theoryList.length >= theoryCountNeeded) break;
          }
        }
        if (!added) break;
      }

      const theoryPerms = theoryCountNeeded <= 3 ? permute5(theoryList.slice(0, theoryCountNeeded)) : [theoryList.slice(0, theoryCountNeeded)];
      let bestRoomPerm: Paper[] = [];
      let minWaveDist = Infinity;

      for (const tPerm of theoryPerms) {
        const fullPerm: Paper[] = new Array(5);
        for (const pIdx of practicalPeriodIndices) {
          fullPerm[pIdx] = practicalPaper;
        }
        let tIdx = 0;
        for (let i = 0; i < 5; i++) {
          if (!practicalPeriodIndices.has(i)) {
            fullPerm[i] = tPerm[tIdx++];
          }
        }

        // Wave distance for theory slots
        let dist = 0;
        for (let i = 0; i < 5; i++) {
          if (practicalPeriodIndices.has(i)) continue;
          const paper = fullPerm[i];
          if (!paper) continue;
          const phase = paperWavePhase.get(paper.id) || 0;
          const idealPeriod = (rIdx - phase + 50) % 5;
          const diff = Math.min(Math.abs(i - idealPeriod), 5 - Math.abs(i - idealPeriod));
          dist += diff;
        }

        if (dist < minWaveDist) {
          minWaveDist = dist;
          bestRoomPerm = fullPerm;
          if (dist === 0) break;
        }
      }

      roomDailyPlans.set(room.id, bestRoomPerm.length === 5 ? bestRoomPerm : assigned);
      continue;
    }

    const perms = permute5(assigned);
    let bestPerm = assigned;
    let minWaveDistance = Infinity;

    for (const perm of perms) {
      // Check Rule 6B constraint: Prevent consecutive periods of same subject
      let violates6B = false;
      if (!activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && activeRules.enableMaxRoomDailyLimit && activeRules.enableNonConsecutiveGapForSameSubject) {
        for (let pIdx = 0; pIdx < perm.length - 1; pIdx++) {
          if (perm[pIdx].id === perm[pIdx + 1].id) {
            if (perm[pIdx].id === practicalPaper.id || perm[pIdx].theoryOrPractical === 'PRACTICAL') {
              // Practical consecutive is allowed/required under Rule 9
            } else {
              violates6B = true;
              break;
            }
          }
        }
      }
      if (violates6B) continue;

      // Calculate distance to ideal wave period: (P, R) -> (P+1, R+1)
      let dist = 0;
      for (let pIdx = 0; pIdx < perm.length; pIdx++) {
        const paper = perm[pIdx];
        const phase = paperWavePhase.get(paper.id) || 0;
        const idealPeriod = (rIdx - phase + 50) % 5;
        const diff = Math.min(Math.abs(pIdx - idealPeriod), 5 - Math.abs(pIdx - idealPeriod));
        dist += diff;
      }

      if (dist < minWaveDistance) {
        minWaveDistance = dist;
        bestPerm = perm;
        if (dist === 0) break;
      }
    }

    roomDailyPlans.set(room.id, bestPerm);
  }

  // 6. Part H & I: Teacher Workload Calculation & Assignment
  const teacherLastSlot = new Map<
    string,
    { period: number; building: 'OLD' | 'NEW' | string; roomIndex: number }
  >();

  // Teacher room rotation target
  const teacherTargetRoomIndex = new Map<string, number>();

  teachers.forEach((t, i) => {
    let initialTarget: number;
    if (t.assignedBuilding === 'OLD') {
      initialTarget = (i % 8) + 1;
    } else if (t.assignedBuilding === 'NEW') {
      initialTarget = 9 + (i % 7);
    } else {
      initialTarget = (i % classrooms.length) + 1;
    }

    if (previousDayRoutine && previousDayRoutine.slots) {
      const pastSlots = previousDayRoutine.slots
        .filter((s) => s.teacherId === t.id)
        .sort((a, b) => b.period - a.period);
      if (pastSlots.length > 0) {
        const lastSlot = pastSlots[0];
        const lastRoomIndex = classroomIndexMap.get(lastSlot.roomId) || 1;
        if (t.assignedBuilding === 'OLD') {
          initialTarget = (lastRoomIndex % 8) + 1;
        } else if (t.assignedBuilding === 'NEW') {
          initialTarget = 9 + ((lastRoomIndex - 9 + 1) % 7);
        } else {
          initialTarget = (lastRoomIndex % classrooms.length) + 1;
        }
      }
    }

    teacherTargetRoomIndex.set(t.id, initialTarget);
  });

  const getTeacherTotalLoad = (tid: string): number => {
    return (teacherHistoricalSessions.get(tid) || 0) + (teacherDailyLoad.get(tid) || 0);
  };

  // Helper to check building change gap (Rule 4 & Rule 4A)
  const hasBuildingChangeConflict = (
    teacherId: string,
    period: number,
    targetBuilding: 'OLD' | 'NEW' | string
  ): boolean => {
    if (!activeRules.enableBuildingChangeGap) return false;
    const last = teacherLastSlot.get(teacherId);
    if (!last) return false;
    if (last.building === targetBuilding) return false;
    if (last.period === period - 1) {
      // Rule 4A: Exclude Period 3 to Period 4 transit from mandatory gap (recess break)
      if (
        activeRules.enableBuildingChangeGapPeriod3To4Exemption &&
        last.period === 3 &&
        period === 4
      ) {
        return false;
      }
      return true;
    }
    return false;
  };

  // Sort candidate teachers to minimize workload difference and prioritize unvisited classrooms (Part H & I, Rule 22)
  const sortCandidatesByFairWorkload = (
    candidates: Teacher[],
    roomId: string,
    roomIndex: number,
    roomBuilding?: string
  ): Teacher[] => {
    return [...candidates].sort((a, b) => {
      // 1. Same-Day Room Uniqueness: Avoid detailing the same instructor in the same room twice on the same day
      const inRoomTodayA = generatedSlots.some((s) => s.roomId === roomId && s.teacherId === a.id) ? 1 : 0;
      const inRoomTodayB = generatedSlots.some((s) => s.roomId === roomId && s.teacherId === b.id) ? 1 : 0;
      if (inRoomTodayA !== inRoomTodayB) return inRoomTodayA - inRoomTodayB;

      // 2. Anti-clustering: avoid candidate who taught in this room yesterday
      const yestA = teacherYesterdayRooms.get(a.id)?.has(roomId) ? 1 : 0;
      const yestB = teacherYesterdayRooms.get(b.id)?.has(roomId) ? 1 : 0;
      if (yestA !== yestB) return yestA - yestB;

      // 3. Room Exposure Balance Gap (Difference <= 2 Cap)
      // Strictly penalize instructors whose visits in this room already exceed their minimum eligible room visits by >= 2
      const excessA = isTeacherRoomVisitBalanced(a, roomId) ? 0 : 1;
      const excessB = isTeacherRoomVisitBalanced(b, roomId) ? 0 : 1;
      if (excessA !== excessB) return excessA - excessB;

      // 4. Soft daily cap: instructors with < 3 periods today prioritized
      const loadA = teacherDailyLoad.get(a.id) || 0;
      const loadB = teacherDailyLoad.get(b.id) || 0;
      if (activeRules.enableDailyWorkloadSoftCap) {
        const cappedA = loadA >= 3 ? 1 : 0;
        const cappedB = loadB >= 3 ? 1 : 0;
        if (cappedA !== cappedB) return cappedA - cappedB;
      }

      // 5. Rule 22: Unvisited Classroom Instructor Prioritization (Building-Wise Exposure)
      // Strongly prioritize instructors who have NEVER visited this room (0 visits)
      const visitsA = teacherRoomDeploymentCount.get(a.id)?.get(roomId) || 0;
      const visitsB = teacherRoomDeploymentCount.get(b.id)?.get(roomId) || 0;

      const isUnvisitedA = visitsA === 0;
      const isUnvisitedB = visitsB === 0;

      // Highest priority to instructor who has NEVER taught in this room (0 visits)
      if (isUnvisitedA !== isUnvisitedB) {
        return isUnvisitedA ? -1 : 1;
      }

      // If both are unvisited (0 visits), check building-specific affinity
      if (isUnvisitedA && isUnvisitedB && roomBuilding) {
        const matchA = a.assignedBuilding === roomBuilding ? 1 : 0;
        const matchB = b.assignedBuilding === roomBuilding ? 1 : 0;
        if (matchA !== matchB) {
          // Prioritize building-specific instructor over floating to ensure home-building coverage
          return matchB - matchA;
        }
      }

      // 6. Lowest previous visits to this room first (fair room share, prevents repetitive dumping in same room)
      if (visitsA !== visitsB) return visitsA - visitsB;

      // 7. Equalize Daily Workload: Always prefer teacher with fewer periods today
      if (loadA !== loadB) {
        return loadA - loadB;
      }

      // 8. Cumulative Workload Balancing: prefer teacher with fewer total historical sessions
      const totalA = getTeacherTotalLoad(a.id);
      const totalB = getTeacherTotalLoad(b.id);
      if (activeRules.enableWorkloadEqualization && totalA !== totalB) {
        return totalA - totalB;
      }

      // 9. Floating Faculty Building Exposure Balance:
      // For FLOATING teachers, prefer the instructor who has fewer visits in this building
      if (a.assignedBuilding === 'FLOATING' && b.assignedBuilding === 'FLOATING' && roomBuilding) {
        const bVisitsA = teacherBuildingDeploymentCount.get(a.id)?.get(roomBuilding) || 0;
        const bVisitsB = teacherBuildingDeploymentCount.get(b.id)?.get(roomBuilding) || 0;
        if (bVisitsA !== bVisitsB) return bVisitsA - bVisitsB;
      }

      // 10. Room carousel circular distance
      const targetA = teacherTargetRoomIndex.get(a.id) || 1;
      const targetB = teacherTargetRoomIndex.get(b.id) || 1;
      const distA = (roomIndex - targetA + classrooms.length) % classrooms.length;
      const distB = (roomIndex - targetB + classrooms.length) % classrooms.length;
      if (distA !== distB) return distA - distB;

      if (totalA !== totalB) return totalA - totalB;
      return compareTeacherCodes(a, b);
    });
  };

  const isTeacherEligibleInPeriod = (
    tid: string,
    period: number,
    room: Classroom,
    busyInPeriod: Set<string>,
    currentPaperId?: string
  ): boolean => {
    if (!availableTeacherIds.has(tid)) return false;
    if (activeRules.enableZeroDoubleBooking && busyInPeriod.has(tid)) return false;
    const t = teacherMap.get(tid);
    if (!t) return false;
    // Rule 9 (Tier 1 Constraint): Practical & Theory eligibility
    const isCurrentPractical = isPracticalActive && (currentPaperId === practicalPaper.id || (currentPaperId && paperMap.get(currentPaperId)?.theoryOrPractical === 'PRACTICAL'));
    const practicalCount = teacherPracticalCounts.get(tid) || 0;

    if (isCurrentPractical) {
      if (!scheduledPracticalSlots.has(`${room.id}-P${period}-${tid}`)) {
        return false;
      }
    } else {
      if (practicalCount > 0) {
        const pracPeriods = teacherPracticalPeriodsMap.get(tid) || [];
        if (pracPeriods.includes(period)) {
          return false;
        }
        if (highDeploymentPracticalTeacherIds.has(tid)) {
          return false;
        }
      }
    }
    // Rule 25: Strict Instructor Designated Off-Period Protection (Excuse Rule)
    if (activeRules.enableInstructorDesignatedOffPeriods !== false) {
      const offPeriods = getTeacherOffPeriods(tid);
      if (offPeriods.includes(period)) return false;
    }
    if (!isTeacherAllowedInRoomBuilding(t, room.building)) return false;
    if (hasBuildingChangeConflict(tid, period, room.building)) return false;
    const currentDaily = teacherDailyLoad.get(tid) || 0;
    const instructorMappingCap = t.maxDailyPeriods !== undefined ? t.maxDailyPeriods : 4;
    const maxAllowed = highDeploymentPracticalTeacherIds.has(tid)
      ? 2
      : instructorMappingCap;
    const futurePracCount = isCurrentPractical
      ? 0
      : (teacherPracticalPeriodsMap.get(tid) || []).filter((p) => p >= period).length;
    if (activeRules.enableDailyWorkloadMaxCap && (currentDaily + futurePracCount) >= maxAllowed) return false;
    return true;
  };

  // 7. Generate Slots Period by Period (P1 to P5)
  const generatedSlots: ClassSlot[] = [];
  let replacementsCount = 0;
  let noInstructorCount = 0;

  const orderedRooms = [...classrooms].sort(
    (a, b) => (classroomIndexMap.get(a.id) || 0) - (classroomIndexMap.get(b.id) || 0)
  );

  if (activeRules.enableTeacherLoadEqualizationPriority) {
    // =========================================================================
    // RULE 8: TEACHER LOAD EQUALIZATION PRIORITY (TEACHER-FIRST DETAILMENT)
    // =========================================================================
    // When enabled, instructor session equalization takes absolute priority over
    // classroom curriculum targets.
    // Principles:
    // 1. Teachers are detailed first; lagging teachers (fewer cumulative sessions)
    //    receive more classes.
    // 2. Classrooms curriculum counts are bypassed; subject is assigned directly from
    //    the instructor's primary paper mapping.
    // 3. Teachers belonging to the same paper category (and same paper) will NOT appear
    //    together in the same classroom on the same day.
    // 4. Instructors are prioritized for deployment in classrooms where their historical
    //    deployment / visit count has been the lowest (broad building exposure).
    // =========================================================================

    const getTeacherPrimaryPaper = (t: Teacher): Paper => {
      for (const pid of t.primaryPaperIds || []) {
        const p = paperMap.get(pid);
        if (p) return p;
      }
      const mapped = papers.find((p) => (p.primaryTeacherIds || []).includes(t.id));
      return mapped || papers[0];
    };

    const getTeacherPaperCategory = (t: Teacher, paper?: Paper): string => {
      const p = paper || getTeacherPrimaryPaper(t);
      return p.code || p.id;
    };

    const isSubjectCompletedInRoom = (roomId: string, paperId: string): boolean => {
      if (isPaperRoomQuotaCompleted(roomId, paperId)) return true;
      const completed = roomPaperCompletedMap.get(roomId)?.get(paperId) || 0;
      const p = paperMap.get(paperId);
      const target = p && p.totalTargetSessions > 0 ? p.totalTargetSessions : 30;
      return target > 0 && completed >= target;
    };

    const isSubjectAllowedTodayInRoom = (roomId: string, paperId: string): boolean => {
      if (activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily) {
        return !roomAssignedPaperIds.get(roomId)!.has(paperId);
      }
      if (activeRules.enableMaxRoomDailyLimit) {
        const count = [...slotMatrix.get(roomId)!.values()].filter((s) => s && s.paper.id === paperId).length;
        return count < 2;
      }
      return true;
    };

    interface TeacherSubjectMatch {
      paper: Paper;
      isOptionSubject: boolean;
    }

    /**
     * Determines the paper for a teacher in a given classroom under Teacher-First Detailment:
     * 1. Main subject (primaryPaperIds):
     *    If main subject is NOT complete in the classroom AND allowed today:
     *    -> Returns main subject ({ paper, isOptionSubject: false }).
     * 2. If main subject IS complete in the classroom (or already taught today):
     *    -> Checks option subjects (backupPaperIds, then secondaryPaperIds).
     *    -> Returns first option subject that is NOT complete in the classroom AND allowed today ({ paper, isOptionSubject: true }).
     * 3. If teacher has no option subject, or all option subjects are also completed in this classroom (or already taught today):
     *    -> Returns null. (Teacher cannot teach this classroom; classroom must be filled by another eligible teacher).
     */
    const determinePaperForTeacherInRoom = (
      teacher: Teacher,
      roomId: string,
      allowDailyDuplicate: boolean = false
    ): TeacherSubjectMatch | null => {
      // 1. Try Main Subject (primaryPaperIds)
      for (const pid of teacher.primaryPaperIds || []) {
        if (combinedExcludedSet.has(pid)) continue;
        const p = paperMap.get(pid);
        if (!p) continue;
        const isQuotaDone = isSubjectCompletedInRoom(roomId, pid);
        const isAllowedToday = allowDailyDuplicate || isSubjectAllowedTodayInRoom(roomId, pid);
        if (!isQuotaDone && isAllowedToday) {
          return { paper: p, isOptionSubject: false };
        }
      }

      // If primaryPaperIds was empty, check primary mapping from papers
      if (!teacher.primaryPaperIds || teacher.primaryPaperIds.length === 0) {
        const mapped = papers.find((p) => (p.primaryTeacherIds || []).includes(teacher.id));
        if (mapped && !combinedExcludedSet.has(mapped.id)) {
          const isQuotaDone = isSubjectCompletedInRoom(roomId, mapped.id);
          const isAllowedToday = allowDailyDuplicate || isSubjectAllowedTodayInRoom(roomId, mapped.id);
          if (!isQuotaDone && isAllowedToday) {
            return { paper: mapped, isOptionSubject: false };
          }
        }
      }

      // 2. Main subject is complete in this classroom (or not allowed today).
      // Check Option Subjects (backupPaperIds, then secondaryPaperIds)
      const optionPaperIds = [
        ...(teacher.backupPaperIds || []),
        ...(teacher.secondaryPaperIds || []),
      ];

      for (const pid of optionPaperIds) {
        if (combinedExcludedSet.has(pid)) continue;
        const p = paperMap.get(pid);
        if (!p) continue;
        const isQuotaDone = isSubjectCompletedInRoom(roomId, pid);
        const isAllowedToday = allowDailyDuplicate || isSubjectAllowedTodayInRoom(roomId, pid);
        if (!isQuotaDone && isAllowedToday) {
          return { paper: p, isOptionSubject: true };
        }
      }

      // 3. No option subject available or all option subjects are complete in this classroom
      return null;
    };

    const roomAssignedTeacherIds = new Map<string, Set<string>>();
    const roomAssignedPaperIds = new Map<string, Set<string>>();
    const roomAssignedCategories = new Map<string, Set<string>>();
    for (const r of classrooms) {
      roomAssignedTeacherIds.set(r.id, new Set());
      roomAssignedPaperIds.set(r.id, new Set());
      roomAssignedCategories.set(r.id, new Set());
    }

    // =========================================================================
    // TIER 1: TEACHER-FIRST DETAILMENT EQUALIZATION ENGINE (RULE 8)
    // =========================================================================
    // 1. Practical classes (if active) are scheduled as 2 consecutive periods.
    // 2. Candidates with deployment < maxDeployment are lagging teachers, detailed first
    //    for their main subject. Iterated teacher-by-teacher.
    // 3. When an instructor reaches top count (or round completes), cycle restarts from lowest.
    // 4. Once equalized, continue round-robin 1 session per teacher until all 75 slots are complete.
    // 5. Room assignment: Place teacher in the classroom where they have the lowest historical
    //    detailment count (least visits), respecting building binding and Tier 1 rules.
    // =========================================================================

    interface PlannedSlot {
      teacher: Teacher;
      paper: Paper;
      practicalName?: string;
      practicalSubjectId?: string;
      isSubstitute?: boolean;
      substituteReason?: string;
    }

    const slotMatrix = new Map<string, Map<number, PlannedSlot | null>>();
    for (const r of orderedRooms) {
      const pMap = new Map<number, PlannedSlot | null>();
      for (let p = 1; p <= 5; p++) {
        pMap.set(p, null);
      }
      slotMatrix.set(r.id, pMap);
    }
    let filledSlotsCount = 0;

    // Helper: is teacher busy at period p in any room?
    const isTeacherBusyInPeriod = (teacherId: string, period: number): boolean => {
      for (const r of orderedRooms) {
        const slot = slotMatrix.get(r.id)?.get(period);
        if (slot && slot.teacher.id === teacherId) return true;
      }
      return false;
    };

    // Helper: get current building of teacher at period p if assigned
    const getTeacherBuildingAtPeriod = (teacherId: string, period: number): string | null => {
      for (const r of orderedRooms) {
        const slot = slotMatrix.get(r.id)?.get(period);
        if (slot && slot.teacher.id === teacherId) return r.building;
      }
      return null;
    };

    // Helper: transit conflict check across period p-1 and p+1
    const hasTransitConflict = (teacherId: string, period: number, targetBuilding: string): boolean => {
      if (!activeRules.enableBuildingChangeGap) return false;
      if (period > 1) {
        const prevBuilding = getTeacherBuildingAtPeriod(teacherId, period - 1);
        if (prevBuilding && prevBuilding !== targetBuilding) {
          if (!(activeRules.enableBuildingChangeGapPeriod3To4Exemption && period === 4)) {
            return true;
          }
        }
      }
      if (period < 5) {
        const nextBuilding = getTeacherBuildingAtPeriod(teacherId, period + 1);
        if (nextBuilding && nextBuilding !== targetBuilding) {
          if (!(activeRules.enableBuildingChangeGapPeriod3To4Exemption && period === 3)) {
            return true;
          }
        }
      }
      return false;
    };

    // Helper: teacher total deployment count
    const getTeacherTotalDeployment = (t: Teacher): number => {
      return (teacherHistoricalSessions.get(t.id) || 0) + (teacherDailyLoad.get(t.id) || 0);
    };

    // Pre-assigned practical slots under Rule 8 & Rule 9
    if (
      activeRules.enablePracticalConsecutiveDoublePeriodLimit !== false &&
      isPracticalActive
    ) {
      for (const sp of scheduledPracticals) {
        for (const p of sp.periods) {
          slotMatrix.get(sp.room.id)!.set(p, {
            teacher: sp.teacher,
            paper: practicalPaper,
            practicalName: sp.name,
            practicalSubjectId: sp.practicalSubjectId,
            isSubstitute: false,
          });
          roomAssignedTeacherIds.get(sp.room.id)!.add(sp.teacher.id);
          roomAssignedPaperIds.get(sp.room.id)!.add(practicalPaper.id);
          roomAssignedCategories.get(sp.room.id)!.add(getTeacherPaperCategory(sp.teacher, practicalPaper));
          teacherDailyLoad.set(sp.teacher.id, (teacherDailyLoad.get(sp.teacher.id) || 0) + 1);

          if (teacherRoomDeploymentCount.has(sp.teacher.id)) {
            const rMap = teacherRoomDeploymentCount.get(sp.teacher.id)!;
            rMap.set(sp.room.id, (rMap.get(sp.room.id) || 0) + 1);
          }
          if (teacherBuildingDeploymentCount.has(sp.teacher.id)) {
            const bMap = teacherBuildingDeploymentCount.get(sp.teacher.id)!;
            bMap.set(sp.room.building, (bMap.get(sp.room.building) || 0) + 1);
          }
          filledSlotsCount++;
        }
      }
    }

    // Pre-assigned exam slots under Rule 8 in Period 5 across all classrooms
    if (isExamActive) {
      const busyTeachersInP5 = new Set<string>();
      for (const r of orderedRooms) {
        const slot = slotMatrix.get(r.id)?.get(5);
        if (slot) busyTeachersInP5.add(slot.teacher.id);
      }

      const candidateInvigilators = availableTeachers.filter((t) => {
        const tOff = getTeacherOffPeriods(t.id);
        if (tOff.includes(5)) return false;
        const currentDaily = teacherDailyLoad.get(t.id) || 0;
        const maxDaily = t.maxDailyPeriods !== undefined ? t.maxDailyPeriods : 4;
        return currentDaily < maxDaily;
      });

      const sortedCandidates = [...candidateInvigilators].sort((a, b) => {
        const loadA = teacherDailyLoad.get(a.id) || 0;
        const loadB = teacherDailyLoad.get(b.id) || 0;
        if (loadA !== loadB) return loadA - loadB;
        const histA = teacherHistoricalSessions.get(a.id) || 0;
        const histB = teacherHistoricalSessions.get(b.id) || 0;
        if (histA !== histB) return histA - histB;
        return compareTeacherCodes(a, b);
      });

      for (const room of orderedRooms) {
        if (slotMatrix.get(room.id)!.get(5) !== null) continue;

        let chosenTeacher: Teacher | undefined;
        for (const t of sortedCandidates) {
          if (busyTeachersInP5.has(t.id)) continue;
          if (!isTeacherAllowedInRoomBuilding(t, room.building)) continue;
          if (hasTransitConflict(t.id, 5, room.building)) continue;
          chosenTeacher = t;
          break;
        }
        if (!chosenTeacher) {
          chosenTeacher = sortedCandidates.find((t) => !busyTeachersInP5.has(t.id));
        }

        if (chosenTeacher) {
          busyTeachersInP5.add(chosenTeacher.id);
          slotMatrix.get(room.id)!.set(5, {
            teacher: chosenTeacher,
            paper: examPaper,
            isSubstitute: false,
            practicalName: options.examConfig?.name || 'Examination / Assessment',
          });
          roomAssignedTeacherIds.get(room.id)!.add(chosenTeacher.id);
          roomAssignedPaperIds.get(room.id)!.add(examPaper.id);
          teacherDailyLoad.set(chosenTeacher.id, (teacherDailyLoad.get(chosenTeacher.id) || 0) + 1);

          if (teacherRoomDeploymentCount.has(chosenTeacher.id)) {
            const rMap = teacherRoomDeploymentCount.get(chosenTeacher.id)!;
            rMap.set(room.id, (rMap.get(room.id) || 0) + 1);
          }
          if (teacherBuildingDeploymentCount.has(chosenTeacher.id)) {
            const bMap = teacherBuildingDeploymentCount.get(chosenTeacher.id)!;
            bMap.set(room.building, (bMap.get(room.building) || 0) + 1);
          }
          filledSlotsCount++;
        }
      }
    }

    // Helper to assign a teacher with their valid subject (main subject if incomplete, option subject if complete)
    // into their least-visited classroom.
    const tryAssignTeacher = (
      teacher: Teacher,
      strictCategory: boolean = true,
      strictRoomRepeat: boolean = true,
      allowExcessDiff: boolean = false
    ): boolean => {
      const currentDaily = teacherDailyLoad.get(teacher.id) || 0;
      const maxDaily = teacher.maxDailyPeriods !== undefined ? teacher.maxDailyPeriods : 4;
      if (currentDaily >= maxDaily) return false;

      // Find eligible classrooms for this teacher
      interface RoomPaperMatch {
        room: Classroom;
        paper: Paper;
        isOptionSubject: boolean;
      }
      const eligibleMatches: RoomPaperMatch[] = [];

      for (const r of orderedRooms) {
        if (!isTeacherAllowedInRoomBuilding(teacher, r.building)) continue;
        const hasOpenPeriod = [1, 2, 3, 4, 5].some((p) => slotMatrix.get(r.id)!.get(p) === null);
        if (!hasOpenPeriod) continue;
        if (!allowExcessDiff && !isTeacherRoomVisitBalanced(teacher, r.id)) continue;
        if (strictRoomRepeat && roomAssignedTeacherIds.get(r.id)!.has(teacher.id)) continue;

        // Determine subject:
        // - Main subject if not complete in this classroom and not duplicate today.
        // - If main subject is complete (or duplicate today), use option subject.
        // - If no option subject is available or all are complete, match is null (classroom not eligible for this teacher).
        const match = determinePaperForTeacherInRoom(teacher, r.id);
        if (!match) continue; // Teacher cannot teach here; another eligible teacher will be assigned instead.

        if (strictCategory && roomAssignedCategories.get(r.id)!.has(getTeacherPaperCategory(teacher, match.paper))) {
          continue;
        }

        eligibleMatches.push({ room: r, paper: match.paper, isOptionSubject: match.isOptionSubject });
      }

      if (eligibleMatches.length === 0) return false;

      // Sort eligible rooms by lowest visits by this teacher first (Rule 22 / broad building exposure)
      eligibleMatches.sort((a, b) => {
        const excessA = isTeacherRoomVisitBalanced(teacher, a.room.id) ? 0 : 1;
        const excessB = isTeacherRoomVisitBalanced(teacher, b.room.id) ? 0 : 1;
        if (excessA !== excessB) return excessA - excessB;

        const visitsA = teacherRoomDeploymentCount.get(teacher.id)?.get(a.room.id) || 0;
        const visitsB = teacherRoomDeploymentCount.get(teacher.id)?.get(b.room.id) || 0;
        if (visitsA !== visitsB) return visitsA - visitsB;

        const openA = [1, 2, 3, 4, 5].filter((p) => slotMatrix.get(a.room.id)!.get(p) === null).length;
        const openB = [1, 2, 3, 4, 5].filter((p) => slotMatrix.get(b.room.id)!.get(p) === null).length;
        if (openA !== openB) return openB - openA;

        return (classroomIndexMap.get(a.room.id) || 1) - (classroomIndexMap.get(b.room.id) || 1);
      });

      for (const { room, paper, isOptionSubject } of eligibleMatches) {
        const openPeriods = [1, 2, 3, 4, 5].filter((p) => slotMatrix.get(room.id)!.get(p) === null);

        for (const period of openPeriods) {
          if (isTeacherBusyInPeriod(teacher.id, period)) continue;
          if (activeRules.enableInstructorDesignatedOffPeriods !== false) {
            const off = getTeacherOffPeriods(teacher.id);
            if (off.includes(period)) continue;
          }
          if (hasTransitConflict(teacher.id, period, room.building)) continue;
          if (activeRules.enableNonConsecutiveGapForSameSubject) {
            if (period > 1) {
              const prev = slotMatrix.get(room.id)!.get(period - 1);
              if (prev && prev.paper.id === paper.id) continue;
            }
            if (period < 5) {
              const next = slotMatrix.get(room.id)!.get(period + 1);
              if (next && next.paper.id === paper.id) continue;
            }
          }

          // Valid placement found!
          slotMatrix.get(room.id)!.set(period, {
            teacher,
            paper,
            isSubstitute: isOptionSubject,
            substituteReason: isOptionSubject
              ? 'Main subject completed in classroom - assigned option subject'
              : undefined,
          });
          roomAssignedTeacherIds.get(room.id)!.add(teacher.id);
          roomAssignedPaperIds.get(room.id)!.add(paper.id);
          roomAssignedCategories.get(room.id)!.add(getTeacherPaperCategory(teacher, paper));
          teacherDailyLoad.set(teacher.id, (teacherDailyLoad.get(teacher.id) || 0) + 1);

          if (teacherRoomDeploymentCount.has(teacher.id)) {
            const rMap = teacherRoomDeploymentCount.get(teacher.id)!;
            rMap.set(room.id, (rMap.get(room.id) || 0) + 1);
          }
          if (teacherBuildingDeploymentCount.has(teacher.id)) {
            const bMap = teacherBuildingDeploymentCount.get(teacher.id)!;
            bMap.set(room.building, (bMap.get(room.building) || 0) + 1);
          }
          filledSlotsCount++;
          return true;
        }
      }
      return false;
    };

    // Main Teacher Equalization Loop
    const totalSlotsTarget = orderedRooms.length * 5; // 75 slots
    let maxCycles = 150; // Safety guard

    while (filledSlotsCount < totalSlotsTarget && maxCycles > 0) {
      maxCycles--;

      const candidates = availableTeachers.filter((t) => {
        const curDaily = teacherDailyLoad.get(t.id) || 0;
        const maxDaily = t.maxDailyPeriods !== undefined ? t.maxDailyPeriods : 4;
        return curDaily < maxDaily;
      });

      if (candidates.length === 0) break;

      const maxDeployment = Math.max(...candidates.map((t) => getTeacherTotalDeployment(t)));

      const laggingTeachers = candidates
        .filter((t) => getTeacherTotalDeployment(t) < maxDeployment)
        .sort((a, b) => getTeacherTotalDeployment(a) - getTeacherTotalDeployment(b) || compareTeacherCodes(a, b));

      if (laggingTeachers.length > 0) {
        let roundMadeAssignment = false;

        for (const t of laggingTeachers) {
          if (getTeacherTotalDeployment(t) >= maxDeployment) {
            break;
          }

          let assigned = tryAssignTeacher(t, true, true, false);
          if (!assigned) {
            assigned = tryAssignTeacher(t, false, true, false);
          }
          if (assigned) {
            roundMadeAssignment = true;
            if (getTeacherTotalDeployment(t) >= maxDeployment) {
              break;
            }
          }
        }

        if (!roundMadeAssignment) {
          let fallbackPlaced = false;
          for (const t of laggingTeachers) {
            if (tryAssignTeacher(t, false, false, false)) {
              fallbackPlaced = true;
              break;
            }
          }
          if (!fallbackPlaced) {
            for (const t of laggingTeachers) {
              if (tryAssignTeacher(t, false, false, true)) {
                fallbackPlaced = true;
                break;
              }
            }
          }
          if (!fallbackPlaced) break;
        }
      } else {
        // All active candidates equalized!
        candidates.sort((a, b) => {
          const dailyA = teacherDailyLoad.get(a.id) || 0;
          const dailyB = teacherDailyLoad.get(b.id) || 0;
          if (dailyA !== dailyB) return dailyA - dailyB;
          return compareTeacherCodes(a, b);
        });

        let roundRobinMadeAssignment = false;
        for (const t of candidates) {
          if (filledSlotsCount >= totalSlotsTarget) break;
          let assigned = tryAssignTeacher(t, true, true, false);
          if (!assigned) {
            assigned = tryAssignTeacher(t, false, true, false);
          }
          if (assigned) {
            roundRobinMadeAssignment = true;
          }
        }

        if (!roundRobinMadeAssignment) {
          let fallbackPlaced = false;
          for (const t of candidates) {
            if (filledSlotsCount >= totalSlotsTarget) break;
            if (tryAssignTeacher(t, false, false, false)) {
              fallbackPlaced = true;
              break;
            }
          }
          if (!fallbackPlaced) {
            for (const t of candidates) {
              if (filledSlotsCount >= totalSlotsTarget) break;
              if (tryAssignTeacher(t, false, false, true)) {
                fallbackPlaced = true;
                break;
              }
            }
          }
          if (!fallbackPlaced) break;
        }
      }
    }

    // Final Completion Pass (ensures 100% of 75 slots are filled while respecting Tier 1 rules)
    if (filledSlotsCount < totalSlotsTarget) {
      for (const room of orderedRooms) {
        for (let period = 1; period <= 5; period++) {
          if (slotMatrix.get(room.id)!.get(period) !== null) continue;

          // 1. Search for another eligible teacher who has an uncompleted subject for this room
          // (either main subject, or option subject)
          const candidateMatches: { teacher: Teacher; paper: Paper; isOptionSubject: boolean }[] = [];

          for (const t of availableTeachers) {
            const curDaily = teacherDailyLoad.get(t.id) || 0;
            const maxDaily = t.maxDailyPeriods !== undefined ? t.maxDailyPeriods : 4;
            if (curDaily >= maxDaily) continue;
            if (isTeacherBusyInPeriod(t.id, period)) continue;
            if (activeRules.enableInstructorDesignatedOffPeriods !== false) {
              if (getTeacherOffPeriods(t.id).includes(period)) continue;
            }
            if (!isTeacherAllowedInRoomBuilding(t, room.building)) continue;
            if (hasTransitConflict(t.id, period, room.building)) continue;

            const match = determinePaperForTeacherInRoom(t, room.id);
            if (match) {
              candidateMatches.push({ teacher: t, paper: match.paper, isOptionSubject: match.isOptionSubject });
            }
          }

          if (candidateMatches.length > 0) {
            candidateMatches.sort((a, b) => {
              const excessA = isTeacherRoomVisitBalanced(a.teacher, room.id) ? 0 : 1;
              const excessB = isTeacherRoomVisitBalanced(b.teacher, room.id) ? 0 : 1;
              if (excessA !== excessB) return excessA - excessB;

              const visitsA = teacherRoomDeploymentCount.get(a.teacher.id)?.get(room.id) || 0;
              const visitsB = teacherRoomDeploymentCount.get(b.teacher.id)?.get(room.id) || 0;
              if (visitsA !== visitsB) return visitsA - visitsB;

              const dailyA = teacherDailyLoad.get(a.teacher.id) || 0;
              const dailyB = teacherDailyLoad.get(b.teacher.id) || 0;
              if (dailyA !== dailyB) return dailyA - dailyB;

              const depA = getTeacherTotalDeployment(a.teacher);
              const depB = getTeacherTotalDeployment(b.teacher);
              if (depA !== depB) return depA - depB;

              return compareTeacherCodes(a.teacher, b.teacher);
            });

            const chosenMatch = candidateMatches[0];
            slotMatrix.get(room.id)!.set(period, {
              teacher: chosenMatch.teacher,
              paper: chosenMatch.paper,
              isSubstitute: chosenMatch.isOptionSubject,
              substituteReason: chosenMatch.isOptionSubject
                ? 'Main subject completed in room - assigned option subject'
                : undefined,
            });
            roomAssignedTeacherIds.get(room.id)!.add(chosenMatch.teacher.id);
            roomAssignedPaperIds.get(room.id)!.add(chosenMatch.paper.id);
            roomAssignedCategories.get(room.id)!.add(getTeacherPaperCategory(chosenMatch.teacher, chosenMatch.paper));
            teacherDailyLoad.set(chosenMatch.teacher.id, (teacherDailyLoad.get(chosenMatch.teacher.id) || 0) + 1);
            if (teacherRoomDeploymentCount.has(chosenMatch.teacher.id)) {
              const rMap = teacherRoomDeploymentCount.get(chosenMatch.teacher.id)!;
              rMap.set(room.id, (rMap.get(room.id) || 0) + 1);
            }
            if (teacherBuildingDeploymentCount.has(chosenMatch.teacher.id)) {
              const bMap = teacherBuildingDeploymentCount.get(chosenMatch.teacher.id)!;
              bMap.set(room.building, (bMap.get(room.building) || 0) + 1);
            }
            filledSlotsCount++;
            continue;
          }

          // 2. Fallback: If no candidate has an uncompleted subject in this room,
          // find any available teacher with any paper not yet in room today
          const fallbackPool = availableTeachers.filter((t) => {
            const curDaily = teacherDailyLoad.get(t.id) || 0;
            const maxDaily = t.maxDailyPeriods !== undefined ? t.maxDailyPeriods : 4;
            if (curDaily >= maxDaily) return false;
            if (isTeacherBusyInPeriod(t.id, period)) return false;
            if (activeRules.enableInstructorDesignatedOffPeriods !== false) {
              if (getTeacherOffPeriods(t.id).includes(period)) return false;
            }
            if (!isTeacherAllowedInRoomBuilding(t, room.building)) return false;
            if (hasTransitConflict(t.id, period, room.building)) return false;
            return true;
          });

          if (fallbackPool.length > 0) {
            fallbackPool.sort((a, b) => {
              const dailyA = teacherDailyLoad.get(a.id) || 0;
              const dailyB = teacherDailyLoad.get(b.id) || 0;
              if (dailyA !== dailyB) return dailyA - dailyB;
              const depA = getTeacherTotalDeployment(a);
              const depB = getTeacherTotalDeployment(b);
              if (depA !== depB) return depA - depB;
              return compareTeacherCodes(a, b);
            });

            const chosen = fallbackPool[0];
            let paper = getTeacherPrimaryPaper(chosen);
            for (const pid of chosen.primaryPaperIds || []) {
              if (!roomAssignedPaperIds.get(room.id)!.has(pid)) {
                const p = paperMap.get(pid);
                if (p) { paper = p; break; }
              }
            }
            if (roomAssignedPaperIds.get(room.id)!.has(paper.id)) {
              for (const pid of chosen.backupPaperIds || []) {
                if (!roomAssignedPaperIds.get(room.id)!.has(pid)) {
                  const p = paperMap.get(pid);
                  if (p) { paper = p; break; }
                }
              }
            }
            if (roomAssignedPaperIds.get(room.id)!.has(paper.id)) {
              for (const pid of chosen.secondaryPaperIds || []) {
                if (!roomAssignedPaperIds.get(room.id)!.has(pid)) {
                  const p = paperMap.get(pid);
                  if (p) { paper = p; break; }
                }
              }
            }

            slotMatrix.get(room.id)!.set(period, {
              teacher: chosen,
              paper,
              isSubstitute: false,
            });
            roomAssignedTeacherIds.get(room.id)!.add(chosen.id);
            roomAssignedPaperIds.get(room.id)!.add(paper.id);
            roomAssignedCategories.get(room.id)!.add(getTeacherPaperCategory(chosen, paper));
            teacherDailyLoad.set(chosen.id, (teacherDailyLoad.get(chosen.id) || 0) + 1);
            if (teacherRoomDeploymentCount.has(chosen.id)) {
              const rMap = teacherRoomDeploymentCount.get(chosen.id)!;
              rMap.set(room.id, (rMap.get(room.id) || 0) + 1);
            }
            if (teacherBuildingDeploymentCount.has(chosen.id)) {
              const bMap = teacherBuildingDeploymentCount.get(chosen.id)!;
              bMap.set(room.building, (bMap.get(room.building) || 0) + 1);
            }
            filledSlotsCount++;
          }
        }
      }
    }

    // Commit all slots from slotMatrix into generatedSlots
    for (let period = 1; period <= 5; period++) {
      for (const room of orderedRooms) {
        const assignment = slotMatrix.get(room.id)?.get(period);
        const roomIndex = classroomIndexMap.get(room.id) || 1;

        if (assignment) {
          const { teacher: chosen, paper, practicalName, practicalSubjectId, isSubstitute, substituteReason } = assignment;
          teacherLastSlot.set(chosen.id, {
            period,
            building: room.building,
            roomIndex,
          });
          teacherTargetRoomIndex.set(chosen.id, (roomIndex % classrooms.length) + 1);

          const isExamSlot = isExamActive && period === 5;
          const slotExamName = isExamSlot ? (options.examConfig?.name || 'Examination / Assessment') : undefined;

          generatedSlots.push({
            id: `slot-${targetDayNumber}-${room.id}-P${period}`,
            roomId: room.id,
            period,
            paperId: paper.id,
            teacherId: chosen.id,
            isSubstitute: Boolean(isSubstitute),
            substituteReason,
            isPriority: priorityPaperIds.includes(paper.id) || (subjectPriorityTiers[paper.id] === 'HIGH'),
            practicalName,
            practicalSubjectId,
            isExam: isExamSlot,
            examName: slotExamName,
            theoryOrPractical: isExamSlot ? 'EXAM' : (paper.id === 'P13' || Boolean(practicalName) ? 'PRACTICAL' : 'THEORY'),
          });
        } else {
          generatedSlots.push({
            id: `slot-${targetDayNumber}-${room.id}-P${period}`,
            roomId: room.id,
            period,
            paperId: '',
            teacherId: '',
            isSubstitute: false,
            substituteReason: 'No instructor available under operational constraints',
          });
          noInstructorCount++;
        }
      }
    }
  } else {
    // =========================================================================
    // STANDARD CURRICULUM-FIRST ROTATIONAL FLOW ENGINE
    // =========================================================================
    for (let period = 1; period <= 5; period++) {
      const busyTeachersInPeriod = new Set<string>();

    // Determine room processing order for this period:
    // When Rule 22 (enableUnvisitedRoomTeacherPrioritization) is active, prioritize classrooms
    // where candidate primary teachers have NEVER taught (0 prior visits), ensuring unvisited
    // rooms are filled first ("uss building me jis room me kabhi koi class nahi kiya hai.. use pehle priority diya jaye.. uss wale room me pehle fillup ho")
    let periodRooms = [...orderedRooms];
    if (activeRules.enableUnvisitedRoomTeacherPrioritization) {
      periodRooms.sort((roomA, roomB) => {
        const planA = roomDailyPlans.get(roomA.id) || [];
        const paperA = planA[period - 1] || schedulingPapers[0] || papers[0];
        const planB = roomDailyPlans.get(roomB.id) || [];
        const paperB = planB[period - 1] || schedulingPapers[0] || papers[0];

        // Check if roomA has available primary teachers with 0 visits in roomA
        const unvisitedA = (paperA.primaryTeacherIds || []).some((tid) => {
          const t = teacherMap.get(tid);
          if (!t || !availableTeacherIds.has(tid)) return false;
          if (!isTeacherAllowedInRoomBuilding(t, roomA.building)) return false;
          const visits = teacherRoomDeploymentCount.get(tid)?.get(roomA.id) || 0;
          return visits === 0;
        });

        // Check if roomB has available primary teachers with 0 visits in roomB
        const unvisitedB = (paperB.primaryTeacherIds || []).some((tid) => {
          const t = teacherMap.get(tid);
          if (!t || !availableTeacherIds.has(tid)) return false;
          if (!isTeacherAllowedInRoomBuilding(t, roomB.building)) return false;
          const visits = teacherRoomDeploymentCount.get(tid)?.get(roomB.id) || 0;
          return visits === 0;
        });

        if (unvisitedA !== unvisitedB) {
          return unvisitedA ? -1 : 1;
        }

        const roomOffset = ((period - 1) * 3 + targetDayNumber) % orderedRooms.length;
        const idxA = ((classroomIndexMap.get(roomA.id) || 1) - roomOffset + classrooms.length) % classrooms.length;
        const idxB = ((classroomIndexMap.get(roomB.id) || 1) - roomOffset + classrooms.length) % classrooms.length;
        return idxA - idxB;
      });
    }

    // Pre-reserve practical slots for this period under Rule 9 so practical teachers are never preempted
    if (activeRules.enablePracticalConsecutiveDoublePeriodLimit !== false && isPracticalActive) {
      for (const sp of scheduledPracticals) {
        if (sp.periods.includes(period)) {
          busyTeachersInPeriod.add(sp.teacher.id);
        }
      }
    }

    for (const room of periodRooms) {
      const roomIndex = classroomIndexMap.get(room.id) || 1;
      const roomPlan = roomDailyPlans.get(room.id) || [];
      let paper = roomPlan[period - 1] || schedulingPapers[0] || papers[0];

      let selectedTeacherId = '';
      let isSubstitute = false;
      let originalTeacherId: string | undefined;
      let substituteReason: string | undefined;

      // Practical (P13 or PRACTICAL) staffing
      const isPractical = paper.id === 'P13' || paper.theoryOrPractical === 'PRACTICAL';
      const scheduledForRoom = scheduledPracticals.find(
        (sp) => sp.room.id === room.id && sp.periods.includes(period)
      );

      if (scheduledForRoom) {
        paper = practicalPaper;
        selectedTeacherId = scheduledForRoom.teacher.id;
        isSubstitute = false;
      } else if (isPractical) {
        if (activeRules.enablePracticalConsecutiveDoublePeriodLimit !== false && isPracticalActive) {
          // Rule 9: Practical is strictly restricted to scheduled practical rooms and periods.
          // In unscheduled slots, replace with a valid theory paper so practical never spills over.
          const nonPracCandidates = schedulingPapers.filter(
            (p) => p.id !== practicalPaper.id && p.theoryOrPractical !== 'PRACTICAL'
          );
          const theoryFallback =
            nonPracCandidates.find((p) => !isPaperRoomQuotaCompleted(room.id, p.id)) ||
            nonPracCandidates[0] ||
            papers[0];
          paper = theoryFallback;
        } else {
          // Flexible practical staffing without Rule 9 double-period limit
          let candidateTeachers = availableTeachers;
          if (options.practicalConfig?.teacherIds && options.practicalConfig.teacherIds.length > 0) {
            const specified = availableTeachers.filter((t) => options.practicalConfig!.teacherIds!.includes(t.id));
            if (specified.length > 0) {
              candidateTeachers = specified;
            }
          }
          const freeForPractical = candidateTeachers.filter((t) =>
            isTeacherEligibleInPeriod(t.id, period, room, busyTeachersInPeriod, paper.id)
          );
          if (freeForPractical.length > 0) {
            const sorted = sortCandidatesByFairWorkload(freeForPractical, room.id, roomIndex, room.building);
            selectedTeacherId = sorted[0].id;
            isSubstitute = false;
          }
        }
      }

      // Exam (Period 5) staffing
      const isExamSlot = isExamActive && period === 5;
      if (isExamSlot) {
        paper = examPaper;
        let candidateTeachers = availableTeachers;
        if (options.examConfig?.teacherIds && options.examConfig.teacherIds.length > 0) {
          const specified = availableTeachers.filter((t) => options.examConfig!.teacherIds!.includes(t.id));
          if (specified.length > 0) {
            candidateTeachers = specified;
          }
        }
        const freeForExam = candidateTeachers.filter((t) =>
          isTeacherEligibleInPeriod(t.id, period, room, busyTeachersInPeriod, paper.id)
        );
        if (freeForExam.length > 0) {
          const sorted = sortCandidatesByFairWorkload(freeForExam, room.id, roomIndex, room.building);
          selectedTeacherId = sorted[0].id;
          isSubstitute = false;
        } else {
          const anyFree = candidateTeachers.filter(
            (t) => !busyTeachersInPeriod.has(t.id) && !getTeacherOffPeriods(t.id).includes(5)
          );
          if (anyFree.length > 0) {
            const sorted = sortCandidatesByFairWorkload(anyFree, room.id, roomIndex, room.building);
            selectedTeacherId = sorted[0].id;
            isSubstitute = false;
          }
        }
      }

      // Step 1: Check primary teachers of this paper
      if (!selectedTeacherId) {
        const freePrimaries = paper.primaryTeacherIds
          .filter((tid) => isTeacherEligibleInPeriod(tid, period, room, busyTeachersInPeriod, paper.id))
          .map((tid) => teacherMap.get(tid)!)
          .filter(Boolean);

        if (freePrimaries.length > 0) {
          const sorted = sortCandidatesByFairWorkload(freePrimaries, room.id, roomIndex, room.building);
          selectedTeacherId = sorted[0].id;
          isSubstitute = false;
        }
      }

      // Step 2: If primary teacher is unavailable, invoke Part J: No Substitution & Fallback
      if (!selectedTeacherId) {
        if (activeRules.enableNoSubstituteAllotment) {
          // No Substitution is ON:
          if (activeRules.replaceWithAvailableSubjectIfNoPrimary) {
            // Change to Most Probable Subject fallback:
            const candidateReplacements = schedulingPapers.filter((altPaper) => {
              if (altPaper.id === paper.id) return false;
              // Check Tier 1 room constraints for altPaper
              const currentInRoom = generatedSlots.filter((s) => s.roomId === room.id);
              const countInRoom = currentInRoom.filter((s) => s.paperId === altPaper.id).length;
              if (isPaperRoomQuotaCompleted(room.id, altPaper.id, countInRoom)) return false;
              if (activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && countInRoom >= 1) return false;
              if (!activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && activeRules.enableMaxRoomDailyLimit && countInRoom >= 2) return false;
              if (
                !activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily &&
                activeRules.enableMaxRoomDailyLimit &&
                activeRules.enableNonConsecutiveGapForSameSubject
              ) {
                const prevSlot = currentInRoom.find((s) => s.period === period - 1);
                if (prevSlot && prevSlot.paperId === altPaper.id) return false;
              }
              // Check if altPaper has an available primary teacher
              return altPaper.primaryTeacherIds.some((tid) =>
                isTeacherEligibleInPeriod(tid, period, room, busyTeachersInPeriod, altPaper.id)
              );
            });

            if (candidateReplacements.length > 0) {
              // Rank replacement subjects by remaining curriculum %
              candidateReplacements.sort((a, b) => {
                const pctA = getClassRemainingPercentage(a.id, room.id);
                const pctB = getClassRemainingPercentage(b.id, room.id);
                return pctB - pctA;
              });

              const replacementPaper = candidateReplacements[0];
              const eligiblePrimaries = replacementPaper.primaryTeacherIds
                .filter((tid) => isTeacherEligibleInPeriod(tid, period, room, busyTeachersInPeriod, replacementPaper.id))
                .map((tid) => teacherMap.get(tid)!)
                .filter(Boolean);

              if (eligiblePrimaries.length > 0) {
                const sorted = sortCandidatesByFairWorkload(eligiblePrimaries, room.id, roomIndex, room.building);
                selectedTeacherId = sorted[0].id;
                originalTeacherId = paper.primaryTeacherIds[0];
                substituteReason = `Replaced ${paper.code} with alternate available subject ${replacementPaper.code} (${replacementPaper.title}) due to primary instructor unavailability`;
                paper = replacementPaper;
                replacementsCount++;
              }
            }
          }

          if (!selectedTeacherId) {
            // Leave slot blank / No Instructor
            selectedTeacherId = '';
            isSubstitute = false;
            substituteReason = 'No instructor available (Strict No-Substitute rule active)';
            noInstructorCount++;
          }
        } else {
          // Substitution is permitted (No Substitution is OFF)
          const preferredOriginalId = paper.primaryTeacherIds[0] || 'T1';

          // A. Designated Backup Instructors (Rule 21)
          if (activeRules.enableDesignatedBackup && !selectedTeacherId) {
            const freeBackups = availableTeachers.filter((t) => {
              const isBackup =
                (t.backupPaperIds && t.backupPaperIds.includes(paper.id)) ||
                (t.secondaryPaperIds && t.secondaryPaperIds.includes(paper.id));
              return isBackup && isTeacherEligibleInPeriod(t.id, period, room, busyTeachersInPeriod, paper.id);
            });

            if (freeBackups.length > 0) {
              const sorted = sortCandidatesByFairWorkload(freeBackups, room.id, roomIndex, room.building);
              selectedTeacherId = sorted[0].id;
              isSubstitute = true;
              originalTeacherId = preferredOriginalId;
              substituteReason = `Designated Backup Instructor appointed (${sorted[0].name})`;
            }
          }

          // B. Nearest Subject Papers
          if (!selectedTeacherId) {
            const nearestTeachers: Teacher[] = [];
            for (const nid of paper.nearestPaperIds) {
              const nPaper = paperMap.get(nid);
              if (!nPaper) continue;
              for (const tid of nPaper.primaryTeacherIds) {
                if (isTeacherEligibleInPeriod(tid, period, room, busyTeachersInPeriod, paper.id)) {
                  const t = teacherMap.get(tid);
                  if (t && !nearestTeachers.some((nt) => nt.id === t.id)) nearestTeachers.push(t);
                }
              }
            }
            if (nearestTeachers.length > 0) {
              const sorted = sortCandidatesByFairWorkload(nearestTeachers, room.id, roomIndex, room.building);
              selectedTeacherId = sorted[0].id;
              isSubstitute = true;
              originalTeacherId = preferredOriginalId;
              substituteReason = `Nearest related subject substitute appointed (${sorted[0].name})`;
            }
          }

          // C. Secondary Qualified Teachers
          if (!selectedTeacherId) {
            const secondaryTeachers = availableTeachers.filter(
              (t) =>
                t.secondaryPaperIds.includes(paper.id) &&
                isTeacherEligibleInPeriod(t.id, period, room, busyTeachersInPeriod, paper.id)
            );
            if (secondaryTeachers.length > 0) {
              const sorted = sortCandidatesByFairWorkload(secondaryTeachers, room.id, roomIndex, room.building);
              selectedTeacherId = sorted[0].id;
              isSubstitute = true;
              originalTeacherId = preferredOriginalId;
              substituteReason = `Secondary qualified substitute appointed (${sorted[0].name})`;
            }
          }

          // D. Emergency Reserve: Any free instructor in this building under cap & with transit gap
          if (!selectedTeacherId) {
            const emergencyFree = availableTeachers.filter((t) =>
              isTeacherEligibleInPeriod(t.id, period, room, busyTeachersInPeriod, paper.id)
            );
            if (emergencyFree.length > 0) {
              const sorted = sortCandidatesByFairWorkload(emergencyFree, room.id, roomIndex, room.building);
              selectedTeacherId = sorted[0].id;
              isSubstitute = true;
              originalTeacherId = preferredOriginalId;
              substituteReason = `Emergency reserve instructor appointed (${sorted[0].name})`;
            }
          }

          if (!selectedTeacherId) {
            selectedTeacherId = '';
            isSubstitute = false;
            substituteReason = 'No instructor available under operational constraints';
            noInstructorCount++;
          }
        }
      }

      // Commit teacher state if assigned
      if (selectedTeacherId) {
        busyTeachersInPeriod.add(selectedTeacherId);
        const currentDaily = teacherDailyLoad.get(selectedTeacherId) || 0;
        teacherDailyLoad.set(selectedTeacherId, currentDaily + 1);

        teacherLastSlot.set(selectedTeacherId, {
          period,
          building: room.building,
          roomIndex,
        });

        teacherTargetRoomIndex.set(selectedTeacherId, (roomIndex % classrooms.length) + 1);

        if (teacherRoomDeploymentCount.has(selectedTeacherId)) {
          const rMap = teacherRoomDeploymentCount.get(selectedTeacherId)!;
          rMap.set(room.id, (rMap.get(room.id) || 0) + 1);
        }

        if (teacherBuildingDeploymentCount.has(selectedTeacherId)) {
          const bMap = teacherBuildingDeploymentCount.get(selectedTeacherId)!;
          bMap.set(room.building, (bMap.get(room.building) || 0) + 1);
        }
      }

      const isPracticalSlot = isPracticalActive && (paper.id === 'P13' || paper.theoryOrPractical === 'PRACTICAL');
      let slotPracticalName: string | undefined;
      let slotPracticalSubjectId: string | undefined;
      if (isPracticalSlot) {
        const sp = scheduledPracticals.find((p) => p.room.id === room.id && p.periods.includes(period));
        slotPracticalName = sp ? sp.name : (options.practicalConfig?.name || 'Practical');
        slotPracticalSubjectId = sp?.practicalSubjectId;
      }

      const slotExamName = isExamSlot ? (options.examConfig?.name || 'Examination / Assessment') : undefined;

      const slot: ClassSlot = {
        id: `slot-${targetDayNumber}-${room.id}-P${period}`,
        roomId: room.id,
        period,
        paperId: paper.id,
        teacherId: selectedTeacherId,
        isSubstitute: Boolean(selectedTeacherId && paper.id && isSubstitute),
        originalTeacherId,
        substituteReason,
        isPriority: priorityPaperIds.includes(paper.id) || (subjectPriorityTiers[paper.id] === 'HIGH'),
        practicalName: slotPracticalName,
        practicalSubjectId: slotPracticalSubjectId,
        isExam: isExamSlot,
        examName: slotExamName,
        theoryOrPractical: isExamSlot ? 'EXAM' : (isPracticalSlot ? 'PRACTICAL' : 'THEORY'),
      };

      generatedSlots.push(slot);
    }
  }
}

  // 8. Part L: Final Tier 1 Validation and Audit Report Creation
  const tier1Validation = validateRoutine(
    generatedSlots,
    teachers,
    classrooms,
    absentTeacherIds,
    activeRules,
    papers,
    totalDailySlots,
    options.practicalConfig,
    options.examConfig
  );

  const teacherWorkloadList = teachers.map((t) => ({
    teacherId: t.id,
    teacherName: t.name,
    initialLoad: teacherHistoricalSessions.get(t.id) || 0,
    todayLoad: teacherDailyLoad.get(t.id) || 0,
    totalLoad: getTeacherTotalLoad(t.id),
  }));

  const activeWorkloads = teacherWorkloadList
    .filter((w) => !normalizedAbsentSet.has(normalizeTeacherId(w.teacherId)))
    .map((w) => w.totalLoad);

  const maxTeacherLoad = activeWorkloads.length > 0 ? Math.max(...activeWorkloads) : 0;
  const minTeacherLoad = activeWorkloads.length > 0 ? Math.min(...activeWorkloads) : 0;
  const workloadDifference = maxTeacherLoad - minTeacherLoad;

  const generationAudit: RoutineGenerationAudit = {
    totalCapacity: totalDailySlots,
    totalRemainingDemand: curriculumPlan.totalRemainingDemand,
    totalAdjustedDemand: curriculumPlan.totalAdjustedDemand,
    allocations: Array.from(curriculumPlan.allocations.values()),
    teacherWorkloads: teacherWorkloadList,
    maxTeacherLoad,
    minTeacherLoad,
    workloadDifference,
    vacanciesFilledCount,
    replacementsCount,
    noInstructorCount,
    tier1Validation,
  };

  const now = new Date().toISOString();

  return {
    id: `routine-day-${targetDayNumber}`,
    dayNumber: targetDayNumber,
    date: targetDate,
    absentTeacherIds,
    priorityPaperIds,
    roomPriorityPaperIds,
    subjectPriorityTiers,
    prioritySubjectMinPeriods,
    excludedPaperIds: Array.from(combinedExcludedSet),
    teacherOffPeriods: options.teacherOffPeriods,
    practicalConfig: options.practicalConfig,
    examConfig: options.examConfig,
    slots: generatedSlots,
    createdAt: now,
    updatedAt: now,
    isLocked: false,
    status: 'published',
    notes:
      notes ||
      `Day ${targetDayNumber} Indoor Routine generated with 15 classrooms & ${availableTeachers.length} active instructors (Tier 1 Passed: ${tier1Validation.tier1Passed})`,
    generationAudit,
  };
}

/**
 * Generates continuous multiple-day routines in chronological sequence.
 * Part K of Master Prompt.
 */
export function generateMultipleDaysRoutines(
  options: Omit<SchedulerOptions, 'targetDayNumber' | 'targetDate'> & {
    startDayNumber: number;
    startDate: string;
    numberOfDays: number;
  }
): DailyRoutine[] {
  const { startDayNumber, startDate, numberOfDays, historicalRoutines = [], ...baseOptions } = options;
  const generated: DailyRoutine[] = [];
  const cumulativeHistory = [...historicalRoutines];

  for (let d = 0; d < numberOfDays; d++) {
    const currentDayNumber = startDayNumber + d;
    const dateObj = new Date(startDate);
    dateObj.setDate(dateObj.getDate() + d);
    const currentDateStr = dateObj.toISOString().split('T')[0];

    const routine = generateDailyRoutine({
      ...baseOptions,
      historicalRoutines: cumulativeHistory,
      targetDayNumber: currentDayNumber,
      targetDate: currentDateStr,
    });

    generated.push(routine);
    cumulativeHistory.push(routine);
  }

  return generated;
}

/**
 * Calculates the sequential session number for a specific instructor teaching a specific paper in a specific classroom.
 * Formula:
 * 1. Count past routines (dayNumber < currentRoutine.dayNumber or date < currentRoutine.date, excluding currentRoutine):
 *    slots where normalizeTeacherId(s.teacherId) === normalizeTeacherId(slot.teacherId)
 *           && s.roomId === slot.roomId
 *           && s.paperId === slot.paperId
 * 2. In currentRoutine.slots:
 *    slots where normalizeTeacherId(s.teacherId) === normalizeTeacherId(slot.teacherId)
 *           && s.roomId === slot.roomId
 *           && s.paperId === slot.paperId
 *           && s.period <= slot.period
 * Returns the 1-based session number (e.g. 1, 2, 3...) or 0 if unassigned.
 */
export function getTeacherClassPaperSessionNumber(
  slot: ClassSlot,
  currentRoutine: DailyRoutine,
  allRoutines: DailyRoutine[] = []
): number {
  if (!slot || !slot.teacherId || !slot.paperId || !slot.roomId) return 0;
  const tNorm = normalizeTeacherId(slot.teacherId);
  const currentDay = currentRoutine.dayNumber;
  const currentDate = currentRoutine.date;

  const pastRoutines = allRoutines.filter((r) => {
    if (r.id === currentRoutine.id) return false;
    if (r.dayNumber !== undefined && currentDay !== undefined) {
      return r.dayNumber < currentDay;
    }
    if (r.date && currentDate) {
      return r.date < currentDate;
    }
    return false;
  });

  let count = 0;
  for (const r of pastRoutines) {
    if (!r.slots) continue;
    for (const s of r.slots) {
      if (
        s.roomId === slot.roomId &&
        s.paperId === slot.paperId &&
        normalizeTeacherId(s.teacherId) === tNorm
      ) {
        count++;
      }
    }
  }

  const todaySlots = currentRoutine.slots || [];
  for (const s of todaySlots) {
    if (
      s.roomId === slot.roomId &&
      s.paperId === slot.paperId &&
      normalizeTeacherId(s.teacherId) === tNorm &&
      s.period <= slot.period
    ) {
      count++;
    }
  }

  return count;
}

/**
 * Builds an efficient Map of session numbers for all slots in a routine.
 * Keys stored:
 * - `slot.id` -> session number
 * - `${slot.roomId}_${slot.period}` -> session number (for reliable lookup)
 */
export function buildRoutineSessionNumbersMap(
  currentRoutine: DailyRoutine | null | undefined,
  allRoutines: DailyRoutine[] = []
): Map<string, number> {
  const map = new Map<string, number>();
  if (!currentRoutine || !currentRoutine.slots) return map;

  const currentDay = currentRoutine.dayNumber;
  const currentDate = currentRoutine.date;

  const pastRoutines = allRoutines.filter((r) => {
    if (r.id === currentRoutine.id) return false;
    if (r.dayNumber !== undefined && currentDay !== undefined) {
      return r.dayNumber < currentDay;
    }
    if (r.date && currentDate) {
      return r.date < currentDate;
    }
    return false;
  });

  // Accumulate past counts: key = `${norm(teacherId)}_${roomId}_${paperId}`
  const counts = new Map<string, number>();
  for (const r of pastRoutines) {
    if (!r.slots) continue;
    for (const s of r.slots) {
      if (!s.teacherId || !s.paperId || !s.roomId) continue;
      const key = `${normalizeTeacherId(s.teacherId)}_${s.roomId}_${s.paperId}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  // Process today's slots sorted by period 1..5 so consecutive slots get sequential numbers
  const sortedSlots = [...currentRoutine.slots].sort((a, b) => a.period - b.period);
  for (const s of sortedSlots) {
    if (!s.teacherId || !s.paperId || !s.roomId) {
      if (s.id) map.set(s.id, 0);
      map.set(`${s.roomId}_${s.period}`, 0);
      continue;
    }
    const key = `${normalizeTeacherId(s.teacherId)}_${s.roomId}_${s.paperId}`;
    const nextCount = (counts.get(key) || 0) + 1;
    counts.set(key, nextCount);

    if (s.id) map.set(s.id, nextCount);
    map.set(`${s.roomId}_${s.period}`, nextCount);
  }

  return map;
}
