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
import { DEFAULT_ROUTINE_RULES } from '../data/initialData.ts';

export interface SchedulerOptions {
  classrooms: Classroom[];
  papers: Paper[];
  teachers: Teacher[];
  absentTeacherIds: string[];
  priorityPaperIds: string[];
  roomPriorityPaperIds?: Record<string, string[]>; // room-wise priority papers
  subjectPriorityTiers?: Record<string, SubjectPriorityTier>; // paperId -> HIGH | MEDIUM | LOW | NORMAL | EXCLUDE
  prioritySubjectMinPeriods?: Record<string, number>; // paperId -> guaranteed minimum periods (e.g. 15, 9, 3, or custom)
  excludedPaperIds?: string[]; // subjects explicitly omitted/removed from this routine
  rules?: Partial<RoutineRuleConfig>; // Toggleable routine preparation constraints
  historicalRoutines: DailyRoutine[];
  targetDayNumber: number;
  targetDate: string;
  notes?: string;
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
 * Calculates classroom-wise completed sessions for each classroom and each paper
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
  // Exclude current routine from historical routines to avoid double-counting
  const pastRoutines = historicalRoutines.filter((routine) => {
    if (currentRoutineId && routine.id === currentRoutineId) return false;
    if (currentRoutineSlots.length > 0 && routine.slots.length === currentRoutineSlots.length) {
      if (routine.slots[0]?.id === currentRoutineSlots[0]?.id) return false;
    }
    return true;
  });

  // room-id -> paper-id -> historical count
  const roomHistorical = new Map<string, Map<string, number>>();
  // room-id -> paper-id -> today's count
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

  // Count past completed routines per room
  for (const routine of pastRoutines) {
    for (const slot of routine.slots) {
      const roomHist = roomHistorical.get(slot.roomId);
      if (roomHist && roomHist.has(slot.paperId)) {
        roomHist.set(slot.paperId, (roomHist.get(slot.paperId) || 0) + 1);
      }
    }
  }

  // Count current routine slots per room
  for (const slot of currentRoutineSlots) {
    const rToday = roomToday.get(slot.roomId);
    if (rToday && rToday.has(slot.paperId)) {
      rToday.set(slot.paperId, (rToday.get(slot.paperId) || 0) + 1);
    }
  }

  return classrooms.map((room) => {
    const histMap = roomHistorical.get(room.id)!;
    const todayMap = roomToday.get(room.id)!;

    let roomCompletedBeforeToday = 0;
    let roomTodayTotal = 0;
    let roomTargetTotal = 0;

    const paperProgress: ClassroomPaperProgress[] = papers.map((paper) => {
      const completed = histMap.get(paper.id) || 0;
      const today = todayMap.get(paper.id) || 0;
      const totalDone = completed + today;
      const remaining = Math.max(0, paper.totalTargetSessions - totalDone);
      const progressPercent = Math.min(
        100,
        Math.round((totalDone / paper.totalTargetSessions) * 100)
      );

      roomCompletedBeforeToday += completed;
      roomTodayTotal += today;
      roomTargetTotal += paper.totalTargetSessions;

      return {
        paperId: paper.id,
        paperCode: paper.code,
        title: paper.title,
        titleHi: paper.titleHi,
        category: paper.category,
        targetSessions: paper.totalTargetSessions,
        completedSessions: completed,
        todaySessions: today,
        totalCompleted: totalDone,
        remainingSessions: remaining,
        progressPercent,
        color: paper.color,
        isPriority: priorityPaperIds.includes(paper.id),
      };
    });

    const roomTotalDone = roomCompletedBeforeToday + roomTodayTotal;
    const roomRemaining = Math.max(0, roomTargetTotal - roomTotalDone);
    const roomPercent =
      roomTargetTotal > 0
        ? Math.min(100, Math.round((roomTotalDone / roomTargetTotal) * 100))
        : 0;

    return {
      classroom: room,
      totalTargetSessions: roomTargetTotal,
      completedBeforeToday: roomCompletedBeforeToday,
      todaySessions: roomTodayTotal,
      totalCompleted: roomTotalDone,
      remainingSessions: roomRemaining,
      progressPercent: roomPercent,
      paperProgress,
    };
  });
}

/**
 * Calculates cumulative completed sessions for each paper across past routines (Academy Aggregate)
 * Strictly avoids double-counting: current routine slots are counted as today's sessions,
 * while historical routines exclude the current routine.
 */
export function calculateCumulativeStats(
  papers: Paper[],
  historicalRoutines: DailyRoutine[],
  currentRoutineSlots: ClassSlot[] = [],
  priorityPaperIds: string[] = [],
  multiplier: number = 15, // 15 classrooms by default (All classes quota = 15 * subject target)
  currentRoutineId?: string
): PaperProgress[] {
  // Exclude current routine from historical calculation to avoid double-counting
  const pastRoutines = historicalRoutines.filter((routine) => {
    if (currentRoutineId && routine.id === currentRoutineId) return false;
    if (currentRoutineSlots.length > 0 && routine.slots.length === currentRoutineSlots.length) {
      if (routine.slots[0]?.id === currentRoutineSlots[0]?.id) return false;
    }
    return true;
  });

  // Count past completions
  const completedCounts = new Map<string, number>();
  for (const paper of papers) {
    completedCounts.set(paper.id, 0);
  }

  for (const routine of pastRoutines) {
    for (const slot of routine.slots) {
      if (completedCounts.has(slot.paperId)) {
        completedCounts.set(slot.paperId, (completedCounts.get(slot.paperId) || 0) + 1);
      }
    }
  }

  // Count today's slots if provided
  const todayCounts = new Map<string, number>();
  for (const slot of currentRoutineSlots) {
    todayCounts.set(slot.paperId, (todayCounts.get(slot.paperId) || 0) + 1);
  }

  return papers.map((paper) => {
    const completed = completedCounts.get(paper.id) || 0;
    const today = todayCounts.get(paper.id) || 0;
    const totalDone = completed + today;
    const target = paper.totalTargetSessions * multiplier;
    const remaining = Math.max(0, target - totalDone);
    const progressPercent = target > 0 ? Math.min(100, Math.round((totalDone / target) * 100)) : 0;

    return {
      paperId: paper.id,
      paperCode: paper.code,
      title: paper.title,
      titleHi: paper.titleHi,
      targetSessions: target,
      singleRoomTarget: paper.totalTargetSessions,
      completedSessions: completed,
      todaySessions: today,
      remainingSessions: remaining,
      progressPercent,
      color: paper.color,
      isPriority: priorityPaperIds.includes(paper.id),
    };
  });
}

/**
 * Intelligent Constraint Solver for Daily Class Routine
 * Guarantees:
 * 1. Exactly 75 slots (15 classrooms * 5 periods)
 * 2. 0 Teacher double-bookings: No teacher scheduled in > 1 classroom in any period
 * 3. 0 Absent teachers scheduled
 * 4. Automatic nearest-subject substitute teacher selection
 * 5. Balanced curriculum allocation based on cumulative session deficits & priorities per classroom
 * 6. Equitable teacher workload distribution
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

  const activeRules: RoutineRuleConfig = {
    ...DEFAULT_ROUTINE_RULES,
    ...(rules || {}),
  };

  // Resolve excluded papers from explicit excludedPaperIds and tiers
  const combinedExcludedSet = new Set(excludedPaperIds.map((id) => id.trim()));
  for (const [pid, tier] of Object.entries(subjectPriorityTiers)) {
    if (tier === 'EXCLUDE') {
      combinedExcludedSet.add(pid);
    }
  }

  // Active papers that are NOT excluded
  const eligiblePapers = papers.filter((p) => !combinedExcludedSet.has(p.id));
  const schedulingPapers = eligiblePapers.length > 0 ? eligiblePapers : papers;

  const paperMap = new Map(papers.map((p) => [p.id, p]));

  // 1. Calculate cumulative historical counts and remaining deficits PER CLASSROOM
  const roomProgressList = calculateClassroomCumulativeStats(
    classrooms,
    papers,
    historicalRoutines,
    [],
    priorityPaperIds
  );

  // Map room -> paper -> completed sessions before today
  const roomPaperCompletedMap = new Map<string, Map<string, number>>();
  for (const rp of roomProgressList) {
    const cMap = new Map<string, number>();
    for (const pp of rp.paperProgress) {
      cMap.set(pp.paperId, pp.completedSessions);
    }
    roomPaperCompletedMap.set(rp.classroom.id, cMap);
  }

  // Helper to determine if a paper has already reached 100% quota completion in a specific classroom
  // USER RULE: "ek rule banao ki.. jis class me jiss subject ka session 100 percent ho jaye.. uss class me.. routine creation me.. wo subject allot na ho"
  const isPaperRoomQuotaCompleted = (roomId: string, paperId: string, plannedInRoomToday: number = 0): boolean => {
    if (!activeRules.enableRoomQuotaCompletionLock) return false;
    const completed = (roomPaperCompletedMap.get(roomId)?.get(paperId) || 0) + plannedInRoomToday;
    const p = paperMap.get(paperId);
    const target = p && p.totalTargetSessions > 0 ? p.totalTargetSessions : 30;
    return completed >= target;
  };

  // Build resolved room priority map from user-provided roomPriorityPaperIds and subjectPriorityTiers
  const resolvedRoomPriorityMap: Record<string, string[]> = {};
  for (const r of classrooms) {
    const userPrios = (roomPriorityPaperIds[r.id] || []).filter(
      (pid) => !isPaperRoomQuotaCompleted(r.id, pid)
    );
    resolvedRoomPriorityMap[r.id] = userPrios;
  }

  // -------------------------------------------------------------------------------------
  // Process Subject Priority Tiers & Proportional Remaining Session Ratio
  // USER RULE: "har din total period x total class ka session hota h.. inn sessions me subject
  // ka fillup usi ratio me ho jitna per class per subject session percent remaining except
  // priority of subjects.. priority v ek percent hisab ho.. high aur low.. ho sirf..
  // matlab.. 50 percent jyada subject detailment. ya 50 percent kam.. max jitna classroom h.."
  // -------------------------------------------------------------------------------------
  const totalDailySlots = classrooms.length * 5; // 75 daily sessions

  // Compute remaining session percentage for all scheduling papers
  const paperRemainingPercents = new Map<string, number>();
  const paperRatioScores = new Map<string, number>();

  for (const p of schedulingPapers) {
    if (combinedExcludedSet.has(p.id)) {
      paperRemainingPercents.set(p.id, 0);
      paperRatioScores.set(p.id, 0);
      continue;
    }

    const singleQuota = p.totalTargetSessions > 0 ? p.totalTargetSessions : 30;
    const totalTarget = singleQuota * classrooms.length;
    let totalDone = 0;
    for (const r of classrooms) {
      totalDone += roomPaperCompletedMap.get(r.id)?.get(p.id) || 0;
    }
    const remaining = Math.max(0, totalTarget - totalDone);
    const remPercent = totalTarget > 0 ? (remaining / totalTarget) * 100 : 0;
    // Floor of 2% if target sessions are completed so subject can still be scheduled if needed
    const effectiveRemPercent = Math.max(remaining > 0 ? 2 : 0.5, remPercent);
    paperRemainingPercents.set(p.id, effectiveRemPercent);

    // Determine priority multiplier: High = +50% (1.5), Low = -50% (0.5), Normal = 1.0
    const tier = subjectPriorityTiers[p.id];
    let mult = 1.0;
    if (tier === 'HIGH' || priorityPaperIds.includes(p.id)) {
      mult = 1.5; // +50% subject detailment
    } else if (tier === 'LOW') {
      mult = 0.5; // -50% subject detailment
    } else if (tier === 'MEDIUM') {
      mult = 1.25;
    } else if (tier === 'EXCLUDE') {
      mult = 0;
    }
    paperRatioScores.set(p.id, effectiveRemPercent * mult);
  }

  const sumRatioScores = schedulingPapers.reduce(
    (sum, p) => sum + (paperRatioScores.get(p.id) || 0),
    0
  );

  // Helper to determine target rooms based on proportional remaining ratio and priority
  const getProportionalTargetRooms = (pid: string): number => {
    if (combinedExcludedSet.has(pid)) return 0;
    const tier = subjectPriorityTiers[pid];
    if (tier === 'HIGH') return classrooms.length; // High priority guarantees 100% of rooms (max 15)

    if (activeRules.enableProportionalRemainingRatio && sumRatioScores > 0) {
      const score = paperRatioScores.get(pid) || 0;
      const rawCount = Math.round((totalDailySlots * score) / sumRatioScores);
      let target = Math.min(classrooms.length, Math.max(1, rawCount));
      if (tier === 'LOW') {
        target = Math.max(1, Math.min(Math.round(classrooms.length * 0.25), Math.round(target * 0.5)));
      } else if (tier === 'MEDIUM') {
        target = Math.max(3, Math.min(Math.round(classrooms.length * 0.6), target));
      }
      return target;
    }

    if (tier === 'MEDIUM') return Math.round(classrooms.length * 0.6);
    if (tier === 'LOW') return Math.max(1, Math.round(classrooms.length * 0.2));
    return 0;
  };

  if (activeRules.enableSubjectPriorityTiers || activeRules.enableProportionalRemainingRatio) {
    for (const p of schedulingPapers) {
      const pid = p.id;
      if (combinedExcludedSet.has(pid)) continue;
      const tier = subjectPriorityTiers[pid];
      const isPriority = tier === 'HIGH' || tier === 'MEDIUM' || tier === 'LOW' || priorityPaperIds.includes(pid);

      if (isPriority) {
        const targetRoomCount = getProportionalTargetRooms(pid);
        if (targetRoomCount <= 0) continue;

        // Filter out classrooms where this paper has already reached 100% quota
        const eligibleRooms = classrooms.filter((r) => !isPaperRoomQuotaCompleted(r.id, pid));
        if (eligibleRooms.length === 0) continue;

        // Sort classrooms by completed sessions of this paper ascending (lowest completed gets priority)
        const sortedRoomsForPaper = [...eligibleRooms].sort((a, b) => {
          const countA = roomPaperCompletedMap.get(a.id)?.get(pid) || 0;
          const countB = roomPaperCompletedMap.get(b.id)?.get(pid) || 0;
          if (countA !== countB) return countA - countB;
          return Math.random() - 0.5;
        });

        const selectedRooms = sortedRoomsForPaper.slice(0, targetRoomCount);
        for (const r of selectedRooms) {
          if (!resolvedRoomPriorityMap[r.id]) resolvedRoomPriorityMap[r.id] = [];
          if (!resolvedRoomPriorityMap[r.id].includes(pid)) {
            resolvedRoomPriorityMap[r.id].push(pid);
          }
        }
      }
    }
  }

  // Helper to determine guaranteed minimum periods for any subject
  const getGuaranteedMinPeriods = (pid: string): number => {
    if (prioritySubjectMinPeriods && prioritySubjectMinPeriods[pid] !== undefined && prioritySubjectMinPeriods[pid] > 0) {
      return prioritySubjectMinPeriods[pid];
    }
    const tier = subjectPriorityTiers[pid];
    if (tier === 'HIGH') return classrooms.length;
    if (tier === 'MEDIUM') return Math.round(classrooms.length * 0.6);
    if (tier === 'LOW') return Math.max(1, Math.round(classrooms.length * 0.2));
    if (priorityPaperIds.includes(pid)) return classrooms.length;
    let roomCount = 0;
    for (const r of classrooms) {
      if ((resolvedRoomPriorityMap[r.id] || []).includes(pid)) {
        roomCount++;
      }
    }
    return roomCount;
  };

  // If enableGuaranteedPriorityPeriods is active, ensure priority papers are populated across rooms
  if (activeRules.enableGuaranteedPriorityPeriods) {
    for (const p of schedulingPapers) {
      const minTarget = getGuaranteedMinPeriods(p.id);
      if (minTarget <= 0) continue;

      let currentRoomCount = classrooms.filter((r) =>
        (resolvedRoomPriorityMap[r.id] || []).includes(p.id)
      ).length;

      if (currentRoomCount < Math.min(minTarget, classrooms.length)) {
        const candidateRooms = [...classrooms]
          .filter(
            (r) =>
              !(resolvedRoomPriorityMap[r.id] || []).includes(p.id) &&
              !isPaperRoomQuotaCompleted(r.id, p.id)
          )
          .sort((a, b) => {
            const countA = roomPaperCompletedMap.get(a.id)?.get(p.id) || 0;
            const countB = roomPaperCompletedMap.get(b.id)?.get(p.id) || 0;
            return countA - countB;
          });

        for (const r of candidateRooms) {
          if (currentRoomCount >= minTarget || currentRoomCount >= classrooms.length) break;
          if (!resolvedRoomPriorityMap[r.id]) resolvedRoomPriorityMap[r.id] = [];
          resolvedRoomPriorityMap[r.id].push(p.id);
          currentRoomCount++;
        }
      }
    }
  }

  // Helper to get priority papers for a room (merging room-specific and global priorities)
  const getRoomPriorityPaperIds = (roomId: string): string[] => {
    const specific = resolvedRoomPriorityMap[roomId] || [];
    const global = priorityPaperIds || [];
    return Array.from(new Set([...specific, ...global])).filter(
      (pid) =>
        paperMap.has(pid) &&
        !combinedExcludedSet.has(pid) &&
        !isPaperRoomQuotaCompleted(roomId, pid)
    );
  };

  // 2. Filter available teachers (strictly exclude absentees with normalized ID comparison if enabled)
  const normalizedAbsentSet = activeRules.enableStrictAbsenteeExclusion
    ? new Set(absentTeacherIds.map(normalizeTeacherId))
    : new Set<string>();
  const availableTeachers = teachers.filter(
    (t) => !normalizedAbsentSet.has(normalizeTeacherId(t.id))
  );
  const availableTeacherIds = new Set(availableTeachers.map((t) => t.id));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));

  // Track daily workload for each teacher
  const teacherDailyLoad = new Map<string, number>();
  for (const t of availableTeachers) {
    teacherDailyLoad.set(t.id, 0);
  }

  // Calculate cumulative historical teacher sessions across past routines
  const teacherHistoricalSessions = new Map<string, number>();
  teachers.forEach((t) => teacherHistoricalSessions.set(t.id, 0));
  historicalRoutines
    .filter((r) => r.dayNumber < targetDayNumber)
    .forEach((r) => {
      r.slots.forEach((s) => {
        if (s.teacherId) {
          teacherHistoricalSessions.set(
            s.teacherId,
            (teacherHistoricalSessions.get(s.teacherId) || 0) + 1
          );
        }
      });
    });

  // Calculate active academy average teacher sessions to detect teacher lagging/advancement
  let totalPastSlotsForActive = 0;
  availableTeachers.forEach((t) => {
    totalPastSlotsForActive += teacherHistoricalSessions.get(t.id) || 0;
  });
  const avgTeacherSessions =
    availableTeachers.length > 0 ? totalPastSlotsForActive / availableTeachers.length : 0;

  const getTeacherTotalLoad = (tid: string): number => {
    return (teacherHistoricalSessions.get(tid) || 0) + (teacherDailyLoad.get(tid) || 0);
  };

  const getAcademyAverageLoad = (): number => {
    let totalAll = 0;
    availableTeachers.forEach((t) => {
      totalAll += (teacherHistoricalSessions.get(t.id) || 0) + (teacherDailyLoad.get(t.id) || 0);
    });
    return availableTeachers.length > 0 ? totalAll / availableTeachers.length : 0;
  };

  // SUBJECT DEFICIT & ARRANGEMENT EQUALIZATION:
  // USER RULE: "subject ka arrangement aisa banao.. ki .dhire dhire.. har techer ko approx same session mile"
  // Instead of raw remainingSessions (which starves shorter subjects like P07/P08),
  // we compute completion ratio deficit & teacher cumulative session deficit:
  // 1. Completion ratio deficit: (remainingSessions / totalTargetSessions) * 10
  // 2. Teacher deficit boost: If primary instructors for a paper are lagging behind the academy average,
  //    give a significant scheduling boost so their subject is taught and they catch up!
  const getPaperArrangementWeight = (
    paper: Paper,
    remaining: number,
    isPriority: boolean
  ): number => {
    const ratioRemaining =
      paper.totalTargetSessions > 0 ? remaining / paper.totalTargetSessions : 0;
    let baseWeight = ratioRemaining * 10; // 0 to 10 normalized scale

    // Check primary teachers load (if workload equalization is enabled)
    if (activeRules.enableWorkloadEqualization && paper.primaryTeacherIds.length > 0) {
      const activePrimary = paper.primaryTeacherIds.filter((tid) =>
        availableTeacherIds.has(tid)
      );
      if (activePrimary.length > 0) {
        const avgPrimaryLoad =
          activePrimary.reduce((sum, tid) => sum + getTeacherTotalLoad(tid), 0) /
          activePrimary.length;
        const teacherLag = avgTeacherSessions - avgPrimaryLoad;
        if (teacherLag > 0) {
          // Boost paper weight significantly so lagging instructors get scheduled!
          baseWeight += teacherLag * 4.0;
        } else if (teacherLag < -2) {
          // If teacher is already far ahead, temper weight slightly to create space for lagging teachers
          baseWeight = Math.max(0.5, baseWeight + teacherLag * 0.5);
        }
      }
    }

    if (isPriority) {
      baseWeight *= 4.0;
    }

    return Math.max(0.1, baseWeight);
  };

  // Per-room deficit map: roomId -> paperId -> weight
  const roomDeficitMaps = new Map<string, Map<string, number>>();
  for (const rp of roomProgressList) {
    const dMap = new Map<string, number>();
    const roomPrios = getRoomPriorityPaperIds(rp.classroom.id);
    for (const pp of rp.paperProgress) {
      const paper = paperMap.get(pp.paperId)!;
      const weight = getPaperArrangementWeight(
        paper,
        pp.remainingSessions,
        roomPrios.includes(pp.paperId)
      );
      dMap.set(pp.paperId, weight);
    }
    roomDeficitMaps.set(rp.classroom.id, dMap);
  }

  // Global paper deficit map as fallback
  const globalHistorical = calculateCumulativeStats(papers, historicalRoutines, []);
  const globalDeficitMap = new Map<string, number>();
  for (const prog of globalHistorical) {
    const paper = paperMap.get(prog.paperId)!;
    const weight = getPaperArrangementWeight(
      paper,
      prog.remainingSessions,
      priorityPaperIds.includes(prog.paperId)
    );
    globalDeficitMap.set(prog.paperId, weight);
  }

  // Track how many times a paper has been taught in each classroom today
  const roomPaperCounts = new Map<string, Map<string, number>>();
  for (const r of classrooms) {
    roomPaperCounts.set(r.id, new Map<string, number>());
  }

  // 3. Setup classroom indexes (1-based: 1..15) and mapping
  const classroomIndexMap = new Map<string, number>();
  const classroomMap = new Map<string, Classroom>();
  classrooms.forEach((c, idx) => {
    classroomIndexMap.set(c.id, idx + 1);
    classroomMap.set(c.id, c);
  });

  // Track last assigned slot for each teacher in the current day:
  interface TeacherSlotRecord {
    period: number;
    building: 'OLD' | 'NEW';
    roomIndex: number;
  }
  const teacherLastSlot = new Map<string, TeacherSlotRecord>();

  // Teacher room rotation target (1..15)
  // USER RULE: "yahi last day agar room 1 pe that to next period me.. use room2 milega .fir next period pe room 3 milega"
  const teacherTargetRoomIndex = new Map<string, number>();

  // Find previous day's routine (latest historical routine with dayNumber < targetDayNumber)
  const previousRoutines = historicalRoutines
    .filter((r) => r.dayNumber < targetDayNumber)
    .sort((a, b) => b.dayNumber - a.dayNumber);
  const previousDayRoutine = previousRoutines[0];

  // Preferred/ongoing paper for each instructor (starts with primary paper or paper from previous day's last slot)
  const teacherPreferredPaper = new Map<string, string>();

  teachers.forEach((t, i) => {
    // Moto (III): Stagger teachers strictly within their assigned building
    let initialTarget: number;
    if (t.assignedBuilding === 'OLD') {
      initialTarget = (i % 8) + 1; // Classrooms 1 to 8 (Old Building)
    } else if (t.assignedBuilding === 'NEW') {
      initialTarget = 9 + (i % 7); // Classrooms 9 to 15 (New Building)
    } else {
      initialTarget = (i % classrooms.length) + 1; // Floating across all 15 classrooms
    }
    let initialPaperId = t.primaryPaperIds[0] || 'P01';

    if (previousDayRoutine && previousDayRoutine.slots) {
      // Find all slots taught by this teacher on the previous day
      const pastSlots = previousDayRoutine.slots
        .filter((s) => s.teacherId === t.id)
        .sort((a, b) => b.period - a.period); // latest period first

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
        initialPaperId = lastSlot.paperId;
      }
    }

    teacherTargetRoomIndex.set(t.id, initialTarget);
    teacherPreferredPaper.set(t.id, initialPaperId);
  });

  // USER RULE: "building change hone par.. ek period ka gap milega.. aur sab floating par hoga"
  // If teacher taught in immediately preceding period in opposite building, they CANNOT teach in this period!
  const hasBuildingChangeConflict = (
    teacherId: string,
    period: number,
    targetBuilding: 'OLD' | 'NEW' | string
  ): boolean => {
    if (!activeRules.enableBuildingChangeGap) return false;
    const last = teacherLastSlot.get(teacherId);
    if (!last) return false;

    if (last.period === period - 1 && last.building !== targetBuilding) {
      return true;
    }
    return false;
  };

  // Helper to score and rank candidates based on room rotation progression, daily quota & cumulative session equalization:
  // USER RULE: "subject ka arrangement aisa banao.. ki .dhire dhire.. har techer ko approx same session mile"
  const sortCandidatesByProgressionAndLoad = (
    candidates: Teacher[],
    roomIndex: number,
    isPracticalOrBackup: boolean = false
  ): Teacher[] => {
    return [...candidates].sort((a, b) => {
      const loadA = teacherDailyLoad.get(a.id) || 0;
      const loadB = teacherDailyLoad.get(b.id) || 0;

      // Soft daily quota cap: Instructors with >= 3 periods today yield to instructors with < 3 (if enabled)
      if (activeRules.enableDailyWorkloadSoftCap) {
        const cappedA = loadA >= 3 ? 1 : 0;
        const cappedB = loadB >= 3 ? 1 : 0;
        if (cappedA !== cappedB) return cappedA - cappedB;
      }

      const totalA = getTeacherTotalLoad(a.id);
      const totalB = getTeacherTotalLoad(b.id);

      // Workload equalization: prioritize instructors with lower cumulative sessions
      if (activeRules.enableWorkloadEqualization && totalA !== totalB) {
        return totalA - totalB;
      }

      // If daily load difference is >= 2, prioritize instructor with fewer periods today
      if (Math.abs(loadA - loadB) >= 2) {
        return loadA - loadB;
      }

      // Room carousel circular distance (progression flow)
      const targetA = teacherTargetRoomIndex.get(a.id) || 1;
      const targetB = teacherTargetRoomIndex.get(b.id) || 1;
      const distA = (roomIndex - targetA + classrooms.length) % classrooms.length;
      const distB = (roomIndex - targetB + classrooms.length) % classrooms.length;

      if (distA !== distB) return distA - distB;

      // Final tie-breakers
      if (totalA !== totalB) return totalA - totalB;
      return loadA - loadB;
    });
  };

  // Cross-subject mutual backup map as specified by user:
  // Forensics (P05) <-> ICT (P06)
  // Police Admin (P08, P09) <-> Criminology (P07)
  const CROSS_SUBJECT_BACKUP_MAP: Record<string, { backupPaperIds: string[]; pairLabel: string }> = {
    P05: { backupPaperIds: ['P06'], pairLabel: 'Forensics ↔ ICT Cyber Instructor Mutual Backup' },
    P06: { backupPaperIds: ['P05'], pairLabel: 'ICT Cyber ↔ Forensics Instructor Mutual Backup' },
    P07: { backupPaperIds: ['P08', 'P09'], pairLabel: 'Criminology ↔ Police Admin Instructor Mutual Backup' },
    P08: { backupPaperIds: ['P07', 'P09'], pairLabel: 'Police Admin ↔ Criminology Instructor Mutual Backup' },
    P09: { backupPaperIds: ['P07', 'P08'], pairLabel: 'Station Mgmt ↔ Criminology Instructor Mutual Backup' },
  };

  // Moto (III): Strict Building Binding helper (Old teachers in Old Building, New in New Building, Floating in both)
  const isTeacherAllowedInRoomBuilding = (t: Teacher, rBuilding: string): boolean => {
    if (!activeRules.enableStrictBuildingBinding) return true;
    if (t.assignedBuilding === 'FLOATING') return true;
    return t.assignedBuilding === rBuilding;
  };

  // Helper to check if any qualified teacher can teach a paper in the given period for a specific room
  const canTeachInPeriod = (
    paper: Paper,
    busyTeachersInPeriod: Set<string>,
    room: Classroom,
    period: number
  ): boolean => {
    const roomBuilding = room.building as 'OLD' | 'NEW';
    const isTeacherEligible = (tid: string): boolean => {
      if (!availableTeacherIds.has(tid)) return false;
      if (activeRules.enableZeroDoubleBooking && busyTeachersInPeriod.has(tid)) return false;
      const t = teacherMap.get(tid);
      if (!t) return false;
      if (!isTeacherAllowedInRoomBuilding(t, roomBuilding)) return false;
      if (hasBuildingChangeConflict(tid, period, roomBuilding)) return false;
      const dailyLoad = teacherDailyLoad.get(tid) || 0;
      const maxLimit = Math.min(4, t.maxDailyPeriods || 4);
      if (activeRules.enableDailyWorkloadMaxCap && dailyLoad >= maxLimit) return false;
      return true;
    };

    // Practical P13
    if (paper.id === 'P13') {
      return availableTeachers.some((t) => isTeacherEligible(t.id));
    }

    // Primary teachers
    if (paper.primaryTeacherIds.some(isTeacherEligible)) {
      return true;
    }

    // Designated backup teachers
    if (
      availableTeachers.some((t) => {
        const isBackup =
          (t.backupPaperIds && t.backupPaperIds.includes(paper.id)) ||
          (t.secondaryPaperIds && t.secondaryPaperIds.includes(paper.id));
        const dailyLoad = teacherDailyLoad.get(t.id) || 0;
        const withinQuota = dailyLoad < (t.maxDailyPeriods || 4);
        return isBackup && withinQuota && isTeacherEligible(t.id);
      })
    ) {
      return true;
    }

    // Cross-backup pairs
    const crossConfig = CROSS_SUBJECT_BACKUP_MAP[paper.id];
    if (crossConfig) {
      for (const bpid of crossConfig.backupPaperIds) {
        const bp = paperMap.get(bpid);
        if (bp && bp.primaryTeacherIds.some(isTeacherEligible)) {
          return true;
        }
      }
    }

    // Nearest papers
    for (const nid of paper.nearestPaperIds) {
      const np = paperMap.get(nid);
      if (np && np.primaryTeacherIds.some(isTeacherEligible)) {
        return true;
      }
    }

    // Secondary qualified teachers
    if (availableTeachers.some((t) => t.secondaryPaperIds.includes(paper.id) && isTeacherEligible(t.id))) {
      return true;
    }

    // Emergency reserve: any available teacher who is free and has no building conflict
    return availableTeachers.some((t) => isTeacherEligible(t.id));
  };

  // Score a candidate paper based on its faculty's need for teaching load equalization across the 6-day cycle
  const getPaperFacultyWorkloadScore = (paper: Paper, roomBuilding: string): number => {
    if (!activeRules.enableSubjectFacultyLoadBalancing && !activeRules.enableWorkloadEqualization) {
      return 0;
    }

    const avgAcademy = getAcademyAverageLoad();

    if (paper.id === 'P13') {
      const freeEligible = availableTeachers.filter(
        (t) => isTeacherAllowedInRoomBuilding(t, roomBuilding) && (teacherDailyLoad.get(t.id) || 0) < 4
      );
      if (freeEligible.length === 0) return -50;
      const minLoad = Math.min(...freeEligible.map((t) => getTeacherTotalLoad(t.id)));
      const minDaily = Math.min(...freeEligible.map((t) => teacherDailyLoad.get(t.id) || 0));
      const lag = avgAcademy - minLoad;
      const dailyBonus = (3 - minDaily) * 2.0;
      return lag * 2.5 + dailyBonus;
    }

    const eligiblePrimaries = paper.primaryTeacherIds
      .filter((tid) => availableTeacherIds.has(tid))
      .map((tid) => teacherMap.get(tid)!)
      .filter((t) => t && isTeacherAllowedInRoomBuilding(t, roomBuilding));

    if (eligiblePrimaries.length === 0) {
      return -15;
    }

    const withCapacity = eligiblePrimaries.filter((t) => (teacherDailyLoad.get(t.id) || 0) < 4);
    if (withCapacity.length === 0) {
      return -100; // All primary instructors have reached 4 periods today!
    }

    const minLoad = Math.min(...withCapacity.map((t) => getTeacherTotalLoad(t.id)));
    const minDaily = Math.min(...withCapacity.map((t) => teacherDailyLoad.get(t.id) || 0));
    const lag = avgAcademy - minLoad;
    const dailyBonus = (3 - minDaily) * 2.5;

    return lag * 3.0 + dailyBonus;
  };

  // Moto (II) & Quota constraints: Helper to check if a paper can be scheduled in this classroom
  const canPaperBeScheduledInRoom = (
    paperId: string,
    roomId: string,
    period: number,
    lastPaperIdInRoom?: string
  ): boolean => {
    // 1. Exclude if paper is explicitly excluded
    if (combinedExcludedSet.has(paperId)) return false;

    // 2. Exclude if paper is already 100% quota completed in this classroom
    const timesInRoomToday = roomPaperCounts.get(roomId)?.get(paperId) || 0;
    if (isPaperRoomQuotaCompleted(roomId, paperId, timesInRoomToday)) return false;

    // 3. Moto (II): Max 1 period per subject per room daily (5 different subjects daily)
    if (activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && timesInRoomToday >= 1) return false;

    // 4. Max 2 periods daily cap
    if (activeRules.enableMaxRoomDailyLimit && timesInRoomToday >= 2) return false;

    // 5. Moto (II): Non-consecutive subject gap (strictly never consecutive)
    if (activeRules.enableNonConsecutiveGapForSameSubject && lastPaperIdInRoom && lastPaperIdInRoom === paperId) {
      return false;
    }

    return true;
  };

  // Paper selection helper with room-specific deficit & completion % equalization (Moto I)
  const pickBestPaperForRoom = (
    roomId: string,
    period: number,
    busyTeachersInPeriod: Set<string>,
    room: Classroom,
    lastPaperIdInRoom?: string
  ): Paper => {
    const roomCounts = roomPaperCounts.get(roomId)!;
    const roomDeficits = roomDeficitMaps.get(roomId) || globalDeficitMap;
    const roomPrios = getRoomPriorityPaperIds(roomId);

    // Filter candidate papers that strictly satisfy room constraints (Tier 1 Moto II)
    const roomValidCandidates = schedulingPapers.filter((p) => canPaperBeScheduledInRoom(p.id, roomId, period, lastPaperIdInRoom));
    const candidatesWithTeachers = roomValidCandidates.filter((p) => canTeachInPeriod(p, busyTeachersInPeriod, room, period));

    // Prefer papers that satisfy room constraints AND have available teachers; if no teacher available under cap, still preserve room constraint
    const nonCompletedCandidates = schedulingPapers.filter(
      (p) => !combinedExcludedSet.has(p.id) && !isPaperRoomQuotaCompleted(roomId, p.id, roomCounts.get(p.id) || 0)
    );
    const pool = candidatesWithTeachers.length > 0 
      ? candidatesWithTeachers 
      : (roomValidCandidates.length > 0 ? roomValidCandidates : (nonCompletedCandidates.length > 0 ? nonCompletedCandidates : schedulingPapers));

    const getPaperSelectionScore = (p: Paper): number => {
      let score = 0;
      if (roomPrios.includes(p.id)) score += 100;

      if (activeRules.enableClassroomSubjectEqualization) {
        const targetQuota = p.totalTargetSessions > 0 ? Math.max(1, Math.round(p.totalTargetSessions / classrooms.length)) : 2;
        const countInRoom = (roomPaperCompletedMap.get(room.id)?.get(p.id) || 0) + (roomCounts.get(p.id) || 0);
        const percent = (countInRoom / targetQuota) * 100;
        score += (100 - percent) * 0.5;
      }

      if (activeRules.enableSubjectFacultyLoadBalancing || activeRules.enableWorkloadEqualization) {
        score += getPaperFacultyWorkloadScore(p, room.building);
      }

      return score;
    };

    const sorted = [...pool].sort((a, b) => getPaperSelectionScore(b) - getPaperSelectionScore(a));

    // Add mild randomized rotation among top 3 candidates to avoid lock-step repetition across rooms
    const topCandidates = sorted.slice(0, Math.min(3, sorted.length));
    const chosen = topCandidates[Math.floor(Math.random() * topCandidates.length)] || sorted[0];

    // Decrement room deficit slightly so same paper doesn't starve others in the same day for this room
    const currentWeight = roomDeficits.get(chosen.id) || 1;
    roomDeficits.set(chosen.id, Math.max(0.5, currentWeight - 0.7));

    return chosen;
  };

  // Teacher finder helper with room progression rotation & building change gap logic
  const assignTeacherForPaperInPeriod = (
    paper: Paper,
    period: number,
    busyTeachersInPeriod: Set<string>,
    room: Classroom,
    lastPaperIdInRoom?: string
  ): {
    teacherId: string;
    isSubstitute: boolean;
    originalTeacherId?: string;
    substituteReason?: string;
    alternatePaperId?: string;
  } => {
    const roomIndex = classroomIndexMap.get(room.id) || 1;
    const roomBuilding = room.building as 'OLD' | 'NEW';

    // User Rule: "Practical k liye.. fixed teachers ki jarurat nhi.. koi v teacher practical karega.."
    // Practical acts as the primary academy-wide equalizer: candidates with lowest cumulative sessions are picked first!
    if (activeRules.enablePracticalFlexible && paper.id === 'P13') {
      const freeForPractical = availableTeachers.filter(
        (t) =>
          !busyTeachersInPeriod.has(t.id) &&
          isTeacherAllowedInRoomBuilding(t, roomBuilding) &&
          !hasBuildingChangeConflict(t.id, period, roomBuilding) &&
          (!activeRules.enableDailyWorkloadMaxCap || (teacherDailyLoad.get(t.id) || 0) < Math.min(4, t.maxDailyPeriods || 4))
      );
      if (freeForPractical.length > 0) {
        const sorted = sortCandidatesByProgressionAndLoad(freeForPractical, roomIndex, true);
        return {
          teacherId: sorted[0].id,
          isSubstitute: false,
        };
      }
    }

    // 1. First priority: Primary teachers of this paper who are available, not busy, and have NO building conflict
    const freePrimaryTeachers = paper.primaryTeacherIds
      .filter(
        (tid) =>
          availableTeacherIds.has(tid) &&
          !busyTeachersInPeriod.has(tid) &&
          isTeacherAllowedInRoomBuilding(teacherMap.get(tid)!, roomBuilding) &&
          !hasBuildingChangeConflict(tid, period, roomBuilding) &&
          (!activeRules.enableDailyWorkloadMaxCap || (teacherDailyLoad.get(tid) || 0) < Math.min(4, teacherMap.get(tid)?.maxDailyPeriods || 4))
      )
      .map((tid) => teacherMap.get(tid)!)
      .filter(Boolean);

    const primaryWithinQuota = freePrimaryTeachers.filter((t) => {
      const dailyLoad = teacherDailyLoad.get(t.id) || 0;
      const withinMax = dailyLoad < (t.maxDailyPeriods || 4);
      const withinSoftCap = !activeRules.enableDailyWorkloadSoftCap || dailyLoad < 3;
      return withinMax && withinSoftCap;
    });

    if (primaryWithinQuota.length > 0) {
      const sorted = sortCandidatesByProgressionAndLoad(primaryWithinQuota, roomIndex, false);
      return {
        teacherId: sorted[0].id,
        isSubstitute: false,
      };
    }

    // 1b. Check if any free primary teacher exists (even at soft-cap)
    if (freePrimaryTeachers.length > 0) {
      const sorted = sortCandidatesByProgressionAndLoad(freePrimaryTeachers, roomIndex, false);
      return {
        teacherId: sorted[0].id,
        isSubstitute: false,
      };
    }

    // USER RULE: "no subsitute attotemnet.. agar kisi subject k liye main techer nhi to.. koi subsitute techer apply nhi hoga.. bass.. wo jagah khali rahega.. iske sub header me ek rule add karo. ki usko dusra availbale subject se replace karne kliye.."
    if (activeRules.enableNoSubstituteAllotment) {
      if (activeRules.replaceWithAvailableSubjectIfNoPrimary) {
        // Sub-rule: Replace slot with another available subject whose primary instructor IS free (strictly adhering to Tier 1 Room Constraints)
        for (const altPaper of schedulingPapers) {
          if (altPaper.id === paper.id) continue;
          if (!canPaperBeScheduledInRoom(altPaper.id, room.id, period, lastPaperIdInRoom)) continue;

          const altPrimaryFree = altPaper.primaryTeacherIds
            .filter(
              (tid) => {
                if (!availableTeacherIds.has(tid)) return false;
                if (busyTeachersInPeriod.has(tid)) return false;
                const t = teacherMap.get(tid);
                if (!t || !isTeacherAllowedInRoomBuilding(t, roomBuilding)) return false;
                if (hasBuildingChangeConflict(tid, period, roomBuilding)) return false;
                // Tier 1 Hard Rule 9: Hard-Cap of Max 4 Periods/Day per Instructor
                const currentLoad = teacherDailyLoad.get(tid) || 0;
                const maxAllowed = Math.min(4, t.maxDailyPeriods || 4);
                if (activeRules.enableDailyWorkloadMaxCap && currentLoad >= maxAllowed) return false;
                return true;
              }
            )
            .map((tid) => teacherMap.get(tid)!)
            .filter(Boolean);

          if (altPrimaryFree.length > 0) {
            const sorted = sortCandidatesByProgressionAndLoad(altPrimaryFree, roomIndex, false);
            return {
              teacherId: sorted[0].id,
              isSubstitute: false,
              alternatePaperId: altPaper.id,
              substituteReason: `Substituted with alternate available subject [${altPaper.code}] ${altPaper.title} because primary instructor of ${paper.code} was unavailable`,
            };
          }
        }
      }

      // No substitute allotted: Slot left blank / vacant
      return {
        teacherId: '',
        isSubstitute: false,
        substituteReason: 'No substitute instructor allotted (Strict No-Substitute rule active)',
      };
    }

    // Identify who would have been the preferred primary teacher for this room
    const preferredOriginalId = paper.primaryTeacherIds[0] || 'T1';
    const isOriginalAbsent = absentTeacherIds.includes(preferredOriginalId);
    const primaryAbsentReason = isOriginalAbsent
      ? 'Primary instructor on leave today'
      : 'Primary instructor busy in another classroom';

    // 2. Designated Backup Instructors assigned to this subject paper (with NO building conflict)
    // Rule: "backup subject matlab hi floating ho"
    const freeBackupTeachers = availableTeachers.filter((t) => {
      const isBackup =
        (t.backupPaperIds && t.backupPaperIds.includes(paper.id)) ||
        (t.secondaryPaperIds && t.secondaryPaperIds.includes(paper.id));
      const dailyLoad = teacherDailyLoad.get(t.id) || 0;
      const withinQuota = dailyLoad < (t.maxDailyPeriods || 4);
      return (
        isBackup &&
        withinQuota &&
        !busyTeachersInPeriod.has(t.id) &&
        isTeacherAllowedInRoomBuilding(t, roomBuilding) &&
        !hasBuildingChangeConflict(t.id, period, roomBuilding)
      );
    });

    if (activeRules.enableDesignatedBackup && freeBackupTeachers.length > 0) {
      freeBackupTeachers.sort((a, b) => {
        // Priority 1: Backup Slot 1 prioritized over Backup Slot 2
        const indexA = a.backupPaperIds ? a.backupPaperIds.indexOf(paper.id) : 99;
        const indexB = b.backupPaperIds ? b.backupPaperIds.indexOf(paper.id) : 99;
        if (indexA !== indexB && indexA !== -1 && indexB !== -1) return indexA - indexB;

        // Priority 2: Workload daily soft-cap
        const loadA = teacherDailyLoad.get(a.id) || 0;
        const loadB = teacherDailyLoad.get(b.id) || 0;
        const cappedA = loadA >= 3 ? 1 : 0;
        const cappedB = loadB >= 3 ? 1 : 0;
        if (cappedA !== cappedB) return cappedA - cappedB;

        // Priority 3: Cumulative workload balance
        const totalA = getTeacherTotalLoad(a.id);
        const totalB = getTeacherTotalLoad(b.id);
        if (totalA !== totalB) return totalA - totalB;

        // Priority 4: Room rotation progression
        const targetA = teacherTargetRoomIndex.get(a.id) || 1;
        const targetB = teacherTargetRoomIndex.get(b.id) || 1;
        const distA = (roomIndex - targetA + classrooms.length) % classrooms.length;
        const distB = (roomIndex - targetB + classrooms.length) % classrooms.length;
        if (distA !== distB) return distA - distB;

        return loadA - loadB;
      });

      const selected = freeBackupTeachers[0];
      return {
        teacherId: selected.id,
        isSubstitute: true,
        originalTeacherId: preferredOriginalId,
        substituteReason: `${primaryAbsentReason} - Designated Backup Instructor [${selected.code}] ${selected.name} (Floating across campus) appointed`,
      };
    }

    // 3. Third priority: Explicit Cross-Subject Mutual Backup Pairs (with NO building conflict)
    const crossBackupConfig = CROSS_SUBJECT_BACKUP_MAP[paper.id];
    if (activeRules.enableCrossMutualBackup && crossBackupConfig) {
      const crossTeachers: Teacher[] = [];
      for (const backupPid of crossBackupConfig.backupPaperIds) {
        const bPaper = paperMap.get(backupPid);
        if (!bPaper) continue;
        for (const tid of bPaper.primaryTeacherIds) {
          if (
            availableTeacherIds.has(tid) &&
            !busyTeachersInPeriod.has(tid) &&
            isTeacherAllowedInRoomBuilding(teacherMap.get(tid)!, roomBuilding) &&
            !hasBuildingChangeConflict(tid, period, roomBuilding)
          ) {
            const t = teacherMap.get(tid);
            const load = teacherDailyLoad.get(tid) || 0;
            if (t && load < (t.maxDailyPeriods || 4) && !crossTeachers.some((ct) => ct.id === t.id)) {
              crossTeachers.push(t);
            }
          }
        }
      }

      if (crossTeachers.length > 0) {
        const sorted = sortCandidatesByProgressionAndLoad(crossTeachers, roomIndex, true);
        return {
          teacherId: sorted[0].id,
          isSubstitute: true,
          originalTeacherId: preferredOriginalId,
          substituteReason: `${primaryAbsentReason} - ${crossBackupConfig.pairLabel} substitute appointed`,
        };
      }
    }

    // 4. Fourth priority: Substitute from Nearest Subject Papers (with NO building conflict)
    const nearestTeachers: Teacher[] = [];
    for (const nearId of paper.nearestPaperIds) {
      const nearPaper = paperMap.get(nearId);
      if (!nearPaper) continue;
      for (const tid of nearPaper.primaryTeacherIds) {
        if (
          availableTeacherIds.has(tid) &&
          !busyTeachersInPeriod.has(tid) &&
          isTeacherAllowedInRoomBuilding(teacherMap.get(tid)!, roomBuilding) &&
          !hasBuildingChangeConflict(tid, period, roomBuilding)
        ) {
          const t = teacherMap.get(tid);
          const load = teacherDailyLoad.get(tid) || 0;
          if (t && load < (t.maxDailyPeriods || 4) && !nearestTeachers.some((item) => item.id === t.id)) {
            nearestTeachers.push(t);
          }
        }
      }
    }

    if (nearestTeachers.length > 0) {
      const sorted = sortCandidatesByProgressionAndLoad(nearestTeachers, roomIndex, true);
      return {
        teacherId: sorted[0].id,
        isSubstitute: true,
        originalTeacherId: preferredOriginalId,
        substituteReason: `${primaryAbsentReason} - Nearest related subject instructor substitute appointed`,
      };
    }

    // 5. Fifth priority: Secondary qualified teachers (with NO building conflict)
    const secondaryTeachers = availableTeachers.filter(
      (t) =>
        t.secondaryPaperIds.includes(paper.id) &&
        (teacherDailyLoad.get(t.id) || 0) < (t.maxDailyPeriods || 4) &&
        !busyTeachersInPeriod.has(t.id) &&
        isTeacherAllowedInRoomBuilding(t, roomBuilding) &&
        !hasBuildingChangeConflict(t.id, period, roomBuilding)
    );

    if (secondaryTeachers.length > 0) {
      const sorted = sortCandidatesByProgressionAndLoad(secondaryTeachers, roomIndex, true);
      return {
        teacherId: sorted[0].id,
        isSubstitute: true,
        originalTeacherId: preferredOriginalId,
        substituteReason: `${primaryAbsentReason} - Secondary qualified instructor substitute appointed`,
      };
    }

    // 6. Primary teachers with no building conflict (even if at soft-cap)
    if (freePrimaryTeachers.length > 0) {
      const sorted = sortCandidatesByProgressionAndLoad(freePrimaryTeachers, roomIndex, false);
      return {
        teacherId: sorted[0].id,
        isSubstitute: false,
      };
    }

    // 7. Emergency reserve: Any free teacher with NO building conflict
    const freeWithoutConflict = availableTeachers.filter(
      (t) => !busyTeachersInPeriod.has(t.id) && isTeacherAllowedInRoomBuilding(t, roomBuilding) && !hasBuildingChangeConflict(t.id, period, roomBuilding) && (!activeRules.enableDailyWorkloadMaxCap || (teacherDailyLoad.get(t.id) || 0) < Math.min(4, t.maxDailyPeriods || 4))
    );
    if (freeWithoutConflict.length > 0) {
      const sorted = sortCandidatesByProgressionAndLoad(freeWithoutConflict, roomIndex, true);
      return {
        teacherId: sorted[0].id,
        isSubstitute: true,
        originalTeacherId: preferredOriginalId,
        substituteReason: `${primaryAbsentReason} - Emergency reserve instructor appointed`,
      };
    }

    // Edge case if all preferred teachers are busy: pick any free teacher ALLOWED in this building under cap & with transit gap
    const anyFreeInBuilding = availableTeachers.filter(
      (t) =>
        !busyTeachersInPeriod.has(t.id) &&
        isTeacherAllowedInRoomBuilding(t, roomBuilding) &&
        !hasBuildingChangeConflict(t.id, period, roomBuilding) &&
        (!activeRules.enableDailyWorkloadMaxCap || (teacherDailyLoad.get(t.id) || 0) < Math.min(4, t.maxDailyPeriods || 4))
    );
    if (anyFreeInBuilding.length > 0) {
      const sorted = sortCandidatesByProgressionAndLoad(anyFreeInBuilding, roomIndex, true);
      return {
        teacherId: sorted[0].id,
        isSubstitute: true,
        originalTeacherId: preferredOriginalId,
        substituteReason: `${primaryAbsentReason} - Emergency reserve instructor appointed`,
      };
    }

    // If still no teacher allowed in this building is free under cap, check if preferred teacher is allowed in building
    const prefTeacher = teacherMap.get(preferredOriginalId);
    if (
      prefTeacher &&
      isTeacherAllowedInRoomBuilding(prefTeacher, roomBuilding) &&
      !hasBuildingChangeConflict(prefTeacher.id, period, roomBuilding) &&
      (!activeRules.enableDailyWorkloadMaxCap || (teacherDailyLoad.get(prefTeacher.id) || 0) < Math.min(4, prefTeacher.maxDailyPeriods || 4)) &&
      !busyTeachersInPeriod.has(prefTeacher.id)
    ) {
      return {
        teacherId: prefTeacher.id,
        isSubstitute: false,
      };
    }

    // Under strict building binding, NEVER assign an instructor from the wrong building: leave slot blank!
    return {
      teacherId: '',
      isSubstitute: false,
      substituteReason: 'No instructor available in this building under maximum load cap',
    };
  };

  // 3. User Rule: "har din new routine creation me.. room wise priority ka option ho.. taki priority subject included hone hi chahiye.. aur suffle hone chahiye.. har period.."
  // Pre-plan target papers for each classroom today
  const roomDailyPlans = new Map<string, Paper[]>();


    for (let rIdx = 0; rIdx < classrooms.length; rIdx++) {
      const room = classrooms[rIdx];
      const prioIds = getRoomPriorityPaperIds(room.id);
      const prioPapers = prioIds
        .map((pid) => paperMap.get(pid)!)
        .filter((p) => Boolean(p) && !isPaperRoomQuotaCompleted(room.id, p.id));

      const roomDeficits = roomDeficitMaps.get(room.id) || globalDeficitMap;
      const getRoomPlanScore = (p: Paper): number => {
        let score = 0;
        const targetQuota = p.totalTargetSessions > 0 ? Math.max(1, Math.round(p.totalTargetSessions / classrooms.length)) : 2;
        const countInThisRoom = roomPaperCompletedMap.get(room.id)?.get(p.id) || 0;
        const percent = (countInThisRoom / targetQuota) * 100;

        if (activeRules.enableClassroomSubjectEqualization) {
          score += (100 - percent) * 0.4;
        }

        if (activeRules.enableSubjectFacultyLoadBalancing || activeRules.enableWorkloadEqualization) {
          score += getPaperFacultyWorkloadScore(p, room.building);
        }

        return score;
      };

      const nonPrioPapers = schedulingPapers
        .filter((p) => !prioIds.includes(p.id) && !isPaperRoomQuotaCompleted(room.id, p.id))
        .sort((a, b) => getRoomPlanScore(b) - getRoomPlanScore(a));

      // Take all priority papers (up to 5)
      const selectedPapers: Paper[] = [...prioPapers.slice(0, 5)];

      if (activeRules.enableClassroomSubjectEqualization) {
        const getPercent = (p: Paper) => {
          const count = roomPaperCompletedMap.get(room.id)?.get(p.id) || 0;
          const target = p.totalTargetSessions > 0 ? p.totalTargetSessions : 30;
          return (count / target) * 100;
        };

        const minPercent = nonPrioPapers.length > 0 ? getPercent(nonPrioPapers[0]) : 0;
        const urgentPapers = nonPrioPapers.filter((p) => getPercent(p) <= minPercent + 2);
        for (const urg of urgentPapers) {
          if (selectedPapers.length >= 5) break;
          if (!selectedPapers.some((p) => p.id === urg.id)) {
            selectedPapers.push(urg);
          }
        }

        let candidateIdx = nonPrioPapers.length > 0 ? (rIdx * 2) % nonPrioPapers.length : 0;
        let attempts = 0;
        while (selectedPapers.length < 5 && attempts < nonPrioPapers.length) {
          const candidate = nonPrioPapers[candidateIdx % nonPrioPapers.length];
          if (!selectedPapers.some((p) => p.id === candidate.id)) {
            selectedPapers.push(candidate);
          }
          candidateIdx++;
          attempts++;
        }
      } else {
        let candidateIdx = nonPrioPapers.length > 0 ? (rIdx * 2) % nonPrioPapers.length : 0;
        let attempts = 0;
        while (selectedPapers.length < 5 && attempts < nonPrioPapers.length) {
          const paperCandidate = nonPrioPapers[candidateIdx % nonPrioPapers.length];
          if (!selectedPapers.some((p) => p.id === paperCandidate.id)) {
            selectedPapers.push(paperCandidate);
          }
          candidateIdx++;
          attempts++;
        }
      }

      const availableNonCompleted = schedulingPapers.filter(
        (p) => !combinedExcludedSet.has(p.id) && !isPaperRoomQuotaCompleted(room.id, p.id)
      );
      for (const cand of availableNonCompleted) {
        if (selectedPapers.length >= 5) break;
        if (!selectedPapers.some((p) => p.id === cand.id)) {
          selectedPapers.push(cand);
        }
      }

      // If still fewer than 5, pull from any scheduling papers not already in selectedPapers
      for (const p of schedulingPapers) {
        if (selectedPapers.length >= 5) break;
        if (!combinedExcludedSet.has(p.id) && !selectedPapers.some((item) => item.id === p.id)) {
          selectedPapers.push(p);
        }
      }

      // Final fallback if total available papers is less than 5: ensure non-consecutive
      while (selectedPapers.length < 5) {
        const nextCandidate = schedulingPapers.find((p) => p.id !== selectedPapers[selectedPapers.length - 1]?.id) || schedulingPapers[0];
        selectedPapers.push(nextCandidate);
      }

      // Shuffle periods for this room so priority papers and subjects are distributed across periods 1 to 5
      for (let i = selectedPapers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selectedPapers[i], selectedPapers[j]] = [selectedPapers[j], selectedPapers[i]];
      }

      roomDailyPlans.set(room.id, selectedPapers);
    }

  const generatedSlots: ClassSlot[] = [];

  // Generate slots period by period (P1 to P5) across all 15 classrooms
  // Classrooms are ordered sequentially (OB-1..OB-8, NB-1..NB-7) so room progression naturally flows
  const orderedRooms = [...classrooms].sort(
    (a, b) => (classroomIndexMap.get(a.id) || 0) - (classroomIndexMap.get(b.id) || 0)
  );

  for (let period = 1; period <= 5; period++) {
    const busyTeachersInPeriod = new Set<string>();

    for (const room of orderedRooms) {
      const roomIndex = classroomIndexMap.get(room.id) || 1;
      const roomBuilding = room.building as 'OLD' | 'NEW';
      const roomCounts = roomPaperCounts.get(room.id)!;
      const roomPrioIds = getRoomPriorityPaperIds(room.id);
      const plan = roomDailyPlans.get(room.id)!;

      const isPlannedPeriodPriority = roomPrioIds.includes(plan[period - 1].id);

      let chosenPaper: Paper | null = null;
      let assignment: { teacherId: string; isSubstitute: boolean; originalTeacherId?: string; substituteReason?: string } | null = null;

      // 1. Check if an incoming instructor is rotating into this classroom with their subject (Teacher Caravan)!
      // USER RULE: "suppose techer 5, paper 2 le rha h.. class 6 me.. 2nd period me.. to uska next possible periad hona chahiye.. paper 2, class 7 , 3rd period me.. and so on.. isi ko calculte karna.. aur apply karna h.. day wise and period wise also.. sath hi.. building change par 1 period ka gap.."
      // A. Same building consecutive rotation (Room 1 -> 2, 2 -> 3 ... 7 -> 8; Room 9 -> 10 ... 14 -> 15)
      const canRotateConsecutiveSameBuilding =
        (roomIndex >= 2 && roomIndex <= 8) || (roomIndex >= 10 && roomIndex <= 15);

      if (activeRules.enableCaravanFlow && period > 1 && canRotateConsecutiveSameBuilding) {
        const prevRoomIndex = roomIndex - 1;
        const prevSlot = generatedSlots.find(
          (s) => s.period === period - 1 && classroomIndexMap.get(s.roomId) === prevRoomIndex
        );

        if (
          prevSlot &&
          availableTeacherIds.has(prevSlot.teacherId) &&
          !busyTeachersInPeriod.has(prevSlot.teacherId)
        ) {
          const t = teacherMap.get(prevSlot.teacherId);
          const currentLoad = teacherDailyLoad.get(prevSlot.teacherId) || 0;
          const withinQuota = currentLoad < (t?.maxDailyPeriods || 4) && currentLoad < 3;
          const timesPaperInRoom = roomCounts.get(prevSlot.paperId) || 0;
          const notExcluded = !combinedExcludedSet.has(prevSlot.paperId);
          const notQuotaCompleted = !isPaperRoomQuotaCompleted(room.id, prevSlot.paperId, timesPaperInRoom);
          const canFitPriority = !isPlannedPeriodPriority || prevSlot.paperId === plan[period - 1].id;

          if (withinQuota && timesPaperInRoom < 2 && notExcluded && notQuotaCompleted && canFitPriority) {
            const p = paperMap.get(prevSlot.paperId);
            if (p) {
              chosenPaper = p;
              assignment = {
                teacherId: prevSlot.teacherId,
                isSubstitute: prevSlot.isSubstitute,
                originalTeacherId: prevSlot.originalTeacherId,
                substituteReason: prevSlot.substituteReason,
              };
            }
          }
        }
      }

      // B. Cross-building rotation with mandatory 1-period gap (Room 8 -> Room 9; Room 15 -> Room 1)
      if (activeRules.enableCaravanFlow && period > 2 && !assignment) {
        let prevCrossRoomIndex = 0;
        if (roomIndex === 9) prevCrossRoomIndex = 8; // Old Bldg Room 8 -> New Bldg Room 9 after 1-period gap
        if (roomIndex === 1) prevCrossRoomIndex = 15; // New Bldg Room 15 -> Old Bldg Room 1 after 1-period gap

        if (prevCrossRoomIndex > 0) {
          const gapSlot = generatedSlots.find(
            (s) => s.period === period - 2 && classroomIndexMap.get(s.roomId) === prevCrossRoomIndex
          );

          if (
            gapSlot &&
            availableTeacherIds.has(gapSlot.teacherId) &&
            !busyTeachersInPeriod.has(gapSlot.teacherId)
          ) {
            const last = teacherLastSlot.get(gapSlot.teacherId);
            // Ensure teacher was free in period - 1 (mandatory 1-period gap)
            if (last && last.period <= period - 2) {
              const t = teacherMap.get(gapSlot.teacherId);
              const currentLoad = teacherDailyLoad.get(gapSlot.teacherId) || 0;
              const withinQuota = currentLoad < (t?.maxDailyPeriods || 4) && currentLoad < 3;
              const timesPaperInRoom = roomCounts.get(gapSlot.paperId) || 0;
              const notExcluded = !combinedExcludedSet.has(gapSlot.paperId);
              const notQuotaCompleted = !isPaperRoomQuotaCompleted(room.id, gapSlot.paperId, timesPaperInRoom);
              const canFitPriority = !isPlannedPeriodPriority || gapSlot.paperId === plan[period - 1].id;

              if (withinQuota && timesPaperInRoom < 2 && notExcluded && notQuotaCompleted && canFitPriority) {
                const p = paperMap.get(gapSlot.paperId);
                if (p) {
                  chosenPaper = p;
                  assignment = {
                    teacherId: gapSlot.teacherId,
                    isSubstitute: gapSlot.isSubstitute,
                    originalTeacherId: gapSlot.originalTeacherId,
                    substituteReason: gapSlot.substituteReason,
                  };
                }
              }
            }
          }
        }
      }

      // Find previous slot in this classroom today to enforce non-consecutive gap (Moto II)
      const lastSlotInRoom = generatedSlots.slice().reverse().find((s) => s.roomId === room.id);
      const lastPaperIdInRoom = lastSlotInRoom?.paperId;

      // 1B. Moto (IV): Sequential Subject / Paper Rotational Flow across Classrooms
      // "subject detailment .. har next period me next room me detail ho.. aisa sequence ho.. ..alag alag room me.. subject 1, subject 5 subject 9 subject12 subject 4..."
      if (activeRules.enablePaperRotationalFlow && period > 1 && !assignment) {
        const prevRotRoomIndex = roomIndex === 1 ? classrooms.length : roomIndex - 1;
        const prevRotSlot = generatedSlots.find(
          (s) => s.period === period - 1 && classroomIndexMap.get(s.roomId) === prevRotRoomIndex
        );

        if (prevRotSlot) {
          const rotPaperId = prevRotSlot.paperId;
          const rotPaper = paperMap.get(rotPaperId);

          const satisfiesRoomConstraints = canPaperBeScheduledInRoom(rotPaperId, room.id, period, lastPaperIdInRoom);
          const canFitPriority = !isPlannedPeriodPriority || rotPaperId === plan[period - 1].id;

          if (rotPaper && satisfiesRoomConstraints && canFitPriority && canTeachInPeriod(rotPaper, busyTeachersInPeriod, room, period)) {
            chosenPaper = rotPaper;

            // Check if teacher from previous period can continue with paper (must respect building binding!)
            const prevTeacher = teacherMap.get(prevRotSlot.teacherId);
            const prevLoad = teacherDailyLoad.get(prevRotSlot.teacherId) || 0;
            const notAheadInWorkload =
              !activeRules.enableWorkloadEqualization ||
              getTeacherTotalLoad(prevRotSlot.teacherId) <= getAcademyAverageLoad() + 1.5;
            const prevTeacherCanContinue =
              prevTeacher &&
              availableTeacherIds.has(prevTeacher.id) &&
              (!activeRules.enableZeroDoubleBooking || !busyTeachersInPeriod.has(prevTeacher.id)) &&
              isTeacherAllowedInRoomBuilding(prevTeacher, roomBuilding) &&
              !hasBuildingChangeConflict(prevTeacher.id, period, roomBuilding) &&
              prevLoad < (prevTeacher.maxDailyPeriods || 4) &&
              (!activeRules.enableDailyWorkloadSoftCap || prevLoad < 3) &&
              notAheadInWorkload &&
              (prevTeacher.primaryPaperIds.includes(rotPaperId) || (prevTeacher.backupPaperIds || []).includes(rotPaperId));

            if (prevTeacherCanContinue) {
              const isPrimary = prevTeacher.primaryPaperIds.includes(rotPaperId);
              assignment = {
                teacherId: prevTeacher.id,
                isSubstitute: !isPrimary,
                originalTeacherId: isPrimary ? undefined : rotPaper.primaryTeacherIds[0],
                substituteReason: isPrimary ? undefined : 'Rotational paper flow continuity',
              };
            } else {
              // Assign next qualified teacher for this paper (building-bound & floating aware)
              assignment = assignTeacherForPaperInPeriod(chosenPaper, period, busyTeachersInPeriod, room, lastPaperIdInRoom);
            }
          }
        }
      }

      // C. Day-to-Day start in Period 1:
      if (activeRules.enableDayToDayProgression && period === 1 && !assignment) {
        const dayCandidates = availableTeachers.filter((t) => {
          if (busyTeachersInPeriod.has(t.id)) return false;
          if (!isTeacherAllowedInRoomBuilding(t, roomBuilding)) return false;
          const target = teacherTargetRoomIndex.get(t.id) || 1;
          if (target !== roomIndex) return false;
          const prefPaperId = teacherPreferredPaper.get(t.id) || t.primaryPaperIds[0] || 'P01';
          if (!canPaperBeScheduledInRoom(prefPaperId, room.id, period, lastPaperIdInRoom)) return false;
          const canFitPriority = !isPlannedPeriodPriority || prefPaperId === plan[period - 1].id;
          return canFitPriority;
        });

        if (dayCandidates.length > 0) {
          const dayCandidate = sortCandidatesByProgressionAndLoad(dayCandidates, roomIndex, false)[0];
          const prefPaperId = teacherPreferredPaper.get(dayCandidate.id) || dayCandidate.primaryPaperIds[0] || 'P01';
          const p = paperMap.get(prefPaperId);
          if (p) {
            const isPrimary = dayCandidate.primaryPaperIds.includes(prefPaperId);
            chosenPaper = p;
            assignment = {
              teacherId: dayCandidate.id,
              isSubstitute: !isPrimary,
              originalTeacherId: isPrimary ? undefined : p.primaryTeacherIds[0],
              substituteReason: isPrimary ? undefined : 'Subject rotation continued across days',
            };
          }
        }
      }

      // If no incoming rotation was applicable, use standard planned paper & candidate assignment
      if (!chosenPaper || !assignment) {
        let pCandidate = plan[period - 1];

        const satisfiesAllRoomConstraints =
          canPaperBeScheduledInRoom(pCandidate.id, room.id, period, lastPaperIdInRoom) &&
          canTeachInPeriod(pCandidate, busyTeachersInPeriod, room, period);

        if (!satisfiesAllRoomConstraints) {
          let swapped = false;
          for (let futureIdx = period; futureIdx < 5; futureIdx++) {
            const candidatePaper = plan[futureIdx];
            if (
              canPaperBeScheduledInRoom(candidatePaper.id, room.id, period, lastPaperIdInRoom) &&
              canTeachInPeriod(candidatePaper, busyTeachersInPeriod, room, period)
            ) {
              plan[futureIdx] = pCandidate;
              plan[period - 1] = candidatePaper;
              pCandidate = candidatePaper;
              swapped = true;
              break;
            }
          }

          if (!swapped) {
            pCandidate = pickBestPaperForRoom(room.id, period, busyTeachersInPeriod, room, lastPaperIdInRoom);
          }
        }

        chosenPaper = pCandidate;
        assignment = assignTeacherForPaperInPeriod(chosenPaper, period, busyTeachersInPeriod, room);
      }

      if ((assignment as any)?.alternatePaperId) {
        const alt = paperMap.get((assignment as any).alternatePaperId);
        if (alt) chosenPaper = alt;
      }

      if (assignment.teacherId) {
        // Mark teacher busy in this period
        busyTeachersInPeriod.add(assignment.teacherId);

        // Increment teacher daily workload
        const currentLoad = teacherDailyLoad.get(assignment.teacherId) || 0;
        teacherDailyLoad.set(assignment.teacherId, currentLoad + 1);

        // Record room & building for teacher to enforce building gap & room progression
        teacherLastSlot.set(assignment.teacherId, {
          period,
          building: roomBuilding,
          roomIndex,
        });

        // User Rule: "fir next period pe room 3 milega" -> advances (roomIndex % 15) + 1
        teacherTargetRoomIndex.set(assignment.teacherId, (roomIndex % classrooms.length) + 1);
        teacherPreferredPaper.set(assignment.teacherId, chosenPaper.id);
      }

      // Record paper in room
      roomCounts.set(chosenPaper.id, (roomCounts.get(chosenPaper.id) || 0) + 1);

      const slot: ClassSlot = {
        id: `slot-${targetDayNumber}-${room.id}-P${period}`,
        roomId: room.id,
        period,
        paperId: chosenPaper.id,
        teacherId: assignment.teacherId || '',
        isSubstitute: assignment.isSubstitute,
        originalTeacherId: assignment.originalTeacherId,
        substituteReason: assignment.substituteReason,
        isPriority: roomPrioIds.includes(chosenPaper.id),
      };

      generatedSlots.push(slot);
    }
  }

  // -------------------------------------------------------------------------------------
  // Post-Generation Priority Guarantee Pass (USER RULE: enableGuaranteedPriorityPeriods)
  // "new rule add karo. wo priority ka h.. agar routine creation me kisi subject k upar
  // priority lagakar create karta hu.. to.. jitne minimum period dene h.. wo dena hoga..
  // utilising.. remaining all rules"
  // -------------------------------------------------------------------------------------
  if (activeRules.enableGuaranteedPriorityPeriods) {
    const priorityTargets = new Map<string, number>();
    for (const p of schedulingPapers) {
      const minP = getGuaranteedMinPeriods(p.id);
      if (minP > 0) {
        priorityTargets.set(p.id, minP);
      }
    }

    const sortedPriorityPids = Array.from(priorityTargets.keys()).sort(
      (a, b) => (priorityTargets.get(b) || 0) - (priorityTargets.get(a) || 0)
    );

    for (const prioPid of sortedPriorityPids) {
      const targetMin = priorityTargets.get(prioPid) || 0;
      let currentSlots = generatedSlots.filter((s) => s.paperId === prioPid);
      if (currentSlots.length >= targetMin) continue;

      const prioPaper = paperMap.get(prioPid);
      if (!prioPaper) continue;

      let deficit = targetMin - currentSlots.length;

      // Candidate slots currently occupied by non-priority papers or priority papers with surplus
      const candidateSlots = generatedSlots
        .filter((s) => {
          if (s.paperId === prioPid) return false;
          // Protect room quota: strictly exclude rooms where prioPid has reached 100% target quota
          if (isPaperRoomQuotaCompleted(s.roomId, prioPid)) return false;
          // Protect other priority papers that are at or below their guaranteed minimum
          const otherMin = priorityTargets.get(s.paperId) || 0;
          if (otherMin > 0) {
            const countOfOther = generatedSlots.filter((x) => x.paperId === s.paperId).length;
            if (countOfOther <= otherMin) return false;
          }
          // Check room frequency cap & Moto (II) constraints for prioPid
          const countInRoom = generatedSlots.filter(
            (x) => x.roomId === s.roomId && x.paperId === prioPid
          ).length;
          if (activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && countInRoom >= 1) return false;
          if (activeRules.enableMaxRoomDailyLimit && countInRoom >= 2) return false;

          // Moto (II): Strictly never consecutive in the same room
          if (activeRules.enableNonConsecutiveGapForSameSubject) {
            const prevPeriodSlot = generatedSlots.find((x) => x.roomId === s.roomId && x.period === s.period - 1);
            if (prevPeriodSlot && prevPeriodSlot.paperId === prioPid) return false;
            const nextPeriodSlot = generatedSlots.find((x) => x.roomId === s.roomId && x.period === s.period + 1);
            if (nextPeriodSlot && nextPeriodSlot.paperId === prioPid) return false;
          }

          return true;
        })
        .sort((a, b) => {
          // Prefer classrooms that do not have prioPid scheduled yet
          const hasInA = generatedSlots.some((x) => x.roomId === a.roomId && x.paperId === prioPid) ? 1 : 0;
          const hasInB = generatedSlots.some((x) => x.roomId === b.roomId && x.paperId === prioPid) ? 1 : 0;
          if (hasInA !== hasInB) return hasInA - hasInB;
          return a.period - b.period;
        });

      for (const slot of candidateSlots) {
        if (deficit <= 0) break;
        const room = classroomMap.get(slot.roomId);
        if (!room) continue;

        // Dynamic constraint check to prevent duplicate subject in same room if another slot was already updated
        const dynamicRoomCount = generatedSlots.filter((x) => x.roomId === slot.roomId && x.paperId === prioPid).length;
        if (activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && dynamicRoomCount >= 1) continue;
        if (activeRules.enableMaxRoomDailyLimit && dynamicRoomCount >= 2) continue;
        if (activeRules.enableNonConsecutiveGapForSameSubject) {
          const prevPeriodSlot = generatedSlots.find((x) => x.roomId === slot.roomId && x.period === slot.period - 1);
          if (prevPeriodSlot && prevPeriodSlot.paperId === prioPid) continue;
          const nextPeriodSlot = generatedSlots.find((x) => x.roomId === slot.roomId && x.period === slot.period + 1);
          if (nextPeriodSlot && nextPeriodSlot.paperId === prioPid) continue;
        }

        // Option 1: Can the instructor already assigned to this slot teach prioPid?
        const currTeacher = teacherMap.get(slot.teacherId);
        const currTeacherCanTeach =
          currTeacher &&
          (currTeacher.primaryPaperIds.includes(prioPid) ||
            (currTeacher.backupPaperIds || []).includes(prioPid) ||
            (currTeacher.crossSubjectBackupPaperIds || []).includes(prioPid) ||
            (currTeacher.secondaryPaperIds || []).includes(prioPid) ||
            prioPid === 'P13');

        if (currTeacherCanTeach) {
          slot.paperId = prioPid;
          slot.isSubstitute = !currTeacher.primaryPaperIds.includes(prioPid);
          slot.originalTeacherId = currTeacher.primaryPaperIds.includes(prioPid)
            ? undefined
            : prioPaper.primaryTeacherIds[0];
          slot.substituteReason = slot.isSubstitute
            ? 'Guaranteed priority minimum periods fulfillment'
            : undefined;
          slot.isPriority = true;
          deficit--;
          continue;
        }

        // Option 2: Find a qualified instructor free in slot.period without double-booking or transit conflict
        const busyInPeriod = new Set(
          generatedSlots
            .filter((s) => s.period === slot.period && s.id !== slot.id)
            .map((s) => s.teacherId)
        );

        const qualifiedFreeTeachers = availableTeachers.filter((t) => {
          if (busyInPeriod.has(t.id)) return false;
          if (!isTeacherAllowedInRoomBuilding(t, room.building)) return false;

          // Enforce 1-period building change transit gap
          if (activeRules.enableBuildingChangeGap) {
            const prevSlot = generatedSlots.find(
              (s) => s.period === slot.period - 1 && s.teacherId === t.id
            );
            if (prevSlot) {
              const prevRoom = classroomMap.get(prevSlot.roomId);
              if (prevRoom && prevRoom.building !== room.building) return false;
            }
            const nextSlot = generatedSlots.find(
              (s) => s.period === slot.period + 1 && s.teacherId === t.id
            );
            if (nextSlot) {
              const nextRoom = classroomMap.get(nextSlot.roomId);
              if (nextRoom && nextRoom.building !== room.building) return false;
            }
          }

          // Enforce daily load limit
          const currentLoad = generatedSlots.filter(
            (s) => s.teacherId === t.id && s.id !== slot.id
          ).length;
          if (currentLoad >= (t.maxDailyPeriods || 4)) return false;
          if (activeRules.enableDailyWorkloadSoftCap && currentLoad >= 3) return false;

          // Qualifications check
          if (t.primaryPaperIds.includes(prioPid)) return true;
          if (activeRules.enableDesignatedBackup && (t.backupPaperIds || []).includes(prioPid)) return true;
          const crossCfg = CROSS_SUBJECT_BACKUP_MAP[prioPid];
          if (activeRules.enableCrossMutualBackup && crossCfg && crossCfg.backupPaperIds.some((bpid) => t.primaryPaperIds.includes(bpid))) return true;
          if (prioPaper.nearestPaperIds.some((nid) => t.primaryPaperIds.includes(nid))) return true;
          if ((t.secondaryPaperIds || []).includes(prioPid)) return true;
          if (prioPid === 'P13') return true;
          return false;
        });

        if (qualifiedFreeTeachers.length > 0) {
          // Sort qualified instructors: primary first, backup second, lowest workload third
          qualifiedFreeTeachers.sort((a, b) => {
            const aPrim = a.primaryPaperIds.includes(prioPid) ? 1 : 0;
            const bPrim = b.primaryPaperIds.includes(prioPid) ? 1 : 0;
            if (aPrim !== bPrim) return bPrim - aPrim;
            const aBack = (a.backupPaperIds || []).includes(prioPid) ? 1 : 0;
            const bBack = (b.backupPaperIds || []).includes(prioPid) ? 1 : 0;
            if (aBack !== bBack) return bBack - aBack;
            const loadA = generatedSlots.filter((s) => s.teacherId === a.id).length;
            const loadB = generatedSlots.filter((s) => s.teacherId === b.id).length;
            return loadA - loadB;
          });

          const chosenTeacher = qualifiedFreeTeachers[0];
          const isPrimary = chosenTeacher.primaryPaperIds.includes(prioPid);
          slot.paperId = prioPid;
          slot.teacherId = chosenTeacher.id;
          slot.isSubstitute = !isPrimary;
          slot.originalTeacherId = isPrimary ? undefined : prioPaper.primaryTeacherIds[0];
          slot.substituteReason = isPrimary ? undefined : 'Guaranteed priority minimum periods fulfillment';
          slot.isPriority = true;
          deficit--;
        }
      }
    }
  }

  const now = new Date().toISOString();

  return {
    id: `routine-day-${targetDayNumber}`,
    dayNumber: targetDayNumber,
    date: targetDate,
    absentTeacherIds,
    priorityPaperIds,
    roomPriorityPaperIds: resolvedRoomPriorityMap,
    subjectPriorityTiers,
    prioritySubjectMinPeriods,
    excludedPaperIds: Array.from(combinedExcludedSet),
    slots: generatedSlots,
    createdAt: now,
    updatedAt: now,
    isLocked: false, // current routine starts unlocked!
    status: 'published',
    notes:
      notes ||
      `Day ${targetDayNumber} Indoor Routine generated with 15 classrooms & ${availableTeachers.length} active instructors`,
  };
}
