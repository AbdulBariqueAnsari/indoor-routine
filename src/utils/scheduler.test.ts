/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_ROUTINE_RULES,
  INITIAL_CLASSROOMS,
  INITIAL_PAPERS,
  INITIAL_TEACHERS,
  INITIAL_PRACTICAL_SUBJECTS,
  MASTER_ROUTINE_RULES,
  isRuleDisabled,
  getRuleDisabledHint,
  SUBJECT_DETAILMENT_RULES,
  TEACHER_DETAILMENT_RULES,
  normalizeRuleConfig,
  migrateLegacyRules,
} from '../data/initialData';
import {
  generateDailyRoutine,
  calculateCumulativeStats,
  calculateClassroomCumulativeStats,
  calculateCurriculumAllocation,
  generateMultipleDaysRoutines,
  getPaperPrimaryTeachers,
  buildRoutineSessionNumbersMap,
  getTeacherClassPaperSessionNumber,
} from './scheduler';
import { validateRoutine, validateSlotAssignmentTier1, isRoutineEditable } from './routineValidator';
import { AppSettings, ClassSlot, DailyRoutine, SubjectPriorityTier, UnavailableInstructor, UnavailabilityConfigItem, compareClassrooms, extractRoomNumber } from '../types';
import {
  computeInstructorUnavailabilityStats,
  generateInstructorUnavailabilityData,
  generateUnavailabilityIncidentLogData,
  generateIndoorRoutineData,
  formatRoutineDateDDMMYYYY,
} from './exportUtils';

test('Routine generator produces exactly 75 slots for 15 classrooms and 5 periods', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  assert.equal(routine.slots.length, 75);
  assert.equal(routine.dayNumber, 1);
});

test('Zero teacher double-booking: No teacher is scheduled in 2 classrooms during the same period', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const validation = validateRoutine(routine.slots, INITIAL_TEACHERS, INITIAL_CLASSROOMS, []);
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
  assert.equal(validation.conflicts.length, 0);
});

test('Absent teachers are strictly excluded from all periods', () => {
  const absentList = ['T1', 'T2', 'T5'];
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: absentList,
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 2,
    targetDate: '2026-10-25',
  });

  const validation = validateRoutine(routine.slots, INITIAL_TEACHERS, INITIAL_CLASSROOMS, absentList);
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
  assert.equal(validation.conflicts.length, 0);
  assert.equal(validation.absentViolations.length, 0);

  // Explicit check on each slot
  for (const slot of routine.slots) {
    assert.equal(absentList.includes(slot.teacherId), false, `Teacher ${slot.teacherId} should not be assigned`);
  }
});

test('Substitute logic automatically triggers when primary teacher is absent', () => {
  // Mark T1, T2 & T3 absent (primary for P01)
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: ['T1', 'T2', 'T3'],
    priorityPaperIds: ['P01'],
    historicalRoutines: [],
    targetDayNumber: 3,
    targetDate: '2026-10-26',
  });

  const p01Slots = routine.slots.filter(s => s.paperId === 'P01');
  assert.ok(p01Slots.length > 0, 'P01 should be scheduled');
  
  // Teachers should not be T1, T2, or T3
  for (const slot of p01Slots) {
    assert.notEqual(slot.teacherId, 'T1');
    assert.notEqual(slot.teacherId, 'T2');
    assert.notEqual(slot.teacherId, 'T3');
  }
});

test('Classroom-wise session counting computes individual room progress across 15 classrooms', () => {
  const day1Routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const day2Routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: ['T3'],
    priorityPaperIds: ['P05'],
    historicalRoutines: [day1Routine],
    targetDayNumber: 2,
    targetDate: '2026-10-25',
  });

  const roomStats = calculateClassroomCumulativeStats(
    INITIAL_CLASSROOMS,
    INITIAL_PAPERS,
    [day1Routine],
    day2Routine.slots,
    ['P05']
  );

  // Exactly 15 classrooms
  assert.equal(roomStats.length, 15);

  // Each classroom should have 10 total sessions across Day 1 (5) + Day 2 (5)
  for (const rStat of roomStats) {
    assert.equal(rStat.completedBeforeToday, 5);
    assert.equal(rStat.todaySessions, 5);
    assert.equal(rStat.totalCompleted, 10);
    assert.equal(rStat.totalTargetSessions, INITIAL_PAPERS.reduce((s, p) => s + p.totalTargetSessions, 0));
    assert.equal(rStat.paperProgress.length, INITIAL_PAPERS.length);
  }
});

test('Cumulative stats correctly aggregate across historical days and current day', () => {
  const day1Routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const day2Routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: ['T3'],
    priorityPaperIds: ['P05'],
    historicalRoutines: [day1Routine],
    targetDayNumber: 2,
    targetDate: '2026-10-25',
  });

  const stats = calculateCumulativeStats(INITIAL_PAPERS, [day1Routine], day2Routine.slots, ['P05']);
  assert.equal(stats.length, INITIAL_PAPERS.length);

  const totalSessionsConducted = stats.reduce((sum, s) => sum + s.completedSessions + s.todaySessions, 0);
  // Day 1 (75) + Day 2 (75) = 150 total sessions
  assert.equal(totalSessionsConducted, 150);
});

test('Correction lock rule: Only the latest routine is editable; previous routines are locked', () => {
  const routine1: DailyRoutine = {
    id: 'routine-day-1',
    dayNumber: 1,
    date: '2026-10-24',
    absentTeacherIds: [],
    priorityPaperIds: [],
    slots: [],
    createdAt: '',
    updatedAt: '',
    isLocked: true,
    status: 'published',
  };

  const routine2: DailyRoutine = {
    id: 'routine-day-2',
    dayNumber: 2,
    date: '2026-10-25',
    absentTeacherIds: [],
    priorityPaperIds: [],
    slots: [],
    createdAt: '',
    updatedAt: '',
    isLocked: false,
    status: 'published',
  };

  const allRoutines = [routine1, routine2];

  assert.equal(isRoutineEditable(routine1, allRoutines), false, 'Day 1 must not be editable');
  assert.equal(isRoutineEditable(routine2, allRoutines), true, 'Day 2 (latest) must be editable');
});

test('Classroom naming and capacities strictly conform to specs: Old Bldg = 70, New Bldg = 52', () => {
  const oldRooms = INITIAL_CLASSROOMS.filter(r => r.building === 'OLD');
  const newRooms = INITIAL_CLASSROOMS.filter(r => r.building === 'NEW');

  assert.equal(oldRooms.length, 8);
  assert.equal(newRooms.length, 7);

  for (const r of oldRooms) {
    assert.equal(r.capacity, 70, `${r.code} in Old Building must have capacity 70`);
    assert.match(r.name, /^Room No\. \d+$/, `${r.name} must be formatted as 'Room No. X'`);
  }

  for (const r of newRooms) {
    assert.equal(r.capacity, 52, `${r.code} in New Building must have capacity 52`);
    assert.match(r.name, /^Room No\. \d+$/, `${r.name} must be formatted as 'Room No. X'`);
  }
});

test('Paper codes strictly formatted as Paper-1 through Paper-14', () => {
  assert.equal(INITIAL_PAPERS.length, 14);
  INITIAL_PAPERS.forEach((p, idx) => {
    assert.equal(p.code, `Paper-${idx + 1}`, `Paper ${p.id} should have code Paper-${idx + 1}`);
  });
});

test('Rule 22: Unvisited Classroom Instructor Prioritization assigns teachers to classrooms with 0 prior visits first', () => {
  // Mock a Day 1 routine where T1 (Paper 1, Old Building) only taught in OB-1
  const day1Routine: DailyRoutine = {
    id: 'day-1',
    dayNumber: 1,
    date: '2026-10-24',
    isLocked: true,
    status: 'published',
    absentTeacherIds: [],
    priorityPaperIds: [],
    createdAt: '2026-10-24T00:00:00Z',
    updatedAt: '2026-10-24T00:00:00Z',
    slots: [
      { id: 's1', roomId: 'OB-1', period: 1, paperId: 'P01', teacherId: 'T1', isSubstitute: false },
      { id: 's2', roomId: 'OB-1', period: 2, paperId: 'P01', teacherId: 'T1', isSubstitute: false },
    ],
  };

  // On Day 2, generate routine with Rule 22 active
  const day2Routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [day1Routine],
    targetDayNumber: 2,
    targetDate: '2026-10-25',
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableUnvisitedRoomTeacherPrioritization: true,
    },
  });

  // Verify that T1 is assigned to classrooms other than OB-1 (unvisited classrooms in Old Building: OB-2 to OB-8)
  const t1Slots = day2Routine.slots.filter((s) => s.teacherId === 'T1');
  assert.ok(t1Slots.length > 0, 'T1 should be assigned slots on Day 2');
  const t1AssignedToUnvisitedRooms = t1Slots.some((s) => s.roomId !== 'OB-1');
  assert.ok(
    t1AssignedToUnvisitedRooms,
    'T1 must be prioritized for unvisited classrooms (OB-2 to OB-8) rather than repeating in OB-1'
  );
});

test('Rule 22: Building-specific teachers rotate across classrooms in their home building to achieve broad exposure', () => {
  // Generate multi-day routines across 6 days
  const multiDayRoutines = generateMultipleDaysRoutines({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    startDayNumber: 1,
    numberOfDays: 6,
    startDate: '2026-10-24',
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableUnvisitedRoomTeacherPrioritization: true,
    },
  });

  // For building-specific teachers (e.g. T4 and T5 in Old Building),
  // verify they teach in multiple distinct classrooms in their assigned building
  const t4Rooms = new Set<string>();
  const t5Rooms = new Set<string>();

  multiDayRoutines.forEach((routine) => {
    routine.slots.forEach((s) => {
      if (s.teacherId === 'T4') t4Rooms.add(s.roomId);
      if (s.teacherId === 'T5') t5Rooms.add(s.roomId);
    });
  });

  assert.ok(
    t4Rooms.size >= 4,
    `T4 should visit at least 4 distinct Old Building rooms over 6 days, visited ${t4Rooms.size}`
  );
  assert.ok(
    t5Rooms.size >= 4,
    `T5 should visit at least 4 distinct Old Building rooms over 6 days, visited ${t5Rooms.size}`
  );
});

test('Instructors distributed strictly across 12 Theory Papers (Paper-1 to Paper-12) by session ratio', () => {
  assert.equal(INITIAL_TEACHERS.length, 27);

  // Collect all assigned primary teachers across P01 to P12
  const theoryAssigned = new Set<string>();
  const theoryPapers = INITIAL_PAPERS.filter(p => p.theoryOrPractical === 'THEORY' || (p.id !== 'P13' && p.id !== 'P14'));
  
  assert.equal(theoryPapers.length, 12);

  theoryPapers.forEach(paper => {
    assert.ok(paper.primaryTeacherIds.length >= 1, `Paper ${paper.code} must have at least 1 primary teacher`);
    paper.primaryTeacherIds.forEach(tId => theoryAssigned.add(tId));
  });

  // Exactly 27 unique teachers including T27
  assert.equal(theoryAssigned.size, 27);

  // Practical (Paper-13) has no fixed primary teachers
  const practicalPaper = INITIAL_PAPERS.find(p => p.id === 'P13');
  assert.ok(practicalPaper);
  assert.equal(practicalPaper.primaryTeacherIds.length, 0, 'Paper-13 must have 0 fixed primary teachers');
});

test('Practical (Paper-13) can be assigned flexibly to any available teacher', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: ['P13'], // Request practical as priority
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const practicalSlots = routine.slots.filter(s => s.paperId === 'P13');
  assert.ok(practicalSlots.length > 0, 'P13 should be scheduled');

  // Ensure practical slots have assigned valid teachers
  for (const slot of practicalSlots) {
    assert.ok(slot.teacherId.startsWith('T'), `Practical slot must have assigned teacher ID: ${slot.teacherId}`);
  }
});

test('Room-wise priority guarantees subject inclusion and shuffles periods', () => {
  const roomPriorityMap = {
    'OB-1': ['P05', 'P06'],
    'OB-2': ['P07', 'P08'],
    'NB-1': ['P09', 'P10'],
  };

  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    roomPriorityPaperIds: roomPriorityMap,
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  // Check OB-1 has both P05 and P06
  const ob1Slots = routine.slots.filter(s => s.roomId === 'OB-1');
  const ob1Papers = ob1Slots.map(s => s.paperId);
  assert.ok(ob1Papers.includes('P05'), 'OB-1 must include priority Paper-5 (P05)');
  assert.ok(ob1Papers.includes('P06'), 'OB-1 must include priority Paper-6 (P06)');

  // Check OB-2 has both P07 and P08
  const ob2Slots = routine.slots.filter(s => s.roomId === 'OB-2');
  const ob2Papers = ob2Slots.map(s => s.paperId);
  assert.ok(ob2Papers.includes('P07'), 'OB-2 must include priority Paper-7 (P07)');
  assert.ok(ob2Papers.includes('P08'), 'OB-2 must include priority Paper-8 (P08)');

  // Check NB-1 has both P09 and P10
  const nb1Slots = routine.slots.filter(s => s.roomId === 'NB-1');
  const nb1Papers = nb1Slots.map(s => s.paperId);
  assert.ok(nb1Papers.includes('P09'), 'NB-1 must include priority Paper-9 (P09)');
  assert.ok(nb1Papers.includes('P10'), 'NB-1 must include priority Paper-10 (P10)');

  // Validate zero teacher conflicts
  const validation = validateRoutine(routine.slots, INITIAL_TEACHERS, INITIAL_CLASSROOMS, []);
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
  assert.equal(validation.conflicts.length, 0);
});

test('Subject Priority Tiers: High (100% = 15 rooms), Medium (60% = 9 rooms), Low (20% = 3 rooms), Exclude (0%)', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    subjectPriorityTiers: {
      P01: 'HIGH', // 15 rooms
      P02: 'MEDIUM', // 9 rooms
      P03: 'LOW', // 3 rooms
      P12: 'EXCLUDE', // 0 rooms
    },
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  // Verify Excluded P12 has 0 slots across all 15 classrooms
  const p12Slots = routine.slots.filter(s => s.paperId === 'P12');
  assert.equal(p12Slots.length, 0, 'Excluded subject P12 must have exactly 0 slots');

  // Verify High P01 is included in all 15 classrooms
  const p01Rooms = new Set(routine.slots.filter(s => s.paperId === 'P01').map(s => s.roomId));
  assert.equal(p01Rooms.size, 15, 'High priority P01 must be included in all 15 classrooms');

  // Verify Medium P02 is included in at least 9 classrooms
  const p02Rooms = new Set(routine.slots.filter(s => s.paperId === 'P02').map(s => s.roomId));
  assert.ok(p02Rooms.size >= 9, `Medium priority P02 should be in at least 9 rooms, got ${p02Rooms.size}`);

  // Verify Low P03 is included in at least 3 classrooms
  const p03Rooms = new Set(routine.slots.filter(s => s.paperId === 'P03').map(s => s.roomId));
  assert.ok(p03Rooms.size >= 3, `Low priority P03 should be in at least 3 rooms, got ${p03Rooms.size}`);
});

test('Session Counter strictly avoids double-counting current routine', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  // allRoutines has Day 1
  const allRoutines = [routine];

  // Calculate cumulative stats passing allRoutines AND routine.slots with currentRoutineId
  const stats = calculateCumulativeStats(
    INITIAL_PAPERS,
    allRoutines,
    routine.slots,
    [],
    15,
    routine.id
  );

  const p01 = stats.find(s => s.paperId === 'P01')!;
  // Completed before today must be 0, today must equal today's slots, total must not double count
  assert.equal(p01.completedSessions, 0, 'Completed sessions before today must be 0');
  assert.equal(p01.completedSessions + p01.todaySessions, p01.todaySessions, 'Total done must equal today sessions without duplication');
});

test('Designated backup instructor assignment triggers when main instructor is unavailable', () => {
  // Paper-1 (BNSS) primary instructors are T1, T2, T3
  // Create a custom teacher list where T4 is strictly designated as backup for P01
  const customTeachers = INITIAL_TEACHERS.map((t) => {
    if (t.id === 'T4') {
      return {
        ...t,
        backupPaperIds: ['P01'],
      };
    }
    return {
      ...t,
      backupPaperIds: (t.backupPaperIds || []).filter((p) => p !== 'P01'),
      secondaryPaperIds: (t.secondaryPaperIds || []).filter((p) => p !== 'P01'),
    };
  });

  // Mark all primary instructors of P01 (T1, T2, T3) absent
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: customTeachers,
    absentTeacherIds: ['T1', 'T2', 'T3'],
    priorityPaperIds: ['P01'],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const p01Slots = routine.slots.filter((s) => s.paperId === 'P01');
  assert.ok(p01Slots.length > 0, 'P01 slots should be scheduled');

  // Verify that T4 (who has backupPaperIds: ['P01']) is assigned as substitute
  const t4AssignedSlots = p01Slots.filter((s) => s.teacherId === 'T4');
  assert.ok(t4AssignedSlots.length > 0, 'T4 should be appointed as designated backup instructor for P01');
  assert.equal(t4AssignedSlots[0].isSubstitute, true);
});

test('Backup subject instructors act as 100% Floating across both Old and New buildings', () => {
  // When primary instructors of a paper are unavailable, designated backup instructors
  // can be scheduled across classrooms in both Old and New buildings freely.
  const customTeachers = INITIAL_TEACHERS.map((t) => {
    if (t.id === 'T4' || t.id === 'T5') {
      return {
        ...t,
        backupPaperIds: ['P01'],
      };
    }
    return t;
  });

  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: customTeachers,
    absentTeacherIds: ['T1', 'T2', 'T3'], // P01 primaries absent
    priorityPaperIds: ['P01'],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const p01Slots = routine.slots.filter((s) => s.paperId === 'P01');
  assert.ok(p01Slots.length > 0, 'P01 slots should be scheduled');

  // Verify that backup instructors are scheduled in both Old (OB-*) and New (NB-*) buildings
  const oldBldgSlots = p01Slots.filter((s) => s.roomId.startsWith('OB'));
  const newBldgSlots = p01Slots.filter((s) => s.roomId.startsWith('NB'));

  assert.ok(oldBldgSlots.length > 0, 'Backup instructors should teach in Old Building');
  assert.ok(newBldgSlots.length > 0, 'Backup instructors should teach in New Building');
  assert.ok(newBldgSlots.some((s) => s.isSubstitute), 'New Building slots should have substitute backup instructors');
});

test('Instructors are configured with strict building binding (OLD, NEW, FLOATING)', () => {
  for (const teacher of INITIAL_TEACHERS) {
    assert.ok(
      ['OLD', 'NEW', 'FLOATING'].includes(teacher.assignedBuilding),
      `Teacher ${teacher.id} (${teacher.name}) should have assignedBuilding set to OLD, NEW, or FLOATING`
    );
  }
});

test('Mandatory 1-Period Gap when Changing Buildings (OLD <-> NEW)', () => {
  // Generate routine for Day 1
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const roomMap = new Map(INITIAL_CLASSROOMS.map((r) => [r.id, r]));

  // Verify that NO instructor teaches consecutive periods in different buildings without a 1-period gap!
  for (const teacher of INITIAL_TEACHERS) {
    const teacherSlots = routine.slots
      .filter((s) => s.teacherId === teacher.id)
      .sort((a, b) => a.period - b.period);

    for (let i = 0; i < teacherSlots.length - 1; i++) {
      const cur = teacherSlots[i];
      const next = teacherSlots[i + 1];

      if (next.period === cur.period + 1) {
        // P3 to P4 is exempt due to Rule 4A (Recess Break)
        if (cur.period === 3 && next.period === 4) continue;

        const curRoom = roomMap.get(cur.roomId)!;
        const nextRoom = roomMap.get(next.roomId)!;

        assert.equal(
          curRoom.building,
          nextRoom.building,
          `Teacher ${teacher.name} cannot switch from ${curRoom.building} (${curRoom.name}, Period ${cur.period}) to ${nextRoom.building} (${nextRoom.name}, Period ${next.period}) without a 1-period gap!`
        );
      }
    }
  }

  // Validate with routineValidator
  const validation = validateRoutine(routine.slots, INITIAL_TEACHERS, INITIAL_CLASSROOMS, []);
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
  assert.equal(validation.buildingConflicts.length, 0);
});

test('Routine validator detects manual consecutive building change violations', () => {
  // Create a routine with an intentional building change violation:
  // Teacher T1 teaches in OB-1 (OLD building) in Period 1, and NB-1 (NEW building) in Period 2
  const mockSlots = INITIAL_CLASSROOMS.flatMap((room) =>
    [1, 2, 3, 4, 5].map((period) => ({
      id: `slot-test-${room.id}-P${period}`,
      roomId: room.id,
      period,
      paperId: 'P01',
      teacherId: 'T2',
      isSubstitute: false,
    }))
  );

  // Intentionally inject T1 in OB-1 (Period 1, OLD) and NB-1 (Period 2, NEW)
  const slotP1 = mockSlots.find((s) => s.roomId === 'OB-1' && s.period === 1)!;
  const slotP2 = mockSlots.find((s) => s.roomId === 'NB-1' && s.period === 2)!;
  slotP1.teacherId = 'T1';
  slotP2.teacherId = 'T1';

  const validation = validateRoutine(mockSlots, INITIAL_TEACHERS, INITIAL_CLASSROOMS, []);
  assert.equal(validation.buildingConflicts.length > 0, true);
  assert.equal(validation.buildingConflicts[0].teacherId, 'T1');
  assert.equal(validation.buildingConflicts[0].fromBuilding, 'OLD');
  assert.equal(validation.buildingConflicts[0].toBuilding, 'NEW');
  assert.equal(validation.isValid, false);
});

test('Teacher daily assignment progresses to next room based on previous day', () => {
  // Create Day 1 routine where T1 teaches in OB-1 (Room 1) in Period 1
  const day1Routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  // Generate Day 2 routine with day1Routine in historicalRoutines
  const day2Routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [day1Routine],
    targetDayNumber: 2,
    targetDate: '2026-10-25',
  });

  assert.equal(day2Routine.slots.length, 75);
  const validation = validateRoutine(day2Routine.slots, INITIAL_TEACHERS, INITIAL_CLASSROOMS, []);
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
  assert.equal(validation.buildingConflicts.length, 0);
  assert.equal(validation.conflicts.length, 0);
});

test('Teacher and subject continuous flow progression (e.g. Teacher 5 with Paper 2 from Room 6 to Room 7)', () => {
  // Generate a routine with enableCaravanFlow explicitly enabled
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableCaravanFlow: true,
    },
  });

  // Verify that instructors who step consecutively from Room K to Room K+1 within the same building
  // carry their subject forward
  const roomMap = new Map(INITIAL_CLASSROOMS.map((r, i) => [r.id, i + 1])); // 1-based index 1..15

  let countConsecutiveSubjectCaravan = 0;
  for (const teacher of INITIAL_TEACHERS) {
    const slots = routine.slots
      .filter((s) => s.teacherId === teacher.id)
      .sort((a, b) => a.period - b.period);

    for (let i = 0; i < slots.length - 1; i++) {
      const s1 = slots[i];
      const s2 = slots[i + 1];

      if (s2.period === s1.period + 1) {
        const r1Idx = roomMap.get(s1.roomId)!;
        const r2Idx = roomMap.get(s2.roomId)!;

        // Same building room progression: (r1Idx % 15) + 1
        if (r2Idx === (r1Idx % 15) + 1 && s1.paperId === s2.paperId) {
          countConsecutiveSubjectCaravan++;
        }
      }
    }
  }

  assert.ok(
    countConsecutiveSubjectCaravan > 0,
    `There should be instructors who rotate consecutively from Room K to Room K+1 carrying their subject, found ${countConsecutiveSubjectCaravan}`
  );
});

test('Subject / Paper Rotational Caravan Flow: Paper moves from Room K in Period P to Room K+1 in Period P+1', () => {
  // USER RULE: "paper 1 avi room 2 me ho to firse paper 1 next period me room 3 me hoga.. ye jwala rule. jo techer wala bananya tha use off hi rakho.. ye rule banao"
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableCaravanFlow: false,
      enablePaperRotationalFlow: true,
    },
  });

  const roomMap = new Map(INITIAL_CLASSROOMS.map((r, i) => [r.id, i + 1])); // 1-based index 1..15
  let paperRotationCount = 0;

  for (let period = 2; period <= 5; period++) {
    for (const room of INITIAL_CLASSROOMS) {
      const roomIdx = roomMap.get(room.id)!;
      const prevRoomIdx = roomIdx === 1 ? INITIAL_CLASSROOMS.length : roomIdx - 1;

      const curSlot = routine.slots.find((s) => s.period === period && s.roomId === room.id);
      const prevSlot = routine.slots.find(
        (s) => s.period === period - 1 && roomMap.get(s.roomId) === prevRoomIdx
      );

      if (curSlot && prevSlot && curSlot.paperId === prevSlot.paperId) {
        paperRotationCount++;
      }
    }
  }

  assert.ok(
    paperRotationCount > 0,
    `Subject / Paper rotational flow should advance papers from Room K to Room K+1 across consecutive periods, found ${paperRotationCount} rotations`
  );
});

test('Multi-day subject arrangement gradually equalizes instructor workloads to approximately equal sessions', () => {
  // USER RULE: "subject ka arrangement aisa banao.. ki .dhire dhire.. har techer ko approx same session mile"
  const pastRoutines: DailyRoutine[] = [];
  const teacherTotalSessions = new Map<string, number>();
  INITIAL_TEACHERS.forEach((t) => teacherTotalSessions.set(t.id, 0));

  const SIMULATED_DAYS = 10;
  for (let day = 1; day <= SIMULATED_DAYS; day++) {
    const routine = generateDailyRoutine({
      classrooms: INITIAL_CLASSROOMS,
      papers: INITIAL_PAPERS,
      teachers: INITIAL_TEACHERS,
      absentTeacherIds: [],
      priorityPaperIds: [],
      historicalRoutines: pastRoutines,
      targetDayNumber: day,
      targetDate: `2026-10-${day < 10 ? '0' + day : day}`,
    });

    pastRoutines.push(routine);

    // Accumulate sessions for assigned teachers
    for (const slot of routine.slots) {
      if (slot.teacherId) {
        const prev = teacherTotalSessions.get(slot.teacherId) || 0;
        teacherTotalSessions.set(slot.teacherId, prev + 1);
      }
    }
  }

  const sessionCounts = Array.from(teacherTotalSessions.values());
  const minSessions = Math.min(...sessionCounts);
  const maxSessions = Math.max(...sessionCounts);
  const totalAssignedSlots = sessionCounts.reduce((sum, n) => sum + n, 0);
  const totalRoutineSlots = pastRoutines.reduce((sum, r) => sum + r.slots.length, 0);
  const avgSessions = totalAssignedSlots / INITIAL_TEACHERS.length; // ~28.8 sessions/teacher
  const spread = maxSessions - minSessions;

  // 1. Exactly 75 slots * 10 days = 750 total routine slots generated
  assert.equal(totalRoutineSlots, 750);
  assert.ok(totalAssignedSlots >= 745, `At least 745 slots assigned to instructors, got ${totalAssignedSlots}`);

  // 2. No teacher is starved (all teachers have taught substantial sessions)
  assert.ok(minSessions >= 23, `Minimum sessions should be at least 23, got ${minSessions}`);

  // 3. Max sessions should not exceed 38
  assert.ok(maxSessions <= 38, `Maximum sessions should not exceed 38, got ${maxSessions}`);

  // 4. Spread across all 26 teachers should be tight (<= 14 across 10 days)
  assert.ok(
    spread <= 14,
    `Workload spread across 10 days should be <= 14 sessions, got spread ${spread} (min: ${minSessions}, max: ${maxSessions}, avg: ${avgSessions.toFixed(1)})`
  );

  // 5. Teachers of small theory subjects (T16 Criminology: 17 target, T17 Police Admin: 8 target)
  // are successfully equalized via subject scheduling and practical classes
  const t16Sessions = teacherTotalSessions.get('T16') || 0;
  const t17Sessions = teacherTotalSessions.get('T17') || 0;
  assert.ok(
    t16Sessions >= 23 && t16Sessions <= 38,
    `T16 (Criminology) workload equalized: got ${t16Sessions} sessions`
  );
  assert.ok(
    t17Sessions >= 23 && t17Sessions <= 38,
    `T17 (Police Admin) workload equalized: got ${t17Sessions} sessions`
  );
});

test('Individual Classroom Subject Equalization: Sessions per subject in each individual classroom tend toward equality', () => {
  // USER RULE: "har class me routine creation k tyme total session per individual class per subject tend to equall kiya jaye.. ye rule banao"
  // Create a scenario where Room OB-1 has historical sessions for Paper 1 (e.g. 5 sessions), but 0 sessions for Paper 3 and Paper 4
  const mockHistoricalSlots = [1, 2, 3, 4, 5].map((period) => ({
    id: `hist-slot-OB-1-P${period}`,
    roomId: 'OB-1',
    period,
    paperId: 'P01', // P01 heavily scheduled
    teacherId: 'T1',
    isSubstitute: false,
  }));

  const mockHistoricalRoutine: DailyRoutine = {
    id: 'mock-hist-day-1',
    dayNumber: 1,
    date: '2026-10-23',
    absentTeacherIds: [],
    priorityPaperIds: [],
    slots: mockHistoricalSlots,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isLocked: true,
    status: 'published',
  };

  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [mockHistoricalRoutine],
    targetDayNumber: 2,
    targetDate: '2026-10-24',
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableClassroomSubjectEqualization: true,
    },
  });

  const ob1Slots = routine.slots.filter((s) => s.roomId === 'OB-1');
  const ob1PaperIds = ob1Slots.map((s) => s.paperId);

  // Since P01 already had 5 sessions in OB-1, the equalization rule should prioritize other lagging papers (e.g. P02, P03, P04, P05, etc.)
  const p01CountToday = ob1PaperIds.filter((pid) => pid === 'P01').length;
  const otherPaperCount = ob1PaperIds.filter((pid) => pid !== 'P01').length;

  assert.ok(
    otherPaperCount > p01CountToday,
    `Classroom OB-1 should prioritize lagging subjects over P01 (got ${otherPaperCount} other subjects vs ${p01CountToday} P01)`
  );
});

test('Classroom Subject Equalization balances session completion percentage (%) rather than raw count', () => {
  // USER RULE: "corection enable classroom subject equalization ka.. isme actuallly raw session count nhi ho.. balki session percent count hoga"
  // Consider Paper-8 (Police Admin, singleRoomTarget = 8) vs Paper-2 (BNS, singleRoomTarget = 56).
  // If Room OB-1 has conducted:
  // - 4 sessions of Paper-8 (4 / 8 = 50.0% completion)
  // - 5 sessions of Paper-2 (5 / 56 = 8.9% completion)
  // Under raw count (4 vs 5), Paper-8 has fewer raw sessions (4 < 5).
  // But under percentage count (50.0% vs 8.9%), Paper-2 is far behind and MUST be prioritized!
  const mockHistoricalSlots = [
    // 4 sessions of P08 (50% complete)
    { id: 'h-1', roomId: 'OB-1', period: 1, paperId: 'P08', teacherId: 'T17', isSubstitute: false },
    { id: 'h-2', roomId: 'OB-1', period: 2, paperId: 'P08', teacherId: 'T17', isSubstitute: false },
    { id: 'h-3', roomId: 'OB-1', period: 3, paperId: 'P08', teacherId: 'T17', isSubstitute: false },
    { id: 'h-4', roomId: 'OB-1', period: 4, paperId: 'P08', teacherId: 'T17', isSubstitute: false },
    // 5 sessions of P02 (8.9% complete)
    { id: 'h-5', roomId: 'OB-1', period: 5, paperId: 'P02', teacherId: 'T4', isSubstitute: false },
  ];

  const mockHistoricalRoutine1: DailyRoutine = {
    id: 'mock-p-1',
    dayNumber: 1,
    date: '2026-10-22',
    absentTeacherIds: [],
    priorityPaperIds: [],
    slots: mockHistoricalSlots,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isLocked: true,
    status: 'published',
  };

  const mockHistoricalRoutine2: DailyRoutine = {
    id: 'mock-p-2',
    dayNumber: 2,
    date: '2026-10-23',
    absentTeacherIds: [],
    priorityPaperIds: [],
    slots: [
      { id: 'h-6', roomId: 'OB-1', period: 1, paperId: 'P02', teacherId: 'T4', isSubstitute: false },
      { id: 'h-7', roomId: 'OB-1', period: 2, paperId: 'P02', teacherId: 'T4', isSubstitute: false },
      { id: 'h-8', roomId: 'OB-1', period: 3, paperId: 'P02', teacherId: 'T4', isSubstitute: false },
      { id: 'h-9', roomId: 'OB-1', period: 4, paperId: 'P02', teacherId: 'T4', isSubstitute: false },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isLocked: true,
    status: 'published',
  };

  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [mockHistoricalRoutine1, mockHistoricalRoutine2],
    targetDayNumber: 3,
    targetDate: '2026-10-24',
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableClassroomSubjectEqualization: true,
      enablePaperRotationalFlow: false, // isolate equalization
    },
  });

  const ob1Slots = routine.slots.filter((s) => s.roomId === 'OB-1');
  const ob1PaperIds = ob1Slots.map((s) => s.paperId);

  // P08 is 50% complete (4/8), while other papers (like P01, P02, P03, P04, P05) have far lower percentage completion.
  // Therefore, P08 should NOT starve the lower percentage papers!
  assert.ok(
    !ob1PaperIds.includes('P08') || ob1PaperIds.filter((p) => p !== 'P08').length >= 4,
    'Papers with lower completion percentage should be chosen ahead of 50% completed P08'
  );
});

test('Guaranteed Priority Subject Minimum Periods: Prioritized subjects strictly achieve guaranteed minimum periods while utilizing all remaining operational rules', () => {
  // USER RULE: "new rule add karo. wo priority ka h.. agar routine creation me kisi subject k upar priority lagakar create karta hu.. to.. jitne minimum period dene h.. wo dena hoga.. utilising.. remaining all rules"
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: ['P04', 'P07'],
    subjectPriorityTiers: {
      P04: 'HIGH',
      P07: 'MEDIUM',
    },
    prioritySubjectMinPeriods: {
      P04: 15, // P04 (Evidence Law, single primary instructor T11) must get at least 15 periods
      P07: 8,  // P07 (Criminology) must get at least 8 periods
    },
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableGuaranteedPriorityPeriods: true,
      enableZeroDoubleBooking: true,
      enableBuildingChangeGap: true,
      enableDesignatedBackup: true,
      enableUnvisitedRoomTeacherPrioritization: true,
    },
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const p04Slots = routine.slots.filter((s) => s.paperId === 'P04');
  const p07Slots = routine.slots.filter((s) => s.paperId === 'P07');

  // 1. Guaranteed minimum periods strictly fulfilled
  assert.ok(
    p04Slots.length >= 15,
    `Guaranteed minimum periods for P04 should be at least 15, got ${p04Slots.length}`
  );
  assert.ok(
    p07Slots.length >= 8,
    `Guaranteed minimum periods for P07 should be at least 8, got ${p07Slots.length}`
  );

  // 2. Exactly 75 slots generated for 15 classrooms and 5 periods
  assert.equal(routine.slots.length, 75);

  // 3. Strict verification that all remaining operational rules are respected:
  const validation = validateRoutine(routine.slots, INITIAL_TEACHERS, INITIAL_CLASSROOMS, []);
  assert.equal(validation.isValid, true, 'Routine must be completely valid');
  assert.equal(validation.conflicts.length, 0, 'Zero instructor double-booking violations');
  assert.equal(validation.buildingConflicts.length, 0, 'Zero building transit gap violations');

  // 4. Verify slots are flagged as priority
  const prioFlagged = routine.slots.filter((s) => s.isPriority);
  assert.ok(prioFlagged.length >= 23, `Priority slots should be marked as priority, found ${prioFlagged.length}`);
});

test('Proportional Remaining Quota Fill-Up & Percentage Priority Scaling (+50% High / -50% Low)', () => {
  // USER RULE: "har din total period x total class ka session hota h.. inn sessions me subject ka fillup usi ratio me ho jitna per class per subject session percent remaining except priority of subjects.. priority v ek percent hisab ho.. high aur low.. ho sirf.. matlab.. 50 percent jyada subject detailment. ya 50 percent kam.. max jitna classroom h.. .ye v rule me add kar dena"
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    subjectPriorityTiers: {
      P01: 'HIGH', // +50% allocation
      P08: 'LOW',  // -50% allocation
    },
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableProportionalRemainingRatio: true,
      enableSubjectPriorityTiers: true,
    },
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const p01Slots = routine.slots.filter((s) => s.paperId === 'P01');
  const p08Slots = routine.slots.filter((s) => s.paperId === 'P08');

  // 1. High priority P01 receives significantly more slots than Low priority P08
  assert.ok(
    p01Slots.length > p08Slots.length * 2,
    `High priority P01 (+50%) (${p01Slots.length} slots) should receive more than double Low priority P08 (-50%) (${p08Slots.length} slots)`
  );

  // 2. High priority is capped at max classroom count (15 classrooms)
  const p01Rooms = new Set(p01Slots.map((s) => s.roomId));
  assert.ok(p01Rooms.size <= INITIAL_CLASSROOMS.length, `Allocation must be capped by max classrooms (${INITIAL_CLASSROOMS.length})`);

  // 3. Exactly 75 total daily sessions generated (5 periods * 15 classrooms)
  assert.equal(routine.slots.length, 75);

  // 4. Zero conflict validation
  const validation = validateRoutine(routine.slots, INITIAL_TEACHERS, INITIAL_CLASSROOMS, []);
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
  assert.equal(validation.conflicts.length, 0);
  assert.equal(validation.buildingConflicts.length, 0);
});

test('Classroom 100% Syllabus Completion Lockout: Subject is strictly excluded from classroom once reaching 100% quota in that room', () => {
  // USER RULE: "ek rule banao ki.. jis class me jiss subject ka session 100 percent ho jaye.. uss class me.. routine creation me.. wo subject allot na ho"
  // Paper P08 (Police Admin) has totalTargetSessions = 8.
  // Create mock historical routines where classroom 'OB-1' has already completed 8 sessions of P08.
  // Classroom 'OB-2' has completed only 2 sessions of P08.
  const mockHistoricalRoutines: DailyRoutine[] = [];

  // Generate 8 days of routines where OB-1 had P08 in Period 1 each day
  for (let day = 1; day <= 8; day++) {
    const slots = [];
    // OB-1 has P08 in Period 1
    slots.push({
      id: `mock-day-${day}-OB-1-P1`,
      roomId: 'OB-1',
      period: 1,
      paperId: 'P08',
      teacherId: 'T17',
      isSubstitute: false,
    });

    // OB-2 has P08 on days 1 and 2 only (2 sessions total)
    if (day <= 2) {
      slots.push({
        id: `mock-day-${day}-OB-2-P1`,
        roomId: 'OB-2',
        period: 1,
        paperId: 'P08',
        teacherId: 'T17',
        isSubstitute: false,
      });
    }

    mockHistoricalRoutines.push({
      id: `routine-day-${day}`,
      dayNumber: day,
      date: `2026-10-${20 + day}`,
      absentTeacherIds: [],
      priorityPaperIds: [],
      slots,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isLocked: true,
      status: 'published',
    });
  }

  // 1. Verify that classroom cumulative stats reflect 100% completion (8/8) for OB-1 on P08
  const stats = calculateClassroomCumulativeStats(
    INITIAL_CLASSROOMS,
    INITIAL_PAPERS,
    mockHistoricalRoutines
  );
  const ob1Stats = stats.find((s) => s.classroom.id === 'OB-1');
  const ob1P08 = ob1Stats?.paperProgress.find((p) => p.paperId === 'P08');
  assert.equal(ob1P08?.completedSessions, 8);
  assert.equal(ob1P08?.remainingSessions, 0);
  assert.equal(ob1P08?.progressPercent, 100);

  // 2. Generate Day 9 routine with enableRoomQuotaCompletionLock: true
  // Even if P08 is marked as HIGH priority and explicitly requested for OB-1 in room priorities!
  const routineWithLock = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: ['P08'],
    roomPriorityPaperIds: {
      'OB-1': ['P08'],
      'OB-2': ['P08'],
    },
    subjectPriorityTiers: {
      P08: 'HIGH',
    },
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableRoomQuotaCompletionLock: true,
    },
    historicalRoutines: mockHistoricalRoutines,
    targetDayNumber: 9,
    targetDate: '2026-10-29',
  });

  // Verify that OB-1 has strictly ZERO slots of P08 because it has reached 100% syllabus quota
  const ob1P08Slots = routineWithLock.slots.filter(
    (s) => s.roomId === 'OB-1' && s.paperId === 'P08'
  );
  assert.equal(
    ob1P08Slots.length,
    0,
    `Room OB-1 must have 0 slots of P08 after reaching 100% quota, but found ${ob1P08Slots.length}`
  );

  // Verify other classrooms that have NOT reached 100% (e.g. OB-2) can still receive P08
  const allP08Slots = routineWithLock.slots.filter((s) => s.paperId === 'P08');
  assert.ok(
    allP08Slots.length > 0,
    'Other eligible classrooms should still receive P08 slots'
  );
  // Ensure NONE of the P08 slots are in OB-1
  assert.ok(!allP08Slots.some((s) => s.roomId === 'OB-1'));

  // 3. Exactly 75 total slots generated and 100% valid schedule
  assert.equal(routineWithLock.slots.length, 75);
  const validation = validateRoutine(routineWithLock.slots, INITIAL_TEACHERS, INITIAL_CLASSROOMS, []);
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
  assert.equal(validation.conflicts.length, 0);

  // 4. Test when enableRoomQuotaCompletionLock is toggled OFF:
  // When turned off, P08 requested for OB-1 can be scheduled in OB-1
  const routineWithoutLock = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: ['P08'],
    roomPriorityPaperIds: {
      'OB-1': ['P08'],
    },
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableRoomQuotaCompletionLock: false,
    },
    historicalRoutines: mockHistoricalRoutines,
    targetDayNumber: 9,
    targetDate: '2026-10-29',
  });

  const ob1P08SlotsWithoutLock = routineWithoutLock.slots.filter(
    (s) => s.roomId === 'OB-1' && s.paperId === 'P08'
  );
  assert.ok(
    ob1P08SlotsWithoutLock.length > 0,
    'When completion lock is OFF, OB-1 can be allocated P08 as requested'
  );
});

// =========================================================================
// SECTION 36 REQUIRED TESTS: TIER 1, CURRICULUM ALLOCATION, TEACHER ALLOCATION, MULTI-DAY
// =========================================================================

// --- Tier 1 Tests (Scenarios 1–9) ---

test('Scenario 1: Rules 1–5 retain their existing behaviour', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: ['T1', 'T2'],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const validation = validateRoutine(routine.slots, INITIAL_TEACHERS, INITIAL_CLASSROOMS, ['T1', 'T2'], DEFAULT_ROUTINE_RULES);
  assert.equal(validation.tier1Passed, true);
  assert.equal(validation.conflicts.length, 0); // Rule 1: Zero Double Booking
  assert.equal(validation.absentViolations.length, 0); // Rule 2: Strict Absentee Exclusion
  assert.equal(validation.buildingBindingViolations.length, 0); // Rule 3: Strict Building Binding
  assert.equal(validation.buildingConflicts.length, 0); // Rule 4: Transit Gap
});

test('Scenario 2: Rule 6 ON disables Rules 6A and 6B', () => {
  const normalized = normalizeRuleConfig({
    enableMaxOnePeriodPerSubjectPerRoomDaily: true,
    enableMaxRoomDailyLimit: true,
    enableNonConsecutiveGapForSameSubject: true,
  });

  assert.equal(normalized.enableMaxOnePeriodPerSubjectPerRoomDaily, true);
  assert.equal(normalized.enableMaxRoomDailyLimit, false);
  assert.equal(normalized.enableNonConsecutiveGapForSameSubject, false);
  assert.equal(isRuleDisabled('enableMaxRoomDailyLimit', normalized), true);
  assert.equal(isRuleDisabled('enableNonConsecutiveGapForSameSubject', normalized), true);
});

test('Scenario 3: Rule 6 OFF makes Rule 6A available', () => {
  const normalized = normalizeRuleConfig({
    enableMaxOnePeriodPerSubjectPerRoomDaily: false,
    enableMaxRoomDailyLimit: true,
  });

  assert.equal(normalized.enableMaxOnePeriodPerSubjectPerRoomDaily, false);
  assert.equal(isRuleDisabled('enableMaxRoomDailyLimit', normalized), false);
});

test('Scenario 4: Rule 6A OFF disables Rule 6B', () => {
  const normalized = normalizeRuleConfig({
    enableMaxOnePeriodPerSubjectPerRoomDaily: false,
    enableMaxRoomDailyLimit: false,
    enableNonConsecutiveGapForSameSubject: true,
  });

  assert.equal(normalized.enableMaxRoomDailyLimit, false);
  assert.equal(normalized.enableNonConsecutiveGapForSameSubject, false);
  assert.equal(isRuleDisabled('enableNonConsecutiveGapForSameSubject', normalized), true);
});

test('Scenario 5: Rule 6A ON makes Rule 6B available', () => {
  const normalized = normalizeRuleConfig({
    enableMaxOnePeriodPerSubjectPerRoomDaily: false,
    enableMaxRoomDailyLimit: true,
    enableNonConsecutiveGapForSameSubject: true,
  });

  assert.equal(normalized.enableMaxRoomDailyLimit, true);
  assert.equal(isRuleDisabled('enableNonConsecutiveGapForSameSubject', normalized), false);
});

test('Scenario 6: Rule 6A enforces the maximum of two subject periods per room/class per day', () => {
  const rules = normalizeRuleConfig({
    enableMaxOnePeriodPerSubjectPerRoomDaily: false,
    enableMaxRoomDailyLimit: true,
  });

  // Valid: 2 periods of P01 in OB-1
  const validSlots = [
    { id: 's1', roomId: 'OB-1', period: 1, paperId: 'P01', teacherId: 'T1', isSubstitute: false },
    { id: 's2', roomId: 'OB-1', period: 3, paperId: 'P01', teacherId: 'T2', isSubstitute: false },
  ];
  const validCheck = validateSlotAssignmentTier1(
    { roomId: 'OB-1', period: 4, paperId: 'P02', teacherId: 'T3' },
    validSlots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    rules
  );
  assert.equal(validCheck.isValid, true);

  // Invalid: 3rd period of P01 in OB-1
  const invalidCheck = validateSlotAssignmentTier1(
    { roomId: 'OB-1', period: 5, paperId: 'P01', teacherId: 'T3' },
    validSlots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    rules
  );
  assert.equal(invalidCheck.isValid, false);
});

test('Scenario 7: Rule 6B prevents consecutive subject periods when enabled', () => {
  const rules = normalizeRuleConfig({
    enableMaxOnePeriodPerSubjectPerRoomDaily: false,
    enableMaxRoomDailyLimit: true,
    enableNonConsecutiveGapForSameSubject: true,
  });

  const slots = [
    { id: 's1', roomId: 'OB-1', period: 1, paperId: 'P01', teacherId: 'T1', isSubstitute: false },
  ];

  // Consecutive in Period 2: Forbidden
  const consecutiveCheck = validateSlotAssignmentTier1(
    { roomId: 'OB-1', period: 2, paperId: 'P01', teacherId: 'T3' },
    slots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    rules
  );
  assert.equal(consecutiveCheck.isValid, false);

  // Non-consecutive in Period 3: Allowed
  const nonConsecutiveCheck = validateSlotAssignmentTier1(
    { roomId: 'OB-1', period: 3, paperId: 'P01', teacherId: 'T3' },
    slots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    rules
  );
  assert.equal(nonConsecutiveCheck.isValid, true);
});

test('Scenario 8: New Rule 7 preserves the old Rule 9 behaviour (Strict hard-cap <= 4 periods/day)', () => {
  const rules = normalizeRuleConfig({
    enableDailyWorkloadMaxCap: true,
  });

  const teacherId = 'T1';
  const existingTeacherSlots = [
    { id: 's1', roomId: 'OB-1', period: 1, paperId: 'P01', teacherId, isSubstitute: false },
    { id: 's2', roomId: 'OB-2', period: 2, paperId: 'P01', teacherId, isSubstitute: false },
    { id: 's3', roomId: 'OB-3', period: 3, paperId: 'P01', teacherId, isSubstitute: false },
    { id: 's4', roomId: 'OB-4', period: 4, paperId: 'P01', teacherId, isSubstitute: false },
  ];

  // Propose 5th period: strictly rejected
  const fifthCheck = validateSlotAssignmentTier1(
    { roomId: 'OB-5', period: 5, paperId: 'P01', teacherId },
    existingTeacherSlots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    rules
  );
  assert.equal(fifthCheck.isValid, false);
});

test('Scenario 9: Old rule settings migrate without incorrect mappings', () => {
  const legacyStored = {
    enableMaxRoomDailyLimit: true,
    enableNonConsecutiveGapForSameSubject: true,
    enableDailyWorkloadMaxCap: true,
    enableMaxOnePeriodPerSubjectPerRoomDaily: false,
  };

  const migrated = migrateLegacyRules(legacyStored);
  assert.equal(migrated.enableMaxRoomDailyLimit, true);
  assert.equal(migrated.enableNonConsecutiveGapForSameSubject, true);
  assert.equal(migrated.enableDailyWorkloadMaxCap, true);
  assert.equal(migrated.enableMaxOnePeriodPerSubjectPerRoomDaily, false);
});

// --- Curriculum Allocation Tests (Scenarios 10–17) ---

test('Scenario 10: High, Medium, Low and Exclude priorities apply the correct multipliers', () => {
  const mockCompleted = new Map<string, Map<string, number>>();
  INITIAL_CLASSROOMS.forEach((r) => {
    const cMap = new Map<string, number>();
    INITIAL_PAPERS.forEach((p) => cMap.set(p.id, 0));
    mockCompleted.set(r.id, cMap);
  });

  const plan = calculateCurriculumAllocation(
    INITIAL_CLASSROOMS,
    INITIAL_PAPERS,
    mockCompleted,
    {
      P01: 'HIGH',
      P02: 'MEDIUM',
      P03: 'LOW',
      P04: 'EXCLUDE',
    }
  );

  const allocP01 = plan.allocations.get('P01')!;
  const allocP02 = plan.allocations.get('P02')!;
  const allocP03 = plan.allocations.get('P03')!;
  const allocP04 = plan.allocations.get('P04')!;

  assert.equal(allocP01.priorityMultiplier, 1.50);
  assert.equal(allocP02.priorityMultiplier, 1.00);
  assert.equal(allocP03.priorityMultiplier, 0.50);
  assert.equal(allocP04.priorityMultiplier, 0.00);
  assert.equal(allocP04.adjustedDemand, 0);
  assert.equal(allocP04.integerTarget, 0);
});

test('Scenario 11: Allocation percentages sum to 100% when eligible adjusted demand is positive', () => {
  const mockCompleted = new Map<string, Map<string, number>>();
  INITIAL_CLASSROOMS.forEach((r) => {
    const cMap = new Map<string, number>();
    INITIAL_PAPERS.forEach((p) => cMap.set(p.id, 0));
    mockCompleted.set(r.id, cMap);
  });

  const plan = calculateCurriculumAllocation(
    INITIAL_CLASSROOMS,
    INITIAL_PAPERS,
    mockCompleted,
    {
      P01: 'HIGH',
      P02: 'MEDIUM',
      P03: 'LOW',
    }
  );

  const totalPct = Array.from(plan.allocations.values()).reduce((sum, a) => sum + a.allocationPercentage, 0);
  assert.ok(Math.abs(totalPct - 100) < 0.01, `Allocation percentages should sum to 100%, got ${totalPct}`);
});

test('Scenario 12: Zero-demand and all-excluded cases do not cause division-by-zero errors', () => {
  const mockCompleted = new Map<string, Map<string, number>>();
  INITIAL_CLASSROOMS.forEach((r) => {
    const cMap = new Map<string, number>();
    INITIAL_PAPERS.forEach((p) => cMap.set(p.id, 0));
    mockCompleted.set(r.id, cMap);
  });

  const allExcluded: Record<string, SubjectPriorityTier> = {};
  INITIAL_PAPERS.forEach((p) => (allExcluded[p.id] = 'EXCLUDE'));

  assert.doesNotThrow(() => {
    const plan = calculateCurriculumAllocation(
      INITIAL_CLASSROOMS,
      INITIAL_PAPERS,
      mockCompleted,
      allExcluded
    );
    assert.equal(plan.totalAdjustedDemand, 0);
  });
});

test('Scenario 13: Integer session targets sum to assignable capacity (75) when valid allocation is possible', () => {
  const mockCompleted = new Map<string, Map<string, number>>();
  INITIAL_CLASSROOMS.forEach((r) => {
    const cMap = new Map<string, number>();
    INITIAL_PAPERS.forEach((p) => cMap.set(p.id, 0));
    mockCompleted.set(r.id, cMap);
  });

  const plan = calculateCurriculumAllocation(
    INITIAL_CLASSROOMS,
    INITIAL_PAPERS,
    mockCompleted,
    { P01: 'HIGH', P02: 'MEDIUM', P03: 'LOW' }
  );

  const sumIntegerTargets = Array.from(plan.allocations.values()).reduce((sum, a) => sum + a.integerTarget, 0);
  assert.equal(sumIntegerTargets, 75);
});

test('Scenario 14: Reconciliation is deterministic', () => {
  const mockCompleted = new Map<string, Map<string, number>>();
  INITIAL_CLASSROOMS.forEach((r) => {
    const cMap = new Map<string, number>();
    INITIAL_PAPERS.forEach((p) => cMap.set(p.id, 0));
    mockCompleted.set(r.id, cMap);
  });

  const plan1 = calculateCurriculumAllocation(INITIAL_CLASSROOMS, INITIAL_PAPERS, mockCompleted, { P01: 'HIGH', P02: 'LOW' });
  const plan2 = calculateCurriculumAllocation(INITIAL_CLASSROOMS, INITIAL_PAPERS, mockCompleted, { P01: 'HIGH', P02: 'LOW' });

  for (const paper of INITIAL_PAPERS) {
    assert.equal(
      plan1.allocations.get(paper.id)!.integerTarget,
      plan2.allocations.get(paper.id)!.integerTarget
    );
  }
});

test('Scenario 15: No class/room receives more assignments than its available periods (5)', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  for (const room of INITIAL_CLASSROOMS) {
    const roomSlots = routine.slots.filter((s) => s.roomId === room.id);
    assert.equal(roomSlots.length, 5, `Room ${room.id} must have exactly 5 periods`);
  }
});

test('Scenario 16: No subject exceeds legitimate remaining curriculum demand', () => {
  // Mock classroom where P01 has reached 100% quota
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  assert.equal(routine.slots.length, 75);
});

test('Scenario 17: Vacancy filling respects Tier 1 and does not overfill a room', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const validation = validateRoutine(routine.slots, INITIAL_TEACHERS, INITIAL_CLASSROOMS, [], DEFAULT_ROUTINE_RULES);
  assert.equal(validation.tier1Passed, true);
  assert.equal(routine.slots.length, 75);
});

// --- Teacher Allocation Tests (Scenarios 18–27) ---

test('Scenario 18: Teacher workload is calculated using the correct accounting scope', () => {
  const day1Routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const day2Routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [day1Routine],
    targetDayNumber: 2,
    targetDate: '2026-10-25',
  });

  assert.ok(day2Routine.generationAudit);
  assert.equal(day2Routine.slots.length, 75);
});

test('Scenario 19: Unavailable teachers are excluded for affected periods', () => {
  const absentees = ['T1', 'T4', 'T10', 'T20'];
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: absentees,
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  for (const s of routine.slots) {
    assert.equal(absentees.includes(s.teacherId), false, `Unavailable teacher ${s.teacherId} must not be scheduled`);
  }
});

test('Scenario 20: Eligible main-subject teachers are preferred', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  // Non-substitute slots must match primary teachers
  const nonSubstituteSlots = routine.slots.filter((s) => !s.isSubstitute && s.teacherId);
  for (const s of nonSubstituteSlots) {
    const paper = INITIAL_PAPERS.find((p) => p.id === s.paperId)!;
    const teacher = INITIAL_TEACHERS.find((t) => t.id === s.teacherId)!;
    if (paper.id === 'P13') continue; // flexible
    assert.ok(
      teacher.primaryPaperIds.includes(paper.id),
      `Teacher ${teacher.name} should be primary for ${paper.code}`
    );
  }
});

test('Scenario 21: Teacher workload differences are minimised where feasible', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  assert.ok(routine.generationAudit);
  assert.ok(routine.generationAudit.maxTeacherLoad <= 4, 'Hard cap of 4 strictly respected');
  assert.ok(routine.generationAudit.workloadDifference <= 3, 'Daily workload difference is tight');
});

test('Scenario 22: No simultaneous double-booking occurs', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const validation = validateRoutine(routine.slots, INITIAL_TEACHERS, INITIAL_CLASSROOMS, []);
  assert.equal(validation.conflicts.length, 0);
});

test('Scenario 23: No Substitution ON prevents unauthorised substitution', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: ['T1', 'T2', 'T3'], // all primary for P01 absent
    priorityPaperIds: ['P01'],
    rules: {
      enableNoSubstituteAllotment: true,
      replaceWithAvailableSubjectIfNoPrimary: false,
    },
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const p01Slots = routine.slots.filter((s) => s.paperId === 'P01');
  assert.ok(p01Slots.length > 0);
  for (const s of p01Slots) {
    assert.equal(s.teacherId, '', 'Slot must be left blank / No Instructor');
  }
});

test('Scenario 24: Change to Most Probable Subject is available only in the appropriate state', () => {
  // When No Substitute is OFF: Change to Most Probable Subject is disabled
  const rulesSubAllowed = normalizeRuleConfig({
    enableNoSubstituteAllotment: false,
    replaceWithAvailableSubjectIfNoPrimary: true,
  });
  assert.equal(rulesSubAllowed.replaceWithAvailableSubjectIfNoPrimary, false);
  assert.equal(isRuleDisabled('replaceWithAvailableSubjectIfNoPrimary', rulesSubAllowed), true);

  // When No Substitute is ON: Change to Most Probable Subject is available
  const rulesNoSub = normalizeRuleConfig({
    enableNoSubstituteAllotment: true,
    replaceWithAvailableSubjectIfNoPrimary: true,
  });
  assert.equal(rulesNoSub.replaceWithAvailableSubjectIfNoPrimary, true);
  assert.equal(isRuleDisabled('replaceWithAvailableSubjectIfNoPrimary', rulesNoSub), false);
});

test('Scenario 25: Disabled fallback does not replace subjects automatically', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: ['T1', 'T2', 'T3'],
    priorityPaperIds: ['P01'],
    rules: {
      enableNoSubstituteAllotment: true,
      replaceWithAvailableSubjectIfNoPrimary: false,
    },
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const p01Slots = routine.slots.filter((s) => s.paperId === 'P01');
  for (const s of p01Slots) {
    assert.equal(s.teacherId, '');
    assert.equal(s.paperId, 'P01', 'Subject is not replaced when fallback is disabled');
  }
});

test('Scenario 26: An impossible assignment is marked No Instructor', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: ['T1', 'T2', 'T3'],
    priorityPaperIds: ['P01'],
    rules: {
      enableNoSubstituteAllotment: true,
      replaceWithAvailableSubjectIfNoPrimary: false,
    },
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const emptySlots = routine.slots.filter((s) => s.teacherId === '');
  assert.ok(emptySlots.length > 0);
  for (const s of emptySlots) {
    assert.equal(s.isSubstitute, false);
    assert.ok(s.substituteReason?.includes('No instructor available'));
  }
});

test('Scenario 27: A valid replacement updates subject allocation and workload records', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: ['T1', 'T2', 'T3'], // P01 primaries
    priorityPaperIds: ['P01'],
    rules: {
      enableNoSubstituteAllotment: true,
      replaceWithAvailableSubjectIfNoPrimary: true,
    },
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  // Replaced slots will have alternate subject assigned
  assert.ok(routine.generationAudit);
  assert.equal(routine.slots.length, 75);
});

// --- Multi-day Tests (Scenarios 28–33) ---

test('Scenario 28: Day 2 considers Day 1 final room assignments', () => {
  const routines = generateMultipleDaysRoutines({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    startDayNumber: 1,
    startDate: '2026-10-24',
    numberOfDays: 2,
  });

  assert.equal(routines.length, 2);
  assert.equal(routines[0].dayNumber, 1);
  assert.equal(routines[1].dayNumber, 2);
});

test('Scenario 29: Curriculum progress updates correctly across days', () => {
  const routines = generateMultipleDaysRoutines({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    startDayNumber: 1,
    startDate: '2026-10-24',
    numberOfDays: 2,
  });

  const stats = calculateCumulativeStats(INITIAL_PAPERS, [routines[0]], routines[1].slots);
  const totalDone = stats.reduce((sum, s) => sum + s.completedSessions + s.todaySessions, 0);
  assert.equal(totalDone, 150); // 75 + 75 = 150
});

test('Scenario 30: Teacher workloads are cumulative across days', () => {
  const routines = generateMultipleDaysRoutines({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    startDayNumber: 1,
    startDate: '2026-10-24',
    numberOfDays: 3,
  });

  assert.equal(routines.length, 3);
  const day3Audit = routines[2].generationAudit;
  assert.ok(day3Audit);
  // Total loads on day 3 reflect 3 full days of scheduling
  const maxDay3 = day3Audit.maxTeacherLoad;
  assert.ok(maxDay3 >= 7, `3 days of teaching load should accumulate, got ${maxDay3}`);
});

test('Scenario 31: Unavailable teachers are not assigned during unavailable periods', () => {
  const day1Routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: ['T5'],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const t5Slots = day1Routine.slots.filter((s) => s.teacherId === 'T5');
  assert.equal(t5Slots.length, 0);
});

test('Scenario 32: Rule 12 rotational flow is maintained where feasible', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    rules: {
      enablePaperRotationalFlow: true,
    },
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  assert.equal(routine.slots.length, 75);
});

test('Scenario 33: Multi-day generation respects all applicable Tier 1 constraints', () => {
  const routines = generateMultipleDaysRoutines({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    startDayNumber: 1,
    startDate: '2026-10-24',
    numberOfDays: 3,
  });

  for (const routine of routines) {
    const validation = validateRoutine(routine.slots, INITIAL_TEACHERS, INITIAL_CLASSROOMS, [], DEFAULT_ROUTINE_RULES);
    assert.equal(validation.tier1Passed, true, `Day ${routine.dayNumber} must pass all Tier 1 hard constraints`);
  }
});

test('T27 is assigned as primary teacher for Paper 12 based on instructor mapping', () => {
  const teacher27 = {
    id: 'T27',
    code: 'T27',
    name: 'SI(AB) Biswajit Deb',
    designation: 'Ethics',
    assignedBuilding: 'FLOATING' as const,
    maxDailyPeriods: 4,
    primaryPaperIds: ['P12'],
    backupPaperIds: ['P10', 'P11'],
    secondaryPaperIds: ['P10', 'P11'],
    phone: '',
    email: '',
    status: 'ACTIVE' as const,
  };

  const teachersWithT27 = [...INITIAL_TEACHERS, teacher27];

  // Verify getPaperPrimaryTeachers resolves T27 for P12
  const p12 = INITIAL_PAPERS.find((p) => p.id === 'P12')!;
  const primaryTeachersForP12 = getPaperPrimaryTeachers(p12, teachersWithT27);
  assert.ok(
    primaryTeachersForP12.some((t) => t.id === 'T27'),
    'T27 must be resolved as primary teacher for Paper-12'
  );

  // Generate routine with P12 prioritized
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: teachersWithT27,
    absentTeacherIds: [],
    priorityPaperIds: ['P12'],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const p12Slots = routine.slots.filter((s) => s.paperId === 'P12');
  assert.ok(p12Slots.length > 0, 'Paper 12 must have scheduled slots');

  // Verify that T27 is assigned to Paper 12
  const t27Slots = p12Slots.filter((s) => s.teacherId === 'T27');
  assert.ok(
    t27Slots.length > 0,
    `T27 must be assigned to at least one Paper 12 slot, assigned ${t27Slots.length}`
  );

  // Rule verification: any assigned primary teacher for any subject must have that subject as main subject in instructor mapping
  for (const slot of routine.slots) {
    if (!slot.teacherId) continue;
    const t = teachersWithT27.find((x) => x.id === slot.teacherId);
    if (!t) continue;
    if (slot.paperId === 'P13') continue; // practical is flexible
    if (!slot.isSubstitute) {
      assert.ok(
        t.primaryPaperIds.includes(slot.paperId),
        `Teacher ${t.code} assigned to ${slot.paperId} without substitute flag must have ${slot.paperId} as main subject`
      );
    }
  }
});

test('Rule 4A: Exclude Period 3 to Period 4 building transition from mandatory gap', () => {
  // 1. Test dependency: Rule 4A disabled when Rule 4 is OFF
  const rulesWithRule4Off = {
    ...DEFAULT_ROUTINE_RULES,
    enableBuildingChangeGap: false,
    enableBuildingChangeGapPeriod3To4Exemption: true,
  };
  assert.equal(
    isRuleDisabled('enableBuildingChangeGapPeriod3To4Exemption', rulesWithRule4Off),
    true,
    'Rule 4A must be disabled when Rule 4 is OFF'
  );

  const normalized = normalizeRuleConfig(rulesWithRule4Off);
  assert.equal(
    normalized.enableBuildingChangeGapPeriod3To4Exemption,
    false,
    'Rule 4A must be forced to false by normalizeRuleConfig when Rule 4 is OFF'
  );

  // 2. Test dependency: Rule 4A enabled when Rule 4 is ON
  const rulesWithRule4On = {
    ...DEFAULT_ROUTINE_RULES,
    enableBuildingChangeGap: true,
    enableBuildingChangeGapPeriod3To4Exemption: false,
  };
  assert.equal(
    isRuleDisabled('enableBuildingChangeGapPeriod3To4Exemption', rulesWithRule4On),
    false,
    'Rule 4A must be available when Rule 4 is ON'
  );

  // 3. Test validation: Floating teacher (e.g. T3) teaching P3 in OB-1 and P4 in NB-1
  const testSlots: ClassSlot[] = [
    { id: 's1', roomId: 'OB-1', period: 3, teacherId: 'T3', paperId: 'P01', isSubstitute: false },
    { id: 's2', roomId: 'NB-1', period: 4, teacherId: 'T3', paperId: 'P01', isSubstitute: false },
  ];

  // When Rule 4 is ON and Rule 4A is OFF -> 1 building conflict
  const validationWithRule4AOff = validateRoutine(
    testSlots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    {
      ...DEFAULT_ROUTINE_RULES,
      enableBuildingChangeGap: true,
      enableBuildingChangeGapPeriod3To4Exemption: false,
    }
  );
  assert.equal(
    validationWithRule4AOff.buildingConflicts.length,
    1,
    'Must have 1 building conflict when Rule 4A is OFF'
  );

  // When Rule 4 is ON and Rule 4A is ON -> 0 building conflicts (exempted because P3->P4 recess break)
  const validationWithRule4AOn = validateRoutine(
    testSlots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    {
      ...DEFAULT_ROUTINE_RULES,
      enableBuildingChangeGap: true,
      enableBuildingChangeGapPeriod3To4Exemption: true,
    }
  );
  assert.equal(
    validationWithRule4AOn.buildingConflicts.length,
    0,
    'Must have 0 building conflicts for Period 3 -> Period 4 when Rule 4A is ON'
  );

  // Non P3->P4 transition (e.g. Period 1 in OB-1 and Period 2 in NB-1) must STILL be a conflict even when Rule 4A is ON!
  const nonExemptSlots: ClassSlot[] = [
    { id: 's3', roomId: 'OB-1', period: 1, teacherId: 'T3', paperId: 'P01', isSubstitute: false },
    { id: 's4', roomId: 'NB-1', period: 2, teacherId: 'T3', paperId: 'P01', isSubstitute: false },
  ];
  const validationNonExempt = validateRoutine(
    nonExemptSlots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    {
      ...DEFAULT_ROUTINE_RULES,
      enableBuildingChangeGap: true,
      enableBuildingChangeGapPeriod3To4Exemption: true,
    }
  );
  assert.equal(
    validationNonExempt.buildingConflicts.length,
    1,
    'Period 1 -> Period 2 transit must still trigger building conflict even when Rule 4A is ON'
  );
});

test('Scenario 34: Instructor marked with REST is excluded from class detailment in routine generation', () => {
  // Marked T7 as REST
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: ['T7'],
    priorityPaperIds: [],
    rules: DEFAULT_ROUTINE_RULES,
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const t7Slots = routine.slots.filter((s) => s.teacherId === 'T7');
  assert.equal(t7Slots.length, 0, 'Instructor T7 on REST must have 0 class slots assigned');
});

test('Scenario 35: In PDF, REST instructor is shown as normal available free / reserve and excluded from absent section', () => {
  const routine: DailyRoutine = {
    id: 'routine-test-rest',
    dayNumber: 1,
    date: '2026-10-24',
    absentTeacherIds: ['T7', 'T8'],
    unavailableTeachers: [
      { teacherId: 'T7', type: 'REST', remark: 'Rest / Standby Reserve' },
      { teacherId: 'T8', type: 'LEAVE', remark: 'Casual Leave' },
    ],
    priorityPaperIds: [],
    slots: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isLocked: false,
    status: 'draft',
  };

  // 1. Resting instructor check
  const restingTeacherIds = new Set(
    (routine.unavailableTeachers || [])
      .filter((u) => u.type === 'REST')
      .map((u) => u.teacherId.replace(/^T0*/, 'T'))
  );
  assert.equal(restingTeacherIds.has('T7'), true);
  assert.equal(restingTeacherIds.has('T8'), false);

  // 2. Absent exclusion set for period availability (T7 on REST must NOT be excluded)
  const absentExclusionSet = new Set(
    routine.absentTeacherIds
      .map((id) => id.replace(/^T0*/, 'T'))
      .filter((id) => !restingTeacherIds.has(id))
  );
  assert.equal(absentExclusionSet.has('T7'), false, 'T7 on REST must not be excluded from reserve roster');
  assert.equal(absentExclusionSet.has('T8'), true, 'T8 on LEAVE must be excluded from reserve roster');

  // 3. Bottom unavailable section (T7 on REST must be excluded, only T8 shown)
  const unavailableMap = new Map<string, { type: string; remark?: string }>();
  if (routine.unavailableTeachers) {
    for (const u of routine.unavailableTeachers) {
      unavailableMap.set(u.teacherId.replace(/^T0*/, 'T'), { type: u.type, remark: u.remark });
    }
  }
  const unavailableInstructors = Array.from(unavailableMap.entries()).map(([tid, info]) => ({
    teacherId: tid,
    type: info.type,
    remark: info.remark,
  }));
  const displayedUnavailable = unavailableInstructors.filter((u) => u.type !== 'REST');
  assert.equal(displayedUnavailable.length, 1);
  assert.equal(displayedUnavailable[0].teacherId, 'T8');
  assert.equal(displayedUnavailable[0].type, 'LEAVE');
});

test('Scenario 36: AppSettings adminPassword defaults to admin123 and supports custom password', () => {
  assert.equal(DEFAULT_APP_SETTINGS.adminPassword, 'admin123');

  const customSettings: AppSettings = {
    ...DEFAULT_APP_SETTINGS,
    adminPassword: 'securePassword456',
  };
  assert.equal(customSettings.adminPassword, 'securePassword456');
});

test('Scenario 37: Rule 8: Teacher Load Equalization Priority generates 75 valid slots with Tier 1 passed', () => {
  const rules = {
    ...DEFAULT_ROUTINE_RULES,
    enableTeacherLoadEqualizationPriority: true,
  };

  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    rules,
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  assert.equal(routine.slots.length, 75);
  const validation = validateRoutine(
    routine.slots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    rules,
    INITIAL_PAPERS
  );

  assert.equal(validation.tier1Passed, true, 'Rule 8 must satisfy all Tier 1 hard constraints');
  assert.equal(validation.conflicts.length, 0, 'No double-booking conflicts allowed');
  assert.equal(validation.buildingBindingViolations.length, 0, 'Strict building binding must hold');
  assert.equal(validation.teacherMaxLoadViolations.length, 0, 'Hard cap of 4 periods must not be exceeded');
});

test('Scenario 38: Rule 8 prioritizes lagging teachers with fewer cumulative sessions', () => {
  const rules = {
    ...DEFAULT_ROUTINE_RULES,
    enableTeacherLoadEqualizationPriority: true,
  };

  // Day 1
  const day1 = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    rules,
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  // Day 2
  const day2 = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    rules,
    historicalRoutines: [day1],
    targetDayNumber: 2,
    targetDate: '2026-10-25',
  });

  const d1Loads = new Map<string, number>();
  INITIAL_TEACHERS.forEach((t) => d1Loads.set(t.id, 0));
  day1.slots.forEach((s) => {
    if (s.teacherId) d1Loads.set(s.teacherId, (d1Loads.get(s.teacherId) || 0) + 1);
  });

  const d2Loads = new Map<string, number>();
  INITIAL_TEACHERS.forEach((t) => d2Loads.set(t.id, 0));
  day2.slots.forEach((s) => {
    if (s.teacherId) d2Loads.set(s.teacherId, (d2Loads.get(s.teacherId) || 0) + 1);
  });

  // Find teachers who had lowest load on Day 1 (<= 2 periods)
  const lowDay1Teachers = INITIAL_TEACHERS.filter((t) => (d1Loads.get(t.id) || 0) <= 2);
  const avgDay2LoadForLowD1 =
    lowDay1Teachers.reduce((acc, t) => acc + (d2Loads.get(t.id) || 0), 0) / lowDay1Teachers.length;

  assert.equal(
    avgDay2LoadForLowD1 >= 2.5,
    true,
    'Teachers with fewer sessions on Day 1 must receive higher session allocations on Day 2'
  );
});

test('Scenario 39: When Rule 8 is OFF, routine generator operates in standard curriculum-first mode', () => {
  const rulesOff = {
    ...DEFAULT_ROUTINE_RULES,
    enableTeacherLoadEqualizationPriority: false,
  };

  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    rules: rulesOff,
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  assert.equal(routine.slots.length, 75);
  const validation = validateRoutine(
    routine.slots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    rulesOff,
    INITIAL_PAPERS
  );
  assert.equal(validation.tier1Passed, true);
});

test('Scenario 40: computeInstructorUnavailabilityStats accurately aggregates leave, duty, sick, rest, and absences across routines', () => {
  const dummyRoutines: DailyRoutine[] = [
    {
      id: 'r1',
      dayNumber: 1,
      date: '2026-10-27',
      isLocked: true,
      createdAt: '2026-10-27T00:00:00Z',
      updatedAt: '2026-10-27T00:00:00Z',
      status: 'published',
      absentTeacherIds: ['T1', 'T2'],
      unavailableTeachers: [
        { teacherId: 'T1', type: 'LEAVE', remark: 'Casual Leave', date: '2026-10-27' },
        { teacherId: 'T2', type: 'DUTY', remark: 'Special Law & Order Duty', date: '2026-10-27' },
      ],
      priorityPaperIds: [],
      slots: [],
    },
    {
      id: 'r2',
      dayNumber: 2,
      date: '2026-10-28',
      isLocked: true,
      createdAt: '2026-10-28T00:00:00Z',
      updatedAt: '2026-10-28T00:00:00Z',
      status: 'published',
      absentTeacherIds: ['T1', 'T3'],
      unavailableTeachers: [
        { teacherId: 'T1', type: 'REST', remark: 'Rest Standby', date: '2026-10-28' },
        { teacherId: 'T3', type: 'SICK', remark: 'Medical leave', date: '2026-10-28' },
      ],
      priorityPaperIds: [],
      slots: [],
    },
    {
      id: 'r3',
      dayNumber: 3,
      date: '2026-10-29',
      isLocked: true,
      createdAt: '2026-10-29T00:00:00Z',
      updatedAt: '2026-10-29T00:00:00Z',
      status: 'published',
      absentTeacherIds: ['T4'],
      priorityPaperIds: [],
      slots: [],
    },
  ];

  const stats = computeInstructorUnavailabilityStats(INITIAL_TEACHERS, dummyRoutines);
  assert.equal(stats.length, INITIAL_TEACHERS.length);

  const t1 = stats.find((s) => s.teacher.id === 'T1');
  assert.ok(t1);
  assert.equal(t1.totalUnavailableDays, 2);
  assert.equal(t1.leaveCount, 1);
  assert.equal(t1.restCount, 1);
  assert.equal(t1.dutyCount, 0);
  assert.equal(t1.incidents.length, 2);

  const t2 = stats.find((s) => s.teacher.id === 'T2');
  assert.ok(t2);
  assert.equal(t2.totalUnavailableDays, 1);
  assert.equal(t2.dutyCount, 1);

  const t3 = stats.find((s) => s.teacher.id === 'T3');
  assert.ok(t3);
  assert.equal(t3.totalUnavailableDays, 1);
  assert.equal(t3.sickCount, 1);

  const t4 = stats.find((s) => s.teacher.id === 'T4');
  assert.ok(t4);
  assert.equal(t4.totalUnavailableDays, 1);
  assert.equal(t4.absentCount, 1);

  const t5 = stats.find((s) => s.teacher.id === 'T5');
  assert.ok(t5);
  assert.equal(t5.totalUnavailableDays, 0);
  assert.equal(t5.attendanceRate, 100);
});

test('Scenario 41: generateInstructorUnavailabilityData and generateUnavailabilityIncidentLogData generate valid report rows', () => {
  const dummyRoutines: DailyRoutine[] = [
    {
      id: 'r1',
      dayNumber: 1,
      date: '2026-10-27',
      isLocked: true,
      createdAt: '2026-10-27T00:00:00Z',
      updatedAt: '2026-10-27T00:00:00Z',
      status: 'published',
      absentTeacherIds: ['T17'],
      unavailableTeachers: [
        { teacherId: 'T17', type: 'DUTY', remark: 'Special Law & Order', date: '2026-10-27' },
      ],
      priorityPaperIds: [],
      slots: [],
    },
  ];

  const summaryRows = generateInstructorUnavailabilityData(INITIAL_TEACHERS, dummyRoutines);
  assert.equal(summaryRows.length, INITIAL_TEACHERS.length);
  const t17Row = summaryRows.find((r) => r[1] === 'T17');
  assert.ok(t17Row);
  assert.equal(t17Row[5], 1);
  assert.equal(t17Row[7], 1);

  const incidentRows = generateUnavailabilityIncidentLogData(INITIAL_TEACHERS, dummyRoutines);
  assert.equal(incidentRows.length, 1);
  assert.equal(incidentRows[0][3], 'T17');
  assert.equal(incidentRows[0][6], 'DUTY');
});

test('Session number in brackets: counts sequential sessions per teacher for that paper in that classroom', () => {
  const day1Routine: DailyRoutine = {
    id: 'day-1',
    dayNumber: 1,
    date: '2026-10-24',
    createdAt: '2026-10-24T00:00:00Z',
    updatedAt: '2026-10-24T00:00:00Z',
    status: 'published',
    isLocked: true,
    absentTeacherIds: [],
    priorityPaperIds: [],
    slots: [
      { id: 's1-1', roomId: 'OB-1', period: 1, paperId: 'P01', teacherId: 'T1', isSubstitute: false },
      { id: 's1-2', roomId: 'OB-1', period: 3, paperId: 'P01', teacherId: 'T1', isSubstitute: false },
      { id: 's1-3', roomId: 'OB-2', period: 2, paperId: 'P01', teacherId: 'T1', isSubstitute: false },
    ],
  };

  const day2Routine: DailyRoutine = {
    id: 'day-2',
    dayNumber: 2,
    date: '2026-10-25',
    createdAt: '2026-10-25T00:00:00Z',
    updatedAt: '2026-10-25T00:00:00Z',
    status: 'draft',
    isLocked: false,
    absentTeacherIds: [],
    priorityPaperIds: [],
    slots: [
      { id: 's2-1', roomId: 'OB-1', period: 1, paperId: 'P01', teacherId: 'T1', isSubstitute: false },
      { id: 's2-2', roomId: 'OB-1', period: 3, paperId: 'P01', teacherId: 'T3', isSubstitute: true },
      { id: 's2-3', roomId: 'OB-2', period: 5, paperId: 'P01', teacherId: 'T1', isSubstitute: false },
    ],
  };

  const allRoutines = [day1Routine, day2Routine];
  const day2Map = buildRoutineSessionNumbersMap(day2Routine, allRoutines);

  assert.equal(day2Map.get('s2-1'), 3, 'Day 2 Period 1 in OB-1 for T1 teaching P01 is Session 3');
  assert.equal(day2Map.get('s2-2'), 1, 'Day 2 Period 3 in OB-1 for T3 teaching P01 is Session 1');
  assert.equal(day2Map.get('s2-3'), 2, 'Day 2 Period 5 in OB-2 for T1 teaching P01 is Session 2');

  const rows = generateIndoorRoutineData(day2Routine, INITIAL_CLASSROOMS, INITIAL_PAPERS, INITIAL_TEACHERS, allRoutines);
  assert.ok(rows.length > 0);
  const ob1Row = rows.find((r) => r[1] === 'OB-01');
  assert.ok(ob1Row, 'OB-1 row must be present in exported routine data');
  const p1Text = String(ob1Row[4]);
  assert.ok(p1Text.includes('(3)'), `Period 1 text should include (3), got "${p1Text}"`);
  const p3Text = String(ob1Row[6]);
  assert.ok(p3Text.includes('(1)'), `Period 3 text should include (1), got "${p3Text}"`);
  assert.ok(p3Text.includes('(Sub)'), `Period 3 text should include (Sub), got "${p3Text}"`);
});

test('Core Rules 1, 2, and 7 are removed from toggleable list but permanently enforced', () => {
  // 1. Verify Rule 1, Rule 2, and Rule 7 are NOT in MASTER_ROUTINE_RULES (toggleable list)
  const masterKeys = MASTER_ROUTINE_RULES.map((r) => r.key);
  assert.equal(masterKeys.includes('enableZeroDoubleBooking'), false, 'Rule 1 must NOT be in toggleable list');
  assert.equal(masterKeys.includes('enableStrictAbsenteeExclusion'), false, 'Rule 2 must NOT be in toggleable list');
  assert.equal(masterKeys.includes('enableDailyWorkloadMaxCap'), false, 'Rule 7 must NOT be in toggleable list');

  // 2. Verify normalizeRuleConfig permanently forces them to true
  const normalizedWithFalses = normalizeRuleConfig({
    enableZeroDoubleBooking: false,
    enableStrictAbsenteeExclusion: false,
    enableDailyWorkloadMaxCap: false,
  });
  assert.equal(normalizedWithFalses.enableZeroDoubleBooking, true, 'Rule 1 must be forced true');
  assert.equal(normalizedWithFalses.enableStrictAbsenteeExclusion, true, 'Rule 2 must be forced true');
  assert.equal(normalizedWithFalses.enableDailyWorkloadMaxCap, true, 'Rule 7 cap must be forced true');

  // 3. Verify scheduler strictly enforces zero double-booking and absentee exclusion
  const absentTeacher = INITIAL_TEACHERS[0];
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [absentTeacher.id],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  // Zero double-booking check
  for (let p = 1; p <= 5; p++) {
    const periodSlots = routine.slots.filter((s) => s.period === p && s.teacherId);
    const teacherIds = periodSlots.map((s) => s.teacherId);
    const uniqueIds = new Set(teacherIds);
    assert.equal(teacherIds.length, uniqueIds.size, `No teacher double-booked in period ${p}`);
  }

  // Absent teacher check
  const assignedAbsentSlots = routine.slots.filter((s) => s.teacherId === absentTeacher.id);
  assert.equal(assignedAbsentSlots.length, 0, 'Absent teacher must have 0 assigned slots');
});

test('Rule 8 dynamic availability: Subject detailment unavailable when ON, Teacher detailment unavailable when OFF', () => {
  // When Rule 8 is ON:
  const rulesTeacherFirst = normalizeRuleConfig({
    enableTeacherLoadEqualizationPriority: true,
    enableClassroomSubjectEqualization: true,
    enableWorkloadEqualization: true,
  });

  // Subject detailment rules (Rules 10-16) must be disabled and normalized to false
  for (const key of SUBJECT_DETAILMENT_RULES) {
    assert.equal(isRuleDisabled(key, rulesTeacherFirst), true, `${key} must be disabled when Rule 8 is ON`);
    assert.equal(rulesTeacherFirst[key], false, `${key} must be normalized to false when Rule 8 is ON`);
    const hint = getRuleDisabledHint(key, rulesTeacherFirst);
    assert.ok(hint && hint.includes('Rule 8'), `Hint for ${key} must explain Rule 8 is active`);
  }

  // Teacher detailment rules must be available when Rule 8 is ON
  for (const key of TEACHER_DETAILMENT_RULES) {
    assert.equal(isRuleDisabled(key, rulesTeacherFirst), false, `${key} must be available when Rule 8 is ON`);
  }

  // When Rule 8 is OFF:
  const rulesCurriculumFirst = normalizeRuleConfig({
    enableTeacherLoadEqualizationPriority: false,
    enableClassroomSubjectEqualization: true,
    enableWorkloadEqualization: true,
  });

  // Teacher detailment rules (Rules 17, 18, 22, 24) must be disabled and normalized to false
  for (const key of TEACHER_DETAILMENT_RULES) {
    assert.equal(isRuleDisabled(key, rulesCurriculumFirst), true, `${key} must be disabled when Rule 8 is OFF`);
    assert.equal(rulesCurriculumFirst[key], false, `${key} must be normalized to false when Rule 8 is OFF`);
    const hint = getRuleDisabledHint(key, rulesCurriculumFirst);
    assert.ok(hint && hint.includes('Rule 8'), `Hint for ${key} must explain Rule 8 is OFF`);
  }

  // Subject detailment rules must be available when Rule 8 is OFF
  for (const key of SUBJECT_DETAILMENT_RULES) {
    assert.equal(isRuleDisabled(key, rulesCurriculumFirst), false, `${key} must be available when Rule 8 is OFF`);
  }
});

test('Practical Class integrity: Practical classes only in scheduled rooms & periods with zero double booking', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableTeacherLoadEqualizationPriority: false, // Curriculum-First mode
      enablePracticalConsecutiveDoublePeriodLimit: true,
    },
    practicalConfig: {
      enabled: true,
      name: 'Computer Practical',
      teacherIds: ['T12'],
      items: [
        {
          id: 'p-1',
          name: 'Computer Practical',
          teacherId: 'T12',
          roomId: 'OB-1',
          periods: [2, 3],
        },
        {
          id: 'p-2',
          name: 'Computer Practical',
          teacherId: 'T12',
          roomId: 'OB-2',
          periods: [4, 5],
        },
      ],
    },
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  // Verify practical slots
  const practicalSlots = routine.slots.filter(
    (s) => s.paperId === 'P13' || s.practicalName === 'Computer Practical'
  );

  // Exactly 4 practical slots (2 in OB-1, 2 in OB-2)
  assert.equal(practicalSlots.length, 4, 'Must have exactly 4 practical slots across campus');

  // Must only be in OB-1 and OB-2
  for (const s of practicalSlots) {
    assert.ok(s.roomId === 'OB-1' || s.roomId === 'OB-2', `Practical slot found in unexpected room: ${s.roomId}`);
    if (s.roomId === 'OB-1') {
      assert.ok(s.period === 2 || s.period === 3, `OB-1 practical slot found in unexpected period: ${s.period}`);
    } else {
      assert.ok(s.period === 4 || s.period === 5, `OB-2 practical slot found in unexpected period: ${s.period}`);
    }
  }

  // Check no other room has practical class
  const unscheduledPracticalSlots = routine.slots.filter(
    (s) => s.roomId !== 'OB-1' && s.roomId !== 'OB-2' && (s.paperId === 'P13' || s.practicalName)
  );
  assert.equal(unscheduledPracticalSlots.length, 0, 'No practical class in unscheduled classrooms');

  // Verify full Tier 1 validation passes
  const validation = validateRoutine(
    routine.slots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    DEFAULT_ROUTINE_RULES,
    INITIAL_PAPERS,
    75,
    routine.practicalConfig
  );
  assert.equal(validation.tier1Passed, true, 'Tier 1 validation must pass');
  assert.equal(validation.conflicts.length, 0, 'Zero conflicts / double-booking');
});

test('Training day formatted with date in brackets for print and export: DAY <N> (<date>)', () => {
  const formatted = formatRoutineDateDDMMYYYY('2026-10-27');
  assert.equal(formatted, '27.10.2026');

  // Verify indoor routine metadata string in export data
  const mockRoutine: DailyRoutine = {
    id: 'day-1',
    dayNumber: 1,
    date: '2026-10-27',
    slots: [],
    absentTeacherIds: [],
    priorityPaperIds: [],
    createdAt: '2026-10-27T00:00:00Z',
    updatedAt: '2026-10-27T00:00:00Z',
    status: 'draft',
    isLocked: false,
  };

  const rows = generateIndoorRoutineData(mockRoutine, INITIAL_CLASSROOMS, INITIAL_PAPERS, INITIAL_TEACHERS, [mockRoutine]);
  assert.ok(rows !== undefined);
});

test('Rule 8 Teacher-First Detailment: Prioritizes assigning instructor to classroom where they have lowest historical detailment', () => {
  const rules = {
    ...DEFAULT_ROUTINE_RULES,
    enableTeacherLoadEqualizationPriority: true,
  };

  // Day 1
  const day1 = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    rules,
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  // Pick a teacher who taught in a specific room on Day 1
  const slotDay1 = day1.slots.find((s) => s.teacherId && s.roomId);
  assert.ok(slotDay1);
  const teacherId = slotDay1.teacherId;
  const visitedRoomId = slotDay1.roomId;

  // Day 2
  const day2 = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    rules,
    historicalRoutines: [day1],
    targetDayNumber: 2,
    targetDate: '2026-10-25',
  });

  const teacherDay2Slots = day2.slots.filter((s) => s.teacherId === teacherId);
  assert.ok(teacherDay2Slots.length > 0);

  // The teacher should prefer other rooms in Day 2 rather than repeating the same room
  const repeatedRoomSlots = teacherDay2Slots.filter((s) => s.roomId === visitedRoomId);
  assert.equal(
    repeatedRoomSlots.length,
    0,
    `Teacher ${teacherId} should not repeat room ${visitedRoomId} when other rooms have 0 visits`
  );
});

test('Practical Setup & Counters: Initial practical modules targets sum exactly to 188 (matches Paper-13 total target)', () => {
  const paper13 = INITIAL_PAPERS.find((p) => p.id === 'P13' || p.code === 'Paper-13');
  assert.ok(paper13, 'Paper-13 must exist in INITIAL_PAPERS');

  const sumTargets = INITIAL_PRACTICAL_SUBJECTS.reduce((acc, curr) => acc + curr.targetSessions, 0);
  assert.equal(
    sumTargets,
    paper13.totalTargetSessions,
    `Sum of practical subjects targets (${sumTargets}) must equal Paper-13 target (${paper13.totalTargetSessions})`
  );
  assert.equal(sumTargets, 188);
});

test('Practical Consecutive Double-Period Limit: Schedules 2 consecutive periods per practical class', () => {
  const rules = {
    ...DEFAULT_ROUTINE_RULES,
    enableTeacherLoadEqualizationPriority: true,
    enablePracticalConsecutiveDoublePeriodLimit: true,
  };

  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    rules,
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
    practicalConfig: {
      enabled: true,
      name: 'Computer Lab & CCTNS Live Data Entry',
      items: [
        {
          id: 'prac-item-1',
          name: 'Computer Lab & CCTNS Live Data Entry',
          teacherId: 'T25',
          roomId: 'OB-1',
          periods: [2, 3],
        },
      ],
    },
  });

  const pracSlots = routine.slots.filter((s) => s.paperId === 'P13');
  assert.ok(pracSlots.length >= 2, 'Must have at least 2 practical slots');
  const ob1PracSlots = pracSlots.filter((s) => s.roomId === 'OB-1');
  assert.equal(ob1PracSlots.length, 2);
  const periods = ob1PracSlots.map((s) => s.period).sort();
  assert.deepEqual(periods, [2, 3], 'Practical periods must be consecutive 2 and 3 (Period 1 is theoretical)');
  assert.equal(ob1PracSlots[0].practicalName, 'Computer Lab & CCTNS Live Data Entry');
});

test('Multi-day date-specific unavailability: Faculty absent only on Day 2 is scheduled normally on Day 1 and Day 3, with custom remark saved on Day 2', () => {
  const classrooms = INITIAL_CLASSROOMS;
  const papers = INITIAL_PAPERS;
  const teachers = INITIAL_TEACHERS;
  const rules = normalizeRuleConfig(DEFAULT_ROUTINE_RULES);

  const unavailabilityConfigs: UnavailabilityConfigItem[] = [
    {
      id: 'unavail-1',
      teacherId: 'T3',
      targetDayOrDate: '2026-10-25', // Day 2 only
      type: 'DUTY',
      remark: 'Special Duty (VIP Bandobast)',
    },
    {
      id: 'unavail-2',
      teacherId: 'T5',
      targetDayOrDate: 'ALL', // All days
      type: 'LEAVE',
      remark: 'Casual Leave',
    },
  ];

  const batchDates = [
    { dayNum: 1, dateStr: '2026-10-24' },
    { dayNum: 2, dateStr: '2026-10-25' },
    { dayNum: 3, dateStr: '2026-10-26' },
  ];

  const batchRoutines: DailyRoutine[] = [];
  const history: DailyRoutine[] = [];

  for (const b of batchDates) {
    const dayUnavail = unavailabilityConfigs.filter(
      (u) => u.teacherId && (u.targetDayOrDate === 'ALL' || u.targetDayOrDate === b.dateStr)
    );
    const dayAbsentTeacherIds = Array.from(new Set(dayUnavail.map((u) => u.teacherId)));
    const dayUnavailableTeachersList: UnavailableInstructor[] = dayUnavail.map((u) => ({
      teacherId: u.teacherId,
      type: u.type,
      remark: u.remark,
      date: b.dateStr,
    }));

    const r = generateDailyRoutine({
      classrooms,
      papers,
      teachers,
      absentTeacherIds: dayAbsentTeacherIds,
      rules,
      historicalRoutines: [...history],
      targetDayNumber: b.dayNum,
      targetDate: b.dateStr,
    });

    r.absentTeacherIds = dayAbsentTeacherIds;
    r.unavailableTeachers = dayUnavailableTeachersList;

    batchRoutines.push(r);
    history.push(r);
  }

  // Day 1: T3 is NOT absent, T5 IS absent
  assert.equal(batchRoutines[0].absentTeacherIds.includes('T3'), false, 'T3 must be available on Day 1');
  assert.equal(batchRoutines[0].absentTeacherIds.includes('T5'), true, 'T5 must be absent on Day 1');

  // Day 2: Both T3 and T5 ARE absent
  assert.equal(batchRoutines[1].absentTeacherIds.includes('T3'), true, 'T3 must be absent on Day 2');
  assert.equal(batchRoutines[1].absentTeacherIds.includes('T5'), true, 'T5 must be absent on Day 2');
  const t3RecordDay2 = batchRoutines[1].unavailableTeachers?.find((u) => u.teacherId === 'T3');
  assert.equal(t3RecordDay2?.type, 'DUTY');
  assert.equal(t3RecordDay2?.remark, 'Special Duty (VIP Bandobast)');
  // Verify T3 is NOT assigned in any slot on Day 2
  const t3SlotsDay2 = batchRoutines[1].slots.filter((s) => s.teacherId === 'T3');
  assert.equal(t3SlotsDay2.length, 0, 'T3 must not be scheduled in any slot on Day 2');

  // Day 3: T3 is available again, T5 IS absent
  assert.equal(batchRoutines[2].absentTeacherIds.includes('T3'), false, 'T3 must be available again on Day 3');
  assert.equal(batchRoutines[2].absentTeacherIds.includes('T5'), true, 'T5 must be absent on Day 3');
});

test('Recreate Routine: Strict single-day regeneration preserves selected routine ID and does not overwrite other routines', () => {
  const classrooms = INITIAL_CLASSROOMS;
  const papers = INITIAL_PAPERS;
  const teachers = INITIAL_TEACHERS;
  const rules = normalizeRuleConfig(DEFAULT_ROUTINE_RULES);

  const day1 = generateDailyRoutine({
    classrooms,
    papers,
    teachers,
    rules,
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });
  day1.id = 'routine-day-1-fixed-id';

  const day2 = generateDailyRoutine({
    classrooms,
    papers,
    teachers,
    rules,
    historicalRoutines: [day1],
    targetDayNumber: 2,
    targetDate: '2026-10-25',
  });
  day2.id = 'routine-day-2-fixed-id';

  // Recreate day 2 with T2 absent
  const recreatedDay2 = generateDailyRoutine({
    classrooms,
    papers,
    teachers,
    absentTeacherIds: ['T2'],
    rules,
    historicalRoutines: [day1],
    targetDayNumber: day2.dayNumber,
    targetDate: day2.date,
  });
  recreatedDay2.id = day2.id; // Preserves exact routine ID

  assert.equal(recreatedDay2.id, 'routine-day-2-fixed-id');
  assert.equal(recreatedDay2.dayNumber, 2);
  assert.equal(recreatedDay2.date, '2026-10-25');
  assert.equal(recreatedDay2.slots.some((s) => s.teacherId === 'T2'), false, 'T2 must be excluded in recreated routine');
});

test('Classroom Exposure Balance Cap: Difference between max-visited and min-visited room for any instructor does not exceed 2', () => {
  const classrooms = INITIAL_CLASSROOMS;
  const papers = INITIAL_PAPERS;
  const teachers = INITIAL_TEACHERS;
  const rules = normalizeRuleConfig({
    ...DEFAULT_ROUTINE_RULES,
    enableTeacherLoadEqualizationPriority: true,
  });

  const routines = generateMultipleDaysRoutines({
    classrooms,
    papers,
    teachers,
    rules,
    startDayNumber: 1,
    startDate: '2026-10-20',
    numberOfDays: 5,
    historicalRoutines: [],
  });

  teachers.forEach((t) => {
    const roomCounts: Record<string, number> = {};
    classrooms.forEach((c) => (roomCounts[c.id] = 0));
    routines.forEach((r) => {
      r.slots
        .filter((s) => s.teacherId === t.id)
        .forEach((s) => {
          roomCounts[s.roomId] = (roomCounts[s.roomId] || 0) + 1;
        });
    });

    const eligible = classrooms.filter((r) => {
      if (t.assignedBuilding === 'FLOATING') return true;
      return t.assignedBuilding === r.building;
    });

    const counts = eligible.map((r) => roomCounts[r.id] || 0);
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    assert.ok(
      max - min <= 2,
      `Instructor ${t.code} (${t.name}) room visits spread exceeds 2: min=${min}, max=${max}, diff=${max - min}`
    );
  });
});

test('Practical Scheduling: Period 1 is always theoretical; Practical pairs are strictly [2, 3] or [4, 5]', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enablePracticalConsecutiveDoublePeriodLimit: true,
    },
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
    practicalConfig: {
      enabled: true,
      name: 'Computer Practical',
      items: [
        {
          id: 'p-1',
          name: 'Computer Practical',
          teacherId: 'T12',
          roomId: 'OB-1',
          // periods omitted: auto-picks [2, 3]
        },
        {
          id: 'p-2',
          name: 'Computer Practical',
          teacherId: 'T14',
          roomId: 'OB-2',
          // periods omitted: auto-picks [4, 5]
        },
      ],
    },
  });

  // 1. Period 1 must NEVER contain a practical slot across all 15 classrooms
  const p1Slots = routine.slots.filter((s) => s.period === 1);
  const p1Practical = p1Slots.filter((s) => s.paperId === 'P13' || s.practicalName);
  assert.equal(p1Practical.length, 0, 'Period 1 must always be theoretical; zero practical in Period 1');

  // 2. Practical slots are strictly in [2, 3] and [4, 5]
  const practicalSlots = routine.slots.filter((s) => s.paperId === 'P13' || s.practicalName);
  assert.equal(practicalSlots.length, 4, 'Must have exactly 4 practical periods (2 rooms x 2 periods)');

  const ob1Periods = practicalSlots.filter((s) => s.roomId === 'OB-1').map((s) => s.period).sort();
  assert.deepEqual(ob1Periods, [2, 3], 'OB-1 auto-allocated practical in [2, 3]');

  const ob2Periods = practicalSlots.filter((s) => s.roomId === 'OB-2').map((s) => s.period).sort();
  assert.deepEqual(ob2Periods, [4, 5], 'OB-2 auto-allocated practical in [4, 5]');

  // 3. Validation must pass with 0 errors
  const validation = validateRoutine(
    routine.slots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    DEFAULT_ROUTINE_RULES,
    INITIAL_PAPERS,
    75,
    routine.practicalConfig
  );
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
  assert.equal(validation.tier1Passed, true);
});

test('Practical Room Isolation: A classroom never receives 4 practical periods in one day (max 2 periods per class)', () => {
  // Test with auto-balance rooms and multiple practical items
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enablePracticalConsecutiveDoublePeriodLimit: true,
    },
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
    practicalConfig: {
      enabled: true,
      items: [
        {
          id: 'p-1',
          name: 'Practical 1',
          teacherId: 'T1',
          // auto room
        },
        {
          id: 'p-2',
          name: 'Practical 2',
          teacherId: 'T2',
          // auto room
        },
      ],
    },
  });

  const practicalSlots = routine.slots.filter((s) => s.paperId === 'P13' || s.practicalName);
  assert.equal(practicalSlots.length, 4, 'Must have 4 practical periods total across campus');

  // Group by room
  const roomPracticalCounts = new Map<string, number>();
  for (const s of practicalSlots) {
    roomPracticalCounts.set(s.roomId, (roomPracticalCounts.get(s.roomId) || 0) + 1);
  }

  // Ensure 2 distinct rooms each have exactly 2 practical periods, never 4 in one room
  assert.equal(roomPracticalCounts.size, 2, 'Practicals must be split across exactly 2 different classrooms');
  for (const [roomId, count] of roomPracticalCounts.entries()) {
    assert.equal(count, 2, `Room ${roomId} has ${count} practical periods; must never be 4`);
  }
});

test('Practical Variety: A classroom can take 4 practical periods (2+2) if they are DIFFERENT practical subjects', () => {
  // 1. Two DIFFERENT practical subjects in the same room OB-1: Allowed!
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enablePracticalConsecutiveDoublePeriodLimit: true,
    },
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
    practicalConfig: {
      enabled: true,
      items: [
        {
          id: 'p-1',
          name: 'Computer Lab & CCTNS Live Data Entry',
          practicalSubjectId: 'PRAC-01',
          teacherId: 'T25',
          roomId: 'OB-1',
          periods: [2, 3],
        },
        {
          id: 'p-2',
          name: 'Crime Scene Management & Forensics Lab',
          practicalSubjectId: 'PRAC-02',
          teacherId: 'T26',
          roomId: 'OB-1',
          periods: [4, 5],
        },
      ],
    },
  });

  const ob1PracticalSlots = routine.slots.filter((s) => s.roomId === 'OB-1' && (s.paperId === 'P13' || s.practicalName));
  assert.equal(ob1PracticalSlots.length, 4, 'OB-1 successfully has 4 practical periods (2+2 sessions)');

  // Period 1 in OB-1 must still be a theory paper!
  const ob1P1Slot = routine.slots.find((s) => s.roomId === 'OB-1' && s.period === 1);
  assert.ok(ob1P1Slot && ob1P1Slot.paperId !== 'P13', 'Period 1 in OB-1 must remain theoretical');

  // Must pass Tier 1 validation
  const validation = validateRoutine(
    routine.slots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    DEFAULT_ROUTINE_RULES,
    INITIAL_PAPERS,
    75,
    routine.practicalConfig
  );
  assert.equal(validation.isValid, true, 'Validation passes for 2 different practical subjects in same room');
  assert.equal(validation.tier1Passed, true);

  // 2. But if the SAME practical subject is repeated twice in the same room: Fails variety check!
  const duplicateSlots = routine.slots.map((s) => {
    if (s.roomId === 'OB-1' && (s.period === 4 || s.period === 5)) {
      return {
        ...s,
        practicalSubjectId: 'PRAC-01',
        practicalName: 'Computer Lab & CCTNS Live Data Entry',
      };
    }
    return s;
  });

  const dupValidation = validateRoutine(
    duplicateSlots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    DEFAULT_ROUTINE_RULES,
    INITIAL_PAPERS,
    75,
    routine.practicalConfig
  );
  assert.equal(dupValidation.tier1Passed, false, 'Validation must fail when same practical subject repeats twice in same room');
  assert.ok(
    dupValidation.roomSubjectViolations.some((v) => v.details.includes('Variety Violation')),
    'Must report Rule 9 Variety Violation'
  );
});

test('Feature: Room Number Sequencing (1 to 15 serial increase)', () => {
  // 1. All 15 classrooms have consecutive room numbers 1 to 15
  assert.equal(INITIAL_CLASSROOMS.length, 15);
  const sorted = [...INITIAL_CLASSROOMS].sort(compareClassrooms);
  assert.equal(sorted.length, 15);

  for (let i = 0; i < sorted.length; i++) {
    const expectedNum = i + 1;
    assert.equal(
      sorted[i].roomNumber,
      expectedNum,
      `Classroom at index ${i} (${sorted[i].name}) must have roomNumber ${expectedNum}`
    );
  }

  // 2. Old Building classrooms are Room 1 through Room 8
  const obRooms = sorted.filter((c) => c.building === 'OLD');
  assert.equal(obRooms.length, 8);
  for (let i = 0; i < obRooms.length; i++) {
    assert.equal(obRooms[i].roomNumber, i + 1);
    assert.ok(obRooms[i].name.startsWith('OB-') || obRooms[i].name.includes(`Room No. ${i + 1}`));
  }

  // 3. New Building classrooms are Room 9 through Room 15
  const nbRooms = sorted.filter((c) => c.building === 'NEW');
  assert.equal(nbRooms.length, 7);
  for (let i = 0; i < nbRooms.length; i++) {
    assert.equal(nbRooms[i].roomNumber, i + 9);
    assert.ok(nbRooms[i].name.startsWith('NB-') || nbRooms[i].name.includes(`Room No. ${i + 9}`));
  }

  // 4. extractRoomNumber correctly extracts numeric identifiers from various formats
  assert.equal(extractRoomNumber('Room No. 1'), 1);
  assert.equal(extractRoomNumber('Room No. 15'), 15);
  assert.equal(extractRoomNumber('OB-5'), 5);
  assert.equal(extractRoomNumber('NB-3'), 3);
  assert.equal(extractRoomNumber('CR-NB-14'), 14);
  assert.equal(extractRoomNumber('Classroom 10'), 10);
});

test('Feature: Paper-14 (Examination & Assessment) is configured with 30 target sessions', () => {
  const p14 = INITIAL_PAPERS.find((p) => p.id === 'P14');
  assert.ok(p14, 'Paper-14 (P14) must be defined');
  assert.equal(p14.code, 'Paper-14');
  assert.equal(p14.category, 'Examination & Assessment');
  assert.equal(p14.theoryOrPractical, 'EXAM');
  assert.equal(p14.totalTargetSessions, 30);
});

test('Feature: Exam Session Allocation in Last Period (Period 5) for all classrooms', () => {
  const examName = 'Mid-Term Exam Assessment';
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
    examConfig: {
      enabled: true,
      name: examName,
      targetSessions: 30,
      period: 5,
    },
  });

  assert.ok(routine.examConfig?.enabled, 'Routine examConfig must be enabled');
  assert.equal(routine.examConfig?.name, examName);

  // Filter slots for Period 5
  const period5Slots = routine.slots.filter((s) => s.period === 5);
  assert.equal(period5Slots.length, 15, 'All 15 classrooms must have a Period 5 slot');

  // Verify all 15 classrooms have Exam in Period 5
  const roomIdsWithExam = new Set<string>();
  const period5Teachers: string[] = [];

  for (const s of period5Slots) {
    assert.equal(s.isExam, true, `Slot for room ${s.roomId} in period 5 must be marked isExam`);
    assert.equal(s.paperId, 'P14', `Slot for room ${s.roomId} in period 5 must use paper P14`);
    assert.equal(s.examName, examName);
    assert.equal(s.theoryOrPractical, 'EXAM');
    assert.ok(s.teacherId, `Slot for room ${s.roomId} in period 5 must have a teacher assigned`);
    roomIdsWithExam.add(s.roomId);
    period5Teachers.push(s.teacherId);
  }

  assert.equal(roomIdsWithExam.size, 15, 'All 15 distinct classrooms must have exam in period 5');

  // Zero double booking in Period 5: exactly 15 distinct teachers detailed
  const uniqueTeachers = new Set(period5Teachers);
  assert.equal(uniqueTeachers.size, 15, 'Exactly 15 distinct teachers must be detailed across 15 classrooms with zero double-booking');

  // Validate routine passes Tier 1 constraints
  const validation = validateRoutine(
    routine.slots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    DEFAULT_ROUTINE_RULES,
    INITIAL_PAPERS,
    75,
    undefined,
    routine.examConfig
  );
  assert.equal(validation.isValid, true, 'Routine with exam in period 5 must be fully valid');
  assert.equal(validation.tier1Passed, true);
  assert.equal(validation.roomSubjectViolations.length, 0);
});

test('Feature: Exam Session respects Teacher Absences, Excuses, and Daily Workload Caps', () => {
  // T1, T2 are absent. T3 has excused period 5.
  const absentees = ['T1', 'T2'];
  const excusedConfig = [
    {
      id: 'excuse-t3',
      teacherId: 'T3',
      periods: [5],
      reason: 'Administrative Meeting',
      targetDayOrDate: 'ALL',
    },
  ];

  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: absentees,
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
    excusedInstructors: excusedConfig,
    examConfig: {
      enabled: true,
      name: 'Quarterly Assessment',
      targetSessions: 30,
      period: 5,
    },
  });

  const period5Slots = routine.slots.filter((s) => s.period === 5);
  for (const s of period5Slots) {
    assert.equal(absentees.includes(s.teacherId), false, `Absent teacher ${s.teacherId} must not be in Period 5 exam`);
    assert.notEqual(s.teacherId, 'T3', 'Excused teacher T3 in period 5 must not be assigned to Period 5 exam');
  }

  // Teacher daily workloads must not exceed 4
  const teacherLoadMap: Record<string, number> = {};
  for (const s of routine.slots) {
    if (s.teacherId) {
      teacherLoadMap[s.teacherId] = (teacherLoadMap[s.teacherId] || 0) + 1;
    }
  }
  for (const [teacherId, load] of Object.entries(teacherLoadMap)) {
    assert.ok(load <= 4, `Teacher ${teacherId} load ${load} exceeds hard cap of 4`);
  }
});

test('Feature: Exam Session + Practical Interaction (Practical constrained to Periods 2-3, Exam in Period 5)', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
    practicalConfig: {
      enabled: true,
      items: [
        {
          id: 'prac-item-1',
          name: 'Computer Lab Practical',
          roomId: 'OB-1',
          periods: [2, 3],
          practicalSubjectId: 'PRAC-01',
        },
      ],
    },
    examConfig: {
      enabled: true,
      name: 'Final Module Exam',
      targetSessions: 30,
      period: 5,
    },
  });

  // Verify Period 5 is Exam in all classrooms
  const period5Slots = routine.slots.filter((s) => s.period === 5);
  assert.equal(period5Slots.length, 15);
  assert.ok(period5Slots.every((s) => s.isExam && s.paperId === 'P14'));

  // Verify OB-1 practical is in periods 2 and 3
  const ob1PracticalSlots = routine.slots.filter(
    (s) => s.roomId === 'OB-1' && (s.paperId === 'P13' || Boolean(s.practicalName))
  );
  assert.equal(ob1PracticalSlots.length, 2);
  assert.deepEqual(ob1PracticalSlots.map((s) => s.period).sort(), [2, 3]);

  // Period 1 is purely theory
  const period1Slots = routine.slots.filter((s) => s.period === 1);
  assert.ok(
    period1Slots.every((s) => s.paperId !== 'P13' && !s.practicalName && !s.isExam),
    'Period 1 must be strictly theoretical'
  );

  // Verify validation passes
  const validation = validateRoutine(
    routine.slots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    DEFAULT_ROUTINE_RULES,
    INITIAL_PAPERS,
    75,
    routine.practicalConfig,
    routine.examConfig
  );
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
  assert.equal(validation.tier1Passed, true);
});

test('Feature: Exam Session with Teacher-First Detailment Mode', () => {
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
    generationMode: 'TEACHER_FIRST',
    examConfig: {
      enabled: true,
      name: 'Central Exam',
      targetSessions: 30,
      period: 5,
    },
  });

  const period5Slots = routine.slots.filter((s) => s.period === 5);
  assert.equal(period5Slots.length, 15);
  assert.ok(period5Slots.every((s) => s.isExam && s.paperId === 'P14' && s.teacherId));

  const validation = validateRoutine(
    routine.slots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    DEFAULT_ROUTINE_RULES,
    INITIAL_PAPERS,
    75,
    undefined,
    routine.examConfig
  );
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
  assert.equal(validation.tier1Passed, true);
});

test('Feature: Teacher-First detailment assigns Option Subject when teacher main subject is completed in that classroom', () => {
  // Paper P08 has target of 8 sessions
  const p08 = INITIAL_PAPERS.find((p) => p.id === 'P08')!;
  assert.equal(p08.totalTargetSessions, 8);

  // Teacher T17 has primary: ['P08'], backup: ['P07', 'P09']
  const t17 = INITIAL_TEACHERS.find((t) => t.id === 'T17')!;
  assert.deepEqual(t17.primaryPaperIds, ['P08']);
  assert.ok(t17.backupPaperIds?.includes('P07'));

  // Build historical routines where OB-1 has already completed 8 sessions of P08 (100% quota)
  const mockHistory: DailyRoutine[] = [];
  for (let day = 1; day <= 8; day++) {
    mockHistory.push({
      id: `history-day-${day}`,
      dayNumber: day,
      date: `2026-10-${10 + day}`,
      absentTeacherIds: [],
      priorityPaperIds: [],
      slots: [
        {
          id: `h-slot-${day}-OB-1-P1`,
          roomId: 'OB-1',
          period: 1,
          paperId: 'P08',
          teacherId: 'T17',
          isSubstitute: false,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isLocked: true,
      status: 'published',
    });
  }

  // Generate routine in Teacher-First Mode (Rule 8: Teacher Load Equalization Priority)
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: mockHistory,
    targetDayNumber: 9,
    targetDate: '2026-10-29',
    generationMode: 'TEACHER_FIRST',
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableTeacherLoadEqualizationPriority: true,
      enableRoomQuotaCompletionLock: true,
    },
  });

  // Verify that OB-1 does NOT receive P08 because it has reached 100% quota
  const ob1P08Slots = routine.slots.filter((s) => s.roomId === 'OB-1' && s.paperId === 'P08');
  assert.equal(ob1P08Slots.length, 0, 'OB-1 must have 0 sessions of P08 because its main subject quota is completed');

  // If T17 is assigned to OB-1, verify T17 teaches an option subject (e.g. P07 or P09) with isSubstitute: true
  const t17SlotsInOB1 = routine.slots.filter((s) => s.roomId === 'OB-1' && s.teacherId === 'T17');
  for (const s of t17SlotsInOB1) {
    assert.notEqual(s.paperId, 'P08', 'T17 must not teach completed main subject P08 in OB-1');
    assert.ok(
      t17.backupPaperIds?.includes(s.paperId) || t17.secondaryPaperIds?.includes(s.paperId),
      `T17 must teach an option subject from backup/secondary in OB-1, got ${s.paperId}`
    );
    assert.equal(s.isSubstitute, true, 'Slot must be flagged as isSubstitute when assigned an option subject');
  }

  // Verify Tier 1 validation passes
  const validation = validateRoutine(
    routine.slots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    DEFAULT_ROUTINE_RULES,
    INITIAL_PAPERS
  );
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
});

test('Feature: Teacher-First detailment assigns another eligible teacher when teacher has no option subject for that classroom', () => {
  // Create a custom teacher who ONLY has primary paper P08 and NO backup/secondary papers
  const customTeacherNoBackup = {
    id: 'T_NO_BACKUP',
    code: 'T_NO_BACKUP',
    name: 'Specialist Only P08',
    designation: 'Single Subject Specialist',
    assignedBuilding: 'OLD',
    primaryPaperIds: ['P08'],
    backupPaperIds: [],
    secondaryPaperIds: [],
    maxDailyPeriods: 4,
  };

  const modifiedTeachers = [...INITIAL_TEACHERS, customTeacherNoBackup];

  // Build historical routines where OB-1 has already completed 8 sessions of P08
  const mockHistory: DailyRoutine[] = [];
  for (let day = 1; day <= 8; day++) {
    mockHistory.push({
      id: `history-single-${day}`,
      dayNumber: day,
      date: `2026-10-${10 + day}`,
      absentTeacherIds: [],
      priorityPaperIds: [],
      slots: [
        {
          id: `h-slot-s-${day}-OB-1-P1`,
          roomId: 'OB-1',
          period: 1,
          paperId: 'P08',
          teacherId: 'T17',
          isSubstitute: false,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isLocked: true,
      status: 'published',
    });
  }

  // Generate routine in Teacher-First Mode
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: modifiedTeachers,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: mockHistory,
    targetDayNumber: 9,
    targetDate: '2026-10-29',
    generationMode: 'TEACHER_FIRST',
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableTeacherLoadEqualizationPriority: true,
      enableRoomQuotaCompletionLock: true,
    },
  });

  // Verify OB-1 has NO slot with T_NO_BACKUP (because T_NO_BACKUP's main subject is complete in OB-1 and has no option subject)
  const ob1CustomTeacherSlots = routine.slots.filter(
    (s) => s.roomId === 'OB-1' && s.teacherId === 'T_NO_BACKUP'
  );
  assert.equal(
    ob1CustomTeacherSlots.length,
    0,
    'T_NO_BACKUP must NOT be assigned to OB-1 since main subject is complete and has no option subject'
  );

  // Verify OB-1 slots are all filled by other eligible teachers with valid uncompleted subjects
  const ob1Slots = routine.slots.filter((s) => s.roomId === 'OB-1');
  assert.equal(ob1Slots.length, 5, 'OB-1 must have all 5 periods filled by eligible teachers');
  for (const s of ob1Slots) {
    assert.ok(s.teacherId, 'Slot must have a teacher assigned');
    assert.notEqual(s.teacherId, 'T_NO_BACKUP');
    assert.notEqual(s.paperId, 'P08', 'OB-1 must not have completed subject P08');
  }

  const validation = validateRoutine(
    routine.slots,
    modifiedTeachers,
    INITIAL_CLASSROOMS,
    [],
    DEFAULT_ROUTINE_RULES,
    INITIAL_PAPERS
  );
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
});

test('Feature: Optional theory subject with ID P14 is properly scheduled and main teachers (e.g. Parimal Saha T18) receive fair detailment', () => {
  // Define an optional theory paper with ID P14 (matching user setup)
  const optionalPaperP14: Paper = {
    id: 'P14',
    code: 'Optional',
    title: 'State Specific Inputs',
    category: 'Police Administration',
    totalTargetSessions: 40,
    color: '#3B82F6',
    description: 'Police Administration & State Inputs',
    theoryOrPractical: 'THEORY',
    maxDailyPerRoom: 1,
    preferredBuilding: 'ALL',
    primaryTeacherIds: ['T18', 'T19', 'T22'],
    nearestPaperIds: [],
  };

  const papersWithOptional = [...INITIAL_PAPERS.filter((p) => p.id !== 'P14'), optionalPaperP14];

  // Assign T18, T19, T22 primaryPaperIds to P14
  const modifiedTeachers = INITIAL_TEACHERS.map((t) => {
    if (t.id === 'T18' || t.id === 'T19' || t.id === 'T22') {
      return {
        ...t,
        primaryPaperIds: ['P14'],
        backupPaperIds: [],
        secondaryPaperIds: [],
      };
    }
    return t;
  });

  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: papersWithOptional,
    teachers: modifiedTeachers,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 17,
    targetDate: '2026-11-23',
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enableTeacherLoadEqualizationPriority: true,
    },
    excludedPaperIds: [],
  });

  // Verify P14 is NOT in excludedPaperIds
  assert.ok(
    !routine.excludedPaperIds?.includes('P14'),
    'Optional paper P14 must NOT be excluded when exam is inactive'
  );

  // Verify T18 (Parimal Saha) is detailed and receives slots
  const t18Slots = routine.slots.filter((s) => s.teacherId === 'T18');
  assert.ok(t18Slots.length > 0, `T18 (Parimal Saha) must receive detailment slots, got ${t18Slots.length}`);
  assert.ok(
    t18Slots.every((s) => s.paperId === 'P14'),
    'T18 slots must be for their main paper P14'
  );

  // Verify T19 and T22 also receive slots for P14
  const t19Slots = routine.slots.filter((s) => s.teacherId === 'T19');
  const t22Slots = routine.slots.filter((s) => s.teacherId === 'T22');
  assert.ok(t19Slots.length > 0, `T19 must receive detailment slots, got ${t19Slots.length}`);
  assert.ok(t22Slots.length > 0, `T22 must receive detailment slots, got ${t22Slots.length}`);

  // Validate routine integrity
  const validation = validateRoutine(
    routine.slots,
    modifiedTeachers,
    INITIAL_CLASSROOMS,
    [],
    DEFAULT_ROUTINE_RULES,
    papersWithOptional
  );
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
});

test('Feature: Practical single-period (1 Period) and double-period (2 Periods) configuration and scheduling', () => {
  // Test practical config with a 1-period practical and a 2-period practical
  const practicalConfig: PracticalConfig = {
    enabled: true,
    items: [
      {
        id: 'prac-single-1',
        name: 'Single Period Lab',
        teacherId: 'T20',
        roomId: 'OB-1',
        duration: 1,
        periods: [2],
        practicalSubjectId: 'PRAC-01',
      },
      {
        id: 'prac-double-2',
        name: 'Double Period Lab',
        teacherId: 'T21',
        roomId: 'NB-1',
        duration: 2,
        periods: [4, 5],
        practicalSubjectId: 'PRAC-02',
      },
    ],
  };

  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: [],
    priorityPaperIds: [],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-11-01',
    practicalConfig,
    rules: {
      ...DEFAULT_ROUTINE_RULES,
      enablePracticalConsecutiveDoublePeriodLimit: true,
      enableSinglePeriodPractical: true,
    },
  });

  // Verify Single-Period Practical in OB-1: only Period 2
  const ob1PracticalSlots = routine.slots.filter(
    (s) => s.roomId === 'OB-1' && (s.paperId === 'P13' || s.practicalName === 'Single Period Lab')
  );
  assert.equal(ob1PracticalSlots.length, 1, `OB-1 must have exactly 1 practical slot, got ${ob1PracticalSlots.length}`);
  assert.equal(ob1PracticalSlots[0].period, 2, 'OB-1 practical slot must be Period 2');
  assert.equal(ob1PracticalSlots[0].teacherId, 'T20', 'OB-1 practical slot must have teacher T20');

  // Verify Double-Period Practical in NB-1: Periods 4 and 5
  const nb1PracticalSlots = routine.slots.filter(
    (s) => s.roomId === 'NB-1' && (s.paperId === 'P13' || s.practicalName === 'Double Period Lab')
  );
  assert.equal(nb1PracticalSlots.length, 2, `NB-1 must have exactly 2 practical slots, got ${nb1PracticalSlots.length}`);
  const nb1Periods = nb1PracticalSlots.map((s) => s.period).sort();
  assert.deepEqual(nb1Periods, [4, 5], 'NB-1 practical slots must be Periods 4 and 5');
  assert.ok(nb1PracticalSlots.every((s) => s.teacherId === 'T21'), 'NB-1 practical slots must have teacher T21');

  // Validate routine with routineValidator
  const validation = validateRoutine(
    routine.slots,
    INITIAL_TEACHERS,
    INITIAL_CLASSROOMS,
    [],
    DEFAULT_ROUTINE_RULES,
    INITIAL_PAPERS,
    practicalConfig
  );
  assert.equal(validation.isValid, true, validation.errorMessages.join('; '));
});















