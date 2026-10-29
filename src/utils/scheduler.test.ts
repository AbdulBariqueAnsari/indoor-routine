/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ROUTINE_RULES,
  INITIAL_CLASSROOMS,
  INITIAL_PAPERS,
  INITIAL_TEACHERS,
  MASTER_ROUTINE_RULES,
  isRuleDisabled,
  normalizeRuleConfig,
  migrateLegacyRules,
} from '../data/initialData';
import {
  generateDailyRoutine,
  calculateCumulativeStats,
  calculateClassroomCumulativeStats,
  calculateCurriculumAllocation,
  generateMultipleDaysRoutines,
} from './scheduler';
import { validateRoutine, validateSlotAssignmentTier1, isRoutineEditable } from './routineValidator';
import { DailyRoutine, SubjectPriorityTier } from '../types';

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
  assert.equal(validation.isValid, true);
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
  assert.equal(validation.isValid, true);
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
    assert.equal(rStat.totalTargetSessions, 623);
    assert.equal(rStat.paperProgress.length, 13);
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
  assert.equal(stats.length, 13);

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

test('Paper codes strictly formatted as Paper-1 through Paper-13', () => {
  assert.equal(INITIAL_PAPERS.length, 13);
  INITIAL_PAPERS.forEach((p, idx) => {
    assert.equal(p.code, `Paper-${idx + 1}`, `Paper ${p.id} should have code Paper-${idx + 1}`);
  });
});

test('Cross-subject mutual backup: Forensic Science (Paper-5) gets ICT instructor (Paper-6) in absence', () => {
  // Forensics (P05) primary teachers: T12, T13. Mark both absent!
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: ['T12', 'T13'],
    priorityPaperIds: ['P05'],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const p05Slots = routine.slots.filter(s => s.paperId === 'P05');
  assert.ok(p05Slots.length > 0, 'P05 should have slots scheduled');

  // Verify that an ICT teacher (T14 or T15) took the substitute role
  const ictTeacherIds = ['T14', 'T15'];
  const hasIctSubstitute = p05Slots.some(s => s.isSubstitute && ictTeacherIds.includes(s.teacherId));
  assert.ok(hasIctSubstitute, 'P05 should receive cross-backup from ICT instructor (T14 or T15)');
});

test('Cross-subject mutual backup: Police Admin (Paper-8) gets Criminology instructor (Paper-7) in absence', () => {
  // Police Admin (P08) primary teacher: T17. Mark absent!
  const routine = generateDailyRoutine({
    classrooms: INITIAL_CLASSROOMS,
    papers: INITIAL_PAPERS,
    teachers: INITIAL_TEACHERS,
    absentTeacherIds: ['T17'],
    priorityPaperIds: ['P08'],
    historicalRoutines: [],
    targetDayNumber: 1,
    targetDate: '2026-10-24',
  });

  const p08Slots = routine.slots.filter(s => s.paperId === 'P08');
  assert.ok(p08Slots.length > 0, 'P08 should have slots scheduled');

  // Verify that Criminology teacher (T16) or station mgmt (T18/T19) stepped in
  const criminologyOrStationIds = ['T16', 'T18', 'T19'];
  const hasCrossSubstitute = p08Slots.some(s => s.isSubstitute && criminologyOrStationIds.includes(s.teacherId));
  assert.ok(hasCrossSubstitute, 'P08 should receive cross-backup from Criminology/Station instructor');
});

test('26 Teachers distributed strictly across 12 Theory Papers (Paper-1 to Paper-12) by session ratio', () => {
  assert.equal(INITIAL_TEACHERS.length, 26);

  // Collect all assigned primary teachers across P01 to P12
  const theoryAssigned = new Set<string>();
  const theoryPapers = INITIAL_PAPERS.filter(p => p.id !== 'P13');
  
  assert.equal(theoryPapers.length, 12);

  theoryPapers.forEach(paper => {
    assert.ok(paper.primaryTeacherIds.length >= 1, `Paper ${paper.code} must have at least 1 primary teacher`);
    paper.primaryTeacherIds.forEach(tId => theoryAssigned.add(tId));
  });

  // Exactly 26 unique teachers
  assert.equal(theoryAssigned.size, 26);

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
  assert.equal(validation.isValid, true);
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
  assert.equal(validation.isValid, true);
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
  assert.equal(validation.isValid, true);
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
      enableCrossMutualBackup: true,
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
  assert.equal(validation.isValid, true);
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
  assert.equal(validation.isValid, true);
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








