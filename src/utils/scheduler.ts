/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Classroom,
  ClassroomPaperProgress,
  ClassroomTotalProgress,
  ClassSlot,
  DailyRoutine,
  Paper,
  PaperProgress,
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
  absentTeacherIds: string[];
  priorityPaperIds: string[];
  roomPriorityPaperIds?: Record<string, string[]>; // room-wise priority papers
  subjectPriorityTiers?: Record<string, SubjectPriorityTier>; // paperId -> HIGH | MEDIUM | LOW | NORMAL | EXCLUDE
  prioritySubjectMinPeriods?: Record<string, number>; // paperId -> guaranteed minimum periods
  excludedPaperIds?: string[]; // subjects explicitly omitted/removed from this routine
  rules?: Partial<RoutineRuleConfig>; // Toggleable routine preparation constraints
  historicalRoutines: DailyRoutine[];
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
 * Primary Routine Generation Engine implementing Tier 1 Hard Constraints,
 * Tier 2 Priority-Based Curriculum Allocation, Rotational Wave Sequencing,
 * and Fair Teacher Balancing.
 */
export function generateDailyRoutine(options: SchedulerOptions): DailyRoutine {
  const {
    classrooms,
    papers,
    teachers,
    absentTeacherIds,
    priorityPaperIds = [],
    roomPriorityPaperIds = {},
    subjectPriorityTiers = {},
    prioritySubjectMinPeriods = {},
    excludedPaperIds = [],
    rules,
    historicalRoutines,
    targetDayNumber,
    targetDate,
    notes,
  } = options;

  const activeRules: RoutineRuleConfig = normalizeRuleConfig(rules);
  const totalDailySlots = classrooms.length * 5; // 75 slots
  const paperMap = new Map(papers.map((p) => [p.id, p]));
  const classroomMap = new Map(classrooms.map((c) => [c.id, c]));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));

  const combinedExcludedSet = new Set(excludedPaperIds.map((id) => id.trim()));
  for (const [pid, tier] of Object.entries(subjectPriorityTiers)) {
    if (tier === 'EXCLUDE') {
      combinedExcludedSet.add(pid);
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

  // Helper to check if paper can fit in room based on Rules 5, 6, 6A
  const canAddPaperToRoom = (paperId: string, roomId: string): boolean => {
    if (combinedExcludedSet.has(paperId)) return false;
    const currentInRoom = roomAssignedPapers.get(roomId) || [];
    if (currentInRoom.length >= 5) return false;
    if (isPaperRoomQuotaCompleted(roomId, paperId, currentInRoom.filter((p) => p.id === paperId).length)) {
      return false;
    }
    const countInRoom = currentInRoom.filter((p) => p.id === paperId).length;

    // Rule 6: Max 1 period per subject per room daily
    if (activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && countInRoom >= 1) return false;

    // Rule 6A: Max 2 periods per subject per class/room daily
    if (!activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && activeRules.enableMaxRoomDailyLimit && countInRoom >= 2) {
      return false;
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

  // Begin filling from Paper 1, Paper 2, ... Paper 13 in configured paper order
  for (const paper of schedulingPapers) {
    const alloc = curriculumPlan.allocations.get(paper.id);
    let targetSessions = alloc ? alloc.integerTarget : 0;

    // If explicit minimum periods configured in options, ensure target respects it
    if (prioritySubjectMinPeriods[paper.id] && prioritySubjectMinPeriods[paper.id] > targetSessions) {
      targetSessions = prioritySubjectMinPeriods[paper.id];
    }

    if (targetSessions <= 0) continue;

    // Rank eligible classrooms for this subject: highest remaining demand % first
    const eligibleRooms = classrooms
      .filter((r) => canAddPaperToRoom(paper.id, r.id))
      .sort((a, b) => {
        const hasA = (roomAssignedPapers.get(a.id) || []).some((item) => item.id === paper.id) ? 1 : 0;
        const hasB = (roomAssignedPapers.get(b.id) || []).some((item) => item.id === paper.id) ? 1 : 0;
        if (hasA !== hasB) return hasA - hasB; // Classrooms without this paper yet get it first!
        const pctA = getClassRemainingPercentage(paper.id, a.id);
        const pctB = getClassRemainingPercentage(paper.id, b.id);
        if (Math.abs(pctA - pctB) > 0.001) return pctB - pctA; // Highest remaining % first!
        const remA = Math.max(0, (paper.totalTargetSessions || 30) - (roomPaperCompletedMap.get(a.id)?.get(paper.id) || 0));
        const remB = Math.max(0, (paper.totalTargetSessions || 30) - (roomPaperCompletedMap.get(b.id)?.get(paper.id) || 0));
        if (remA !== remB) return remB - remA;
        return a.id.localeCompare(b.id);
      });

    for (const room of eligibleRooms) {
      if (paperAllocatedCount.get(paper.id)! >= targetSessions) break;
      if (canAddPaperToRoom(paper.id, room.id)) {
        roomAssignedPapers.get(room.id)!.push(paper);
        paperAllocatedCount.set(paper.id, (paperAllocatedCount.get(paper.id) || 0) + 1);
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
        .filter((p) => canAddPaperToRoom(p.id, room.id))
        .sort((a, b) => {
          const allocA = curriculumPlan.allocations.get(a.id);
          const allocB = curriculumPlan.allocations.get(b.id);
          const deficitA = (allocA ? allocA.integerTarget : 0) - (paperAllocatedCount.get(a.id) || 0);
          const deficitB = (allocB ? allocB.integerTarget : 0) - (paperAllocatedCount.get(b.id) || 0);
          if (deficitA !== deficitB) return deficitB - deficitA; // Under-allocated papers first!
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
        if (!assigned.includes(p)) assigned.push(p);
      }
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
            violates6B = true;
            break;
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
      }
    });
  });

  const teacherDailyLoad = new Map<string, number>();
  teachers.forEach((t) => teacherDailyLoad.set(t.id, 0));

  const teacherLastSlot = new Map<
    string,
    { period: number; building: 'OLD' | 'NEW' | string; roomIndex: number }
  >();

  // Teacher room rotation target
  const classroomIndexMap = new Map<string, number>();
  classrooms.forEach((c, idx) => classroomIndexMap.set(c.id, idx + 1));

  const teacherTargetRoomIndex = new Map<string, number>();
  const previousRoutines = historicalRoutines
    .filter((r) => r.dayNumber < targetDayNumber)
    .sort((a, b) => b.dayNumber - a.dayNumber);
  const previousDayRoutine = previousRoutines[0];

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

  // Helper to check building change gap (Rule 4)
  const hasBuildingChangeConflict = (
    teacherId: string,
    period: number,
    targetBuilding: 'OLD' | 'NEW' | string
  ): boolean => {
    if (!activeRules.enableBuildingChangeGap) return false;
    const last = teacherLastSlot.get(teacherId);
    if (!last) return false;
    return last.period === period - 1 && last.building !== targetBuilding;
  };

  // Helper to check strict building binding (Rule 3)
  const isTeacherAllowedInRoomBuilding = (t: Teacher, rBuilding: string): boolean => {
    if (!activeRules.enableStrictBuildingBinding) return true;
    if (t.assignedBuilding === 'FLOATING') return true;
    return t.assignedBuilding === rBuilding;
  };

  // Sort candidate teachers to minimize workload difference (Part H & I)
  const sortCandidatesByFairWorkload = (
    candidates: Teacher[],
    roomId: string,
    roomIndex: number
  ): Teacher[] => {
    return [...candidates].sort((a, b) => {
      const loadA = teacherDailyLoad.get(a.id) || 0;
      const loadB = teacherDailyLoad.get(b.id) || 0;

      // Soft daily cap: instructors with < 3 periods today prioritized
      if (activeRules.enableDailyWorkloadSoftCap) {
        const cappedA = loadA >= 3 ? 1 : 0;
        const cappedB = loadB >= 3 ? 1 : 0;
        if (cappedA !== cappedB) return cappedA - cappedB;
      }

      // 1. Teacher Deployment Tracker: lowest previous visits to this room first
      const visitsA = teacherRoomDeploymentCount.get(a.id)?.get(roomId) || 0;
      const visitsB = teacherRoomDeploymentCount.get(b.id)?.get(roomId) || 0;
      if (visitsA !== visitsB) return visitsA - visitsB;

      // 2. Cumulative Workload Balancing: minimize Max - Min projected workload
      const totalA = getTeacherTotalLoad(a.id);
      const totalB = getTeacherTotalLoad(b.id);
      if (activeRules.enableWorkloadEqualization && totalA !== totalB) {
        return totalA - totalB;
      }

      // Daily load difference
      if (Math.abs(loadA - loadB) >= 2) {
        return loadA - loadB;
      }

      // Room carousel circular distance
      const targetA = teacherTargetRoomIndex.get(a.id) || 1;
      const targetB = teacherTargetRoomIndex.get(b.id) || 1;
      const distA = (roomIndex - targetA + classrooms.length) % classrooms.length;
      const distB = (roomIndex - targetB + classrooms.length) % classrooms.length;
      if (distA !== distB) return distA - distB;

      if (totalA !== totalB) return totalA - totalB;
      return loadA - loadB;
    });
  };

  const isTeacherEligibleInPeriod = (
    tid: string,
    period: number,
    room: Classroom,
    busyInPeriod: Set<string>
  ): boolean => {
    if (!availableTeacherIds.has(tid)) return false;
    if (activeRules.enableZeroDoubleBooking && busyInPeriod.has(tid)) return false;
    const t = teacherMap.get(tid);
    if (!t) return false;
    if (!isTeacherAllowedInRoomBuilding(t, room.building)) return false;
    if (hasBuildingChangeConflict(tid, period, room.building)) return false;
    const currentDaily = teacherDailyLoad.get(tid) || 0;
    const maxAllowed = Math.min(4, t.maxDailyPeriods || 4);
    if (activeRules.enableDailyWorkloadMaxCap && currentDaily >= maxAllowed) return false;
    return true;
  };

  // 7. Generate Slots Period by Period (P1 to P5)
  const generatedSlots: ClassSlot[] = [];
  let replacementsCount = 0;
  let noInstructorCount = 0;

  const orderedRooms = [...classrooms].sort(
    (a, b) => (classroomIndexMap.get(a.id) || 0) - (classroomIndexMap.get(b.id) || 0)
  );

  for (let period = 1; period <= 5; period++) {
    const busyTeachersInPeriod = new Set<string>();

    for (const room of orderedRooms) {
      const roomIndex = classroomIndexMap.get(room.id) || 1;
      const roomPlan = roomDailyPlans.get(room.id) || [];
      let paper = roomPlan[period - 1] || schedulingPapers[0] || papers[0];

      let selectedTeacherId = '';
      let isSubstitute = false;
      let originalTeacherId: string | undefined;
      let substituteReason: string | undefined;

      // Practical (P13) flexible staffing
      if (activeRules.enablePracticalFlexible && paper.id === 'P13') {
        const freeForPractical = availableTeachers.filter((t) =>
          isTeacherEligibleInPeriod(t.id, period, room, busyTeachersInPeriod)
        );
        if (freeForPractical.length > 0) {
          const sorted = sortCandidatesByFairWorkload(freeForPractical, room.id, roomIndex);
          selectedTeacherId = sorted[0].id;
          isSubstitute = false;
        }
      }

      // Step 1: Check primary teachers of this paper
      if (!selectedTeacherId) {
        const freePrimaries = paper.primaryTeacherIds
          .filter((tid) => isTeacherEligibleInPeriod(tid, period, room, busyTeachersInPeriod))
          .map((tid) => teacherMap.get(tid)!)
          .filter(Boolean);

        if (freePrimaries.length > 0) {
          const sorted = sortCandidatesByFairWorkload(freePrimaries, room.id, roomIndex);
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
                isTeacherEligibleInPeriod(tid, period, room, busyTeachersInPeriod)
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
                .filter((tid) => isTeacherEligibleInPeriod(tid, period, room, busyTeachersInPeriod))
                .map((tid) => teacherMap.get(tid)!)
                .filter(Boolean);

              if (eligiblePrimaries.length > 0) {
                const sorted = sortCandidatesByFairWorkload(eligiblePrimaries, room.id, roomIndex);
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

          // A. Cross-Subject Mutual Backup Pairs (Forensics <-> ICT, Police Admin <-> Criminology)
          const crossBackup = CROSS_SUBJECT_BACKUP_MAP[paper.id];
          if (activeRules.enableCrossMutualBackup && crossBackup && !selectedTeacherId) {
            const crossTeachers: Teacher[] = [];
            for (const bpid of crossBackup.backupPaperIds) {
              const bPaper = paperMap.get(bpid);
              if (!bPaper) continue;
              for (const tid of bPaper.primaryTeacherIds) {
                if (isTeacherEligibleInPeriod(tid, period, room, busyTeachersInPeriod)) {
                  const t = teacherMap.get(tid);
                  if (t && !crossTeachers.some((ct) => ct.id === t.id)) {
                    crossTeachers.push(t);
                  }
                }
              }
            }
            if (crossTeachers.length > 0) {
              const sorted = sortCandidatesByFairWorkload(crossTeachers, room.id, roomIndex);
              selectedTeacherId = sorted[0].id;
              isSubstitute = true;
              originalTeacherId = preferredOriginalId;
              substituteReason = `${crossBackup.pairLabel} appointed (${sorted[0].name})`;
            }
          }

          // B. Designated Backup Instructors
          if (activeRules.enableDesignatedBackup && !selectedTeacherId) {
            const freeBackups = availableTeachers.filter((t) => {
              const isBackup =
                (t.backupPaperIds && t.backupPaperIds.includes(paper.id)) ||
                (t.secondaryPaperIds && t.secondaryPaperIds.includes(paper.id));
              return isBackup && isTeacherEligibleInPeriod(t.id, period, room, busyTeachersInPeriod);
            });

            if (freeBackups.length > 0) {
              const sorted = sortCandidatesByFairWorkload(freeBackups, room.id, roomIndex);
              selectedTeacherId = sorted[0].id;
              isSubstitute = true;
              originalTeacherId = preferredOriginalId;
              substituteReason = `Designated Backup Instructor appointed (${sorted[0].name})`;
            }
          }

          // C. Nearest Subject Papers
          if (!selectedTeacherId) {
            const nearestTeachers: Teacher[] = [];
            for (const nid of paper.nearestPaperIds) {
              const nPaper = paperMap.get(nid);
              if (!nPaper) continue;
              for (const tid of nPaper.primaryTeacherIds) {
                if (isTeacherEligibleInPeriod(tid, period, room, busyTeachersInPeriod)) {
                  const t = teacherMap.get(tid);
                  if (t && !nearestTeachers.some((nt) => nt.id === t.id)) nearestTeachers.push(t);
                }
              }
            }
            if (nearestTeachers.length > 0) {
              const sorted = sortCandidatesByFairWorkload(nearestTeachers, room.id, roomIndex);
              selectedTeacherId = sorted[0].id;
              isSubstitute = true;
              originalTeacherId = preferredOriginalId;
              substituteReason = `Nearest related subject substitute appointed (${sorted[0].name})`;
            }
          }

          // D. Secondary Qualified Teachers
          if (!selectedTeacherId) {
            const secondaryTeachers = availableTeachers.filter(
              (t) =>
                t.secondaryPaperIds.includes(paper.id) &&
                isTeacherEligibleInPeriod(t.id, period, room, busyTeachersInPeriod)
            );
            if (secondaryTeachers.length > 0) {
              const sorted = sortCandidatesByFairWorkload(secondaryTeachers, room.id, roomIndex);
              selectedTeacherId = sorted[0].id;
              isSubstitute = true;
              originalTeacherId = preferredOriginalId;
              substituteReason = `Secondary qualified substitute appointed (${sorted[0].name})`;
            }
          }

          // E. Emergency Reserve: Any free instructor in this building under cap & with transit gap
          if (!selectedTeacherId) {
            const emergencyFree = availableTeachers.filter((t) =>
              isTeacherEligibleInPeriod(t.id, period, room, busyTeachersInPeriod)
            );
            if (emergencyFree.length > 0) {
              const sorted = sortCandidatesByFairWorkload(emergencyFree, room.id, roomIndex);
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
      }

      const slot: ClassSlot = {
        id: `slot-${targetDayNumber}-${room.id}-P${period}`,
        roomId: room.id,
        period,
        paperId: paper.id,
        teacherId: selectedTeacherId,
        isSubstitute,
        originalTeacherId,
        substituteReason,
        isPriority: priorityPaperIds.includes(paper.id) || (subjectPriorityTiers[paper.id] === 'HIGH'),
      };

      generatedSlots.push(slot);
    }
  }

  // 8. Part L: Final Tier 1 Validation and Audit Report Creation
  const tier1Validation = validateRoutine(
    generatedSlots,
    teachers,
    classrooms,
    absentTeacherIds,
    activeRules,
    papers
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
  const { startDayNumber, startDate, numberOfDays, historicalRoutines, ...baseOptions } = options;
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
