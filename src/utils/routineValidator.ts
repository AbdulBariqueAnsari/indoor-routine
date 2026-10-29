/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClassSlot, ConflictInfo, DailyRoutine, Teacher, Classroom, Paper, RoutineRuleConfig } from '../types/index.ts';
import { normalizeRuleConfig } from '../data/initialData.ts';

export interface BuildingConflictInfo {
  period: number;
  teacherId: string;
  teacherName: string;
  fromPeriod: number;
  fromRoomId: string;
  fromRoomName: string;
  fromBuilding: string;
  toPeriod: number;
  toRoomId: string;
  toRoomName: string;
  toBuilding: string;
}

export interface BuildingBindingViolation {
  teacherId: string;
  teacherName: string;
  roomId: string;
  roomName: string;
  roomBuilding: string;
  teacherBuilding: string;
  period: number;
}

export interface RoomSubjectViolation {
  roomId: string;
  roomName: string;
  paperId: string;
  count: number;
  violationType: 'RULE_6_SINGLE_PERIOD' | 'RULE_6A_MAX_TWO_PERIODS' | 'RULE_6B_CONSECUTIVE';
  periods: number[];
  details: string;
}

export interface TeacherMaxLoadViolation {
  teacherId: string;
  teacherName: string;
  dailyPeriods: number;
  maxCap: number;
}

export interface ValidationResult {
  isValid: boolean;
  tier1Passed: boolean;
  conflicts: ConflictInfo[];
  buildingConflicts: BuildingConflictInfo[];
  absentViolations: { teacherId: string; teacherName: string; period: number; roomId: string }[];
  buildingBindingViolations: BuildingBindingViolation[];
  roomSubjectViolations: RoomSubjectViolation[];
  teacherMaxLoadViolations: TeacherMaxLoadViolation[];
  missingSlotsCount: number;
  totalSlots: number;
  errorMessages: string[];
}

/**
 * Validates a daily routine against all Tier 1 Inviolable Operational Constraints
 * and active system rules:
 * - Rule 1: Zero Double-Booking
 * - Rule 2: Strict Absentee Exclusion
 * - Rule 3: Strict Building Binding (Old strictly in OB, New in NB, Floating in both)
 * - Rule 4: Mandatory 1-Period Gap on Floating Campus Transit
 * - Rule 6: Single Period per Subject per Room per Day
 * - Rule 6A: Maximum Two Periods per Subject per Class/Room per Day (when Rule 6 is OFF)
 * - Rule 6B: Prevent Consecutive Periods of the Same Subject (when Rule 6 is OFF & 6A is ON)
 * - Rule 7: Strict Hard-Cap: Max 4 Periods/Day per Instructor
 */
export function validateRoutine(
  slots: ClassSlot[],
  teachers: Teacher[],
  classrooms: Classroom[],
  absentTeacherIds: string[] = [],
  rules?: Partial<RoutineRuleConfig>,
  papers?: Paper[],
  expectedTotalSlots?: number
): ValidationResult {
  const activeRules: RoutineRuleConfig = normalizeRuleConfig(rules);
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const roomMap = new Map(classrooms.map((r) => [r.id, r]));
  const paperMap = papers ? new Map(papers.map((p) => [p.id, p])) : undefined;

  const conflicts: ConflictInfo[] = [];
  const buildingConflicts: BuildingConflictInfo[] = [];
  const absentViolations: { teacherId: string; teacherName: string; period: number; roomId: string }[] = [];
  const buildingBindingViolations: BuildingBindingViolation[] = [];
  const roomSubjectViolations: RoomSubjectViolation[] = [];
  const teacherMaxLoadViolations: TeacherMaxLoadViolation[] = [];
  const errorMessages: string[] = [];

  const requiredSlots = expectedTotalSlots ?? classrooms.length * 5;

  // 1. Check Period-by-Period constraints (Rule 1: Double-Booking, Rule 2: Absentee, Rule 3: Building Binding)
  for (let period = 1; period <= 5; period++) {
    const periodSlots = slots.filter((s) => s.period === period);
    const teacherToRooms = new Map<string, string[]>();

    for (const slot of periodSlots) {
      if (!slot.teacherId) continue;
      const t = teacherMap.get(slot.teacherId);
      const r = roomMap.get(slot.roomId);

      // Rule 2: Strict Absentee Exclusion
      if (activeRules.enableStrictAbsenteeExclusion && absentTeacherIds.includes(slot.teacherId)) {
        absentViolations.push({
          teacherId: slot.teacherId,
          teacherName: t?.name || slot.teacherId,
          period,
          roomId: slot.roomId,
        });
      }

      // Rule 3: Strict Building Binding (Old strictly in OB, New strictly in NB; only Floating can cross)
      if (activeRules.enableStrictBuildingBinding && t && r) {
        if (t.assignedBuilding !== 'FLOATING' && t.assignedBuilding !== r.building) {
          buildingBindingViolations.push({
            teacherId: t.id,
            teacherName: t.name,
            roomId: r.id,
            roomName: r.name,
            roomBuilding: r.building,
            teacherBuilding: t.assignedBuilding,
            period,
          });
        }
      }

      // Rule 1: Zero Double Booking
      const currentRooms = teacherToRooms.get(slot.teacherId) || [];
      currentRooms.push(slot.roomId);
      teacherToRooms.set(slot.teacherId, currentRooms);
    }

    if (activeRules.enableZeroDoubleBooking) {
      for (const [teacherId, roomIds] of teacherToRooms.entries()) {
        if (roomIds.length > 1) {
          conflicts.push({
            period,
            teacherId,
            teacherName: teacherMap.get(teacherId)?.name || teacherId,
            roomIds,
            roomNames: roomIds.map((rid) => roomMap.get(rid)?.name || rid),
          });
        }
      }
    }
  }

  // 2. Rule 4: Mandatory 1-Period Gap on Floating Campus Transit (OLD <-> NEW)
  if (activeRules.enableBuildingChangeGap) {
    for (const teacher of teachers) {
      const teacherSlots = slots
        .filter((s) => s.teacherId === teacher.id)
        .sort((a, b) => a.period - b.period);

      for (let i = 0; i < teacherSlots.length - 1; i++) {
        const current = teacherSlots[i];
        const next = teacherSlots[i + 1];

        if (next.period === current.period + 1) {
          const currentRoom = roomMap.get(current.roomId);
          const nextRoom = roomMap.get(next.roomId);

          if (currentRoom && nextRoom && currentRoom.building !== nextRoom.building) {
            buildingConflicts.push({
              period: next.period,
              teacherId: teacher.id,
              teacherName: teacherMap.get(teacher.id)?.name || teacher.name || teacher.id,
              fromPeriod: current.period,
              fromRoomId: current.roomId,
              fromRoomName: currentRoom.name,
              fromBuilding: currentRoom.building,
              toPeriod: next.period,
              toRoomId: next.roomId,
              toRoomName: nextRoom.name,
              toBuilding: nextRoom.building,
            });
          }
        }
      }
    }
  }

  // 3. Rules 6, 6A, 6B: Room Subject Repetition and Consecutive Constraints
  for (const classroom of classrooms) {
    const roomSlots = slots
      .filter((s) => s.roomId === classroom.id)
      .sort((a, b) => a.period - b.period);

    // Group by paper
    const paperToPeriods = new Map<string, number[]>();
    for (const s of roomSlots) {
      if (!s.paperId) continue;
      const pList = paperToPeriods.get(s.paperId) || [];
      pList.push(s.period);
      paperToPeriods.set(s.paperId, pList);
    }

    for (const [paperId, periods] of paperToPeriods.entries()) {
      const pName = paperMap?.get(paperId)?.title || paperId;

      // Rule 6: Max 1 period per subject per room daily
      if (activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && periods.length > 1) {
        roomSubjectViolations.push({
          roomId: classroom.id,
          roomName: classroom.name,
          paperId,
          count: periods.length,
          violationType: 'RULE_6_SINGLE_PERIOD',
          periods,
          details: `Subject ${pName} scheduled ${periods.length} times in ${classroom.name} (Rule 6 restricts to max 1 period/room/day)`,
        });
      }

      // Rule 6A: Max 2 periods per subject per class/room daily (when Rule 6 is OFF)
      if (!activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && activeRules.enableMaxRoomDailyLimit && periods.length > 2) {
        roomSubjectViolations.push({
          roomId: classroom.id,
          roomName: classroom.name,
          paperId,
          count: periods.length,
          violationType: 'RULE_6A_MAX_TWO_PERIODS',
          periods,
          details: `Subject ${pName} scheduled ${periods.length} times in ${classroom.name} (Rule 6A restricts to max 2 periods/room/day)`,
        });
      }

      // Rule 6B: Prevent Consecutive Periods of the Same Subject (when Rule 6 is OFF & 6A is ON)
      if (
        !activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily &&
        activeRules.enableMaxRoomDailyLimit &&
        activeRules.enableNonConsecutiveGapForSameSubject &&
        periods.length >= 2
      ) {
        for (let idx = 0; idx < periods.length - 1; idx++) {
          if (periods[idx + 1] === periods[idx] + 1) {
            roomSubjectViolations.push({
              roomId: classroom.id,
              roomName: classroom.name,
              paperId,
              count: periods.length,
              violationType: 'RULE_6B_CONSECUTIVE',
              periods: [periods[idx], periods[idx + 1]],
              details: `Subject ${pName} scheduled in consecutive periods (Period ${periods[idx]} and ${periods[idx + 1]}) in ${classroom.name} (Rule 6B requires non-consecutive gap)`,
            });
          }
        }
      }
    }
  }

  // 4. Rule 7: Strict Hard-Cap: Max 4 Periods/Day per Instructor
  if (activeRules.enableDailyWorkloadMaxCap) {
    for (const teacher of teachers) {
      const dailySlots = slots.filter((s) => s.teacherId === teacher.id);
      const maxCap = Math.min(4, teacher.maxDailyPeriods || 4);
      if (dailySlots.length > maxCap) {
        teacherMaxLoadViolations.push({
          teacherId: teacher.id,
          teacherName: teacher.name,
          dailyPeriods: dailySlots.length,
          maxCap,
        });
      }
    }
  }

  // Build error messages
  if (conflicts.length > 0) {
    errorMessages.push(`Rule 1 Violation: ${conflicts.length} teacher double-booking conflict(s) detected.`);
  }
  if (absentViolations.length > 0) {
    errorMessages.push(`Rule 2 Violation: ${absentViolations.length} unavailable teacher assignment(s) detected.`);
  }
  if (buildingBindingViolations.length > 0) {
    errorMessages.push(`Rule 3 Violation: ${buildingBindingViolations.length} building-binding violation(s) detected.`);
  }
  if (buildingConflicts.length > 0) {
    errorMessages.push(`Rule 4 Violation: ${buildingConflicts.length} building transit gap conflict(s) detected.`);
  }
  if (roomSubjectViolations.length > 0) {
    errorMessages.push(`Rule 6/6A/6B Violation: ${roomSubjectViolations.length} classroom subject frequency/gap violation(s) detected.`);
  }
  if (teacherMaxLoadViolations.length > 0) {
    errorMessages.push(`Rule 7 Violation: ${teacherMaxLoadViolations.length} instructor(s) exceed the 4 periods/day hard cap.`);
  }

  const tier1Passed =
    conflicts.length === 0 &&
    absentViolations.length === 0 &&
    buildingBindingViolations.length === 0 &&
    buildingConflicts.length === 0 &&
    roomSubjectViolations.length === 0 &&
    teacherMaxLoadViolations.length === 0;

  const missingSlotsCount = Math.max(0, requiredSlots - slots.length);
  const isValid = tier1Passed && missingSlotsCount === 0;

  return {
    isValid,
    tier1Passed,
    conflicts,
    buildingConflicts,
    absentViolations,
    buildingBindingViolations,
    roomSubjectViolations,
    teacherMaxLoadViolations,
    missingSlotsCount,
    totalSlots: slots.length,
    errorMessages,
  };
}

/**
 * Validates a single proposed slot assignment against all Tier 1 Hard Constraints.
 * Returns isValid = true if assignment does not violate any applicable Tier 1 rule.
 */
export function validateSlotAssignmentTier1(
  proposed: { roomId: string; period: number; paperId: string; teacherId?: string },
  existingSlots: ClassSlot[],
  teachers: Teacher[],
  classrooms: Classroom[],
  rules: Partial<RoutineRuleConfig> = {},
  absentTeacherIds: string[] = []
): { isValid: boolean; reason?: string } {
  const activeRules = normalizeRuleConfig(rules);
  const teacher = proposed.teacherId ? teachers.find((t) => t.id === proposed.teacherId) : undefined;
  const room = classrooms.find((r) => r.id === proposed.roomId);

  // If teacher is assigned, check teacher constraints:
  if (proposed.teacherId && teacher) {
    // Rule 2: Strict Absentee Exclusion
    if (activeRules.enableStrictAbsenteeExclusion && absentTeacherIds.includes(proposed.teacherId)) {
      return { isValid: false, reason: `Teacher ${teacher.name} is marked unavailable today` };
    }

    // Rule 1: Zero Double Booking
    if (activeRules.enableZeroDoubleBooking) {
      const alreadyTeachingInPeriod = existingSlots.some(
        (s) => s.period === proposed.period && s.teacherId === proposed.teacherId && s.roomId !== proposed.roomId
      );
      if (alreadyTeachingInPeriod) {
        return { isValid: false, reason: `Teacher ${teacher.name} is already assigned in Period ${proposed.period}` };
      }
    }

    // Rule 3: Strict Building Binding
    if (activeRules.enableStrictBuildingBinding && room) {
      if (teacher.assignedBuilding !== 'FLOATING' && teacher.assignedBuilding !== room.building) {
        return {
          isValid: false,
          reason: `Teacher ${teacher.name} (${teacher.assignedBuilding}) is strictly bound and cannot teach in ${room.building} building`,
        };
      }
    }

    // Rule 4: Mandatory 1-Period Gap on Campus Transit
    if (activeRules.enableBuildingChangeGap && room) {
      // Check immediately preceding period
      const prevSlot = existingSlots.find((s) => s.period === proposed.period - 1 && s.teacherId === proposed.teacherId);
      if (prevSlot) {
        const prevRoom = classrooms.find((r) => r.id === prevSlot.roomId);
        if (prevRoom && prevRoom.building !== room.building) {
          return { isValid: false, reason: `Transit gap violation: Teacher ${teacher.name} requires 1 period gap between buildings` };
        }
      }
      // Check immediately succeeding period
      const nextSlot = existingSlots.find((s) => s.period === proposed.period + 1 && s.teacherId === proposed.teacherId);
      if (nextSlot) {
        const nextRoom = classrooms.find((r) => r.id === nextSlot.roomId);
        if (nextRoom && nextRoom.building !== room.building) {
          return { isValid: false, reason: `Transit gap violation: Teacher ${teacher.name} requires 1 period gap between buildings` };
        }
      }
    }

    // Rule 7: Strict Hard Cap (Max 4 periods/day)
    if (activeRules.enableDailyWorkloadMaxCap) {
      const otherSlotsTaughtToday = existingSlots.filter(
        (s) => s.teacherId === proposed.teacherId && !(s.roomId === proposed.roomId && s.period === proposed.period)
      ).length;
      const maxCap = Math.min(4, teacher.maxDailyPeriods || 4);
      if (otherSlotsTaughtToday >= maxCap) {
        return { isValid: false, reason: `Teacher ${teacher.name} has reached the daily limit of ${maxCap} periods` };
      }
    }
  }

  // Room subject constraints (Rules 6, 6A, 6B)
  const roomSlotsForSubject = existingSlots.filter(
    (s) => s.roomId === proposed.roomId && s.paperId === proposed.paperId && s.period !== proposed.period
  );

  // Rule 6: Max 1 period per subject per room daily
  if (activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && roomSlotsForSubject.length >= 1) {
    return { isValid: false, reason: `Rule 6: Paper already scheduled in room ${proposed.roomId} today (max 1 allowed)` };
  }

  // Rule 6A: Max 2 periods per subject per class/room daily
  if (!activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily && activeRules.enableMaxRoomDailyLimit && roomSlotsForSubject.length >= 2) {
    return { isValid: false, reason: `Rule 6A: Paper already scheduled 2 times in room ${proposed.roomId} today (max 2 allowed)` };
  }

  // Rule 6B: Non-consecutive gap
  if (
    !activeRules.enableMaxOnePeriodPerSubjectPerRoomDaily &&
    activeRules.enableMaxRoomDailyLimit &&
    activeRules.enableNonConsecutiveGapForSameSubject &&
    roomSlotsForSubject.length >= 1
  ) {
    const isAdjacent = roomSlotsForSubject.some(
      (s) => s.period === proposed.period - 1 || s.period === proposed.period + 1
    );
    if (isAdjacent) {
      return { isValid: false, reason: `Rule 6B: Consecutive periods for same subject prohibited in room ${proposed.roomId}` };
    }
  }

  return { isValid: true };
}

/**
 * Check if a specific routine is editable.
 * A routine is in editable mode when unlocked (!routine.isLocked).
 * Locked routines are non-editable (published/read-only).
 */
export function isRoutineEditable(routine: DailyRoutine, _allRoutines?: DailyRoutine[]): boolean {
  if (!routine) return false;
  return !routine.isLocked;
}
