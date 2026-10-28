/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClassSlot, ConflictInfo, DailyRoutine, Teacher, Classroom } from '../types';

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

export interface ValidationResult {
  isValid: boolean;
  conflicts: ConflictInfo[];
  buildingConflicts: BuildingConflictInfo[];
  absentViolations: { teacherId: string; teacherName: string; period: number; roomId: string }[];
  missingSlotsCount: number;
  totalSlots: number;
}

/**
 * Validates that no teacher is scheduled in more than one classroom at the same period.
 * Checks if any absent teachers are scheduled.
 * Validates the mandatory 1-period gap when changing buildings (OLD <-> NEW).
 */
export function validateRoutine(
  slots: ClassSlot[],
  teachers: Teacher[],
  classrooms: Classroom[],
  absentTeacherIds: string[] = []
): ValidationResult {
  const teacherMap = new Map(teachers.map(t => [t.id, t]));
  const roomMap = new Map(classrooms.map(r => [r.id, r]));
  const conflicts: ConflictInfo[] = [];
  const buildingConflicts: BuildingConflictInfo[] = [];
  const absentViolations: { teacherId: string; teacherName: string; period: number; roomId: string }[] = [];

  // Group slots by period (1..5)
  for (let period = 1; period <= 5; period++) {
    const periodSlots = slots.filter(s => s.period === period);
    const teacherToRooms = new Map<string, string[]>();

    for (const slot of periodSlots) {
      if (!slot.teacherId) continue;

      // Check absence violation
      if (absentTeacherIds.includes(slot.teacherId)) {
        absentViolations.push({
          teacherId: slot.teacherId,
          teacherName: teacherMap.get(slot.teacherId)?.name || slot.teacherId,
          period,
          roomId: slot.roomId,
        });
      }

      // Check duplicate assignment in same period
      const currentRooms = teacherToRooms.get(slot.teacherId) || [];
      currentRooms.push(slot.roomId);
      teacherToRooms.set(slot.teacherId, currentRooms);
    }

    // Identify conflicts (teacher assigned to 2 or more rooms in the same period)
    for (const [teacherId, roomIds] of teacherToRooms.entries()) {
      if (roomIds.length > 1) {
        conflicts.push({
          period,
          teacherId,
          teacherName: teacherMap.get(teacherId)?.name || teacherId,
          roomIds,
          roomNames: roomIds.map(rid => roomMap.get(rid)?.name || rid),
        });
      }
    }
  }

  // Check building transition gap violations:
  // USER RULE: "building change hone par.. ek period ka gap milega"
  // If a teacher switches between OLD and NEW buildings, they must have at least a 1-period gap.
  // Consecutive periods across different buildings (e.g. Period 1 in OLD, Period 2 in NEW) are strictly prohibited!
  for (const teacher of teachers) {
    const teacherSlots = slots
      .filter((s) => s.teacherId === teacher.id)
      .sort((a, b) => a.period - b.period);

    for (let i = 0; i < teacherSlots.length - 1; i++) {
      const current = teacherSlots[i];
      const next = teacherSlots[i + 1];

      // Consecutive periods
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

  const isValid =
    conflicts.length === 0 &&
    absentViolations.length === 0 &&
    buildingConflicts.length === 0 &&
    slots.length === 75;

  return {
    isValid,
    conflicts,
    buildingConflicts,
    absentViolations,
    missingSlotsCount: Math.max(0, 75 - slots.length),
    totalSlots: slots.length,
  };
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
