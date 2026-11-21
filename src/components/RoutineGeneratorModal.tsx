/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Classroom,
  ClassSlot,
  compareClassrooms,
  compareTeacherCodes,
  DailyRoutine,
  ExamConfig,
  Paper,
  PracticalClassConfig,
  PracticalConfig,
  PracticalSubject,
  RoutineRuleConfig,
  SubjectPriorityTier,
  Teacher,
  UnavailableInstructor,
  UnavailabilityConfigItem,
  UnavailabilityType,
} from '../types';
import { calculateCumulativeStats, generateDailyRoutine } from '../utils/scheduler';
import {
  DEFAULT_ROUTINE_RULES,
  INITIAL_PRACTICAL_SUBJECTS,
  MASTER_ROUTINE_RULES,
  isRuleDisabled,
  normalizeRuleConfig,
} from '../data/initialData';
import { useModalAnimation } from '../hooks/useModalAnimation';
import {
  AlertCircle,
  Ban,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FilePlus,
  FileText,
  Filter,
  FlaskConical,
  HeartPulse,
  Info,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  UserX,
  X,
} from 'lucide-react';

export interface PracticalConfigItemUI {
  id: string;
  practicalSubjectId: string;
  name: string;
  teacherId: string;
  roomId: string;
  duration?: 1 | 2;
  periods: number[];
  targetDayOrDate: string; // 'ALL' or specific date string 'YYYY-MM-DD'
}

interface RoutineGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoutineGenerated: (newRoutine: DailyRoutine | DailyRoutine[]) => void;
  classrooms: Classroom[];
  papers: Paper[];
  teachers: Teacher[];
  historicalRoutines: DailyRoutine[];
  recreatingRoutine?: DailyRoutine | null;
  rules?: RoutineRuleConfig;
  practicalSubjects?: PracticalSubject[];
}

export const RoutineGeneratorModal: React.FC<RoutineGeneratorModalProps> = ({
  isOpen,
  onClose,
  onRoutineGenerated,
  classrooms,
  papers,
  teachers,
  historicalRoutines,
  recreatingRoutine,
  rules,
  practicalSubjects,
}) => {
  const { shouldRender, backdropAnimationClass, modalAnimationClass } = useModalAnimation(isOpen);

  const [localRules, setLocalRules] = useState<RoutineRuleConfig>(
    normalizeRuleConfig(rules || DEFAULT_ROUTINE_RULES)
  );
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);

  const isRecreating = !!recreatingRoutine;

  // Day number
  const dayNumber = isRecreating
    ? recreatingRoutine.dayNumber
    : historicalRoutines.length > 0
    ? Math.max(...historicalRoutines.map((r) => r.dayNumber)) + 1
    : 1;

  // Calculate default date
  const getDefaultDate = () => {
    if (isRecreating && recreatingRoutine) return recreatingRoutine.date;
    if (historicalRoutines.length === 0) return new Date().toISOString().split('T')[0];
    const sorted = [...historicalRoutines].sort((a, b) => b.dayNumber - a.dayNumber);
    const lastDate = new Date(sorted[0].date);
    lastDate.setDate(lastDate.getDate() + 1);
    return lastDate.toISOString().split('T')[0];
  };

  const [date, setDate] = useState<string>(getDefaultDate());

  // Generation Mode: 'single' | 'multiple' | 'blank'
  // When recreating an active routine, strictly locked to 'single'
  const [generationMode, setGenerationMode] = useState<'single' | 'multiple' | 'blank'>('single');
  const [multiDayCount, setMultiDayCount] = useState<number>(3);

  // Format date helper for UI
  const formatDisplayDate = (dStr: string): string => {
    if (!dStr) return '';
    const [y, m, d] = dStr.split('-');
    if (!y || !m || !d) return dStr;
    return `${d}/${m}/${y}`;
  };

  // Pre-calculated batch dates for multi-day mode
  const batchDates = useMemo(() => {
    const list: { dayNum: number; dateStr: string }[] = [];
    for (let d = 0; d < multiDayCount; d++) {
      const dDate = new Date(date);
      dDate.setDate(dDate.getDate() + d);
      list.push({
        dayNum: dayNumber + d,
        dateStr: dDate.toISOString().split('T')[0],
      });
    }
    return list;
  }, [date, dayNumber, multiDayCount]);

  // Unavailability Items state (Date/Day wise with custom note, just like practical items)
  const [unavailabilityItems, setUnavailabilityItems] = useState<UnavailabilityConfigItem[]>(() => {
    if (recreatingRoutine?.unavailableTeachers && recreatingRoutine.unavailableTeachers.length > 0) {
      return recreatingRoutine.unavailableTeachers.map((u, idx) => ({
        id: `unavail-${idx + 1}`,
        teacherId: u.teacherId,
        targetDayOrDate: u.date || recreatingRoutine.date,
        type: u.type,
        remark: u.remark || '',
      }));
    }
    if (recreatingRoutine?.absentTeacherIds && recreatingRoutine.absentTeacherIds.length > 0) {
      return recreatingRoutine.absentTeacherIds.map((tid, idx) => ({
        id: `unavail-${idx + 1}`,
        teacherId: tid,
        targetDayOrDate: recreatingRoutine.date,
        type: 'ABSENT',
        remark: '',
      }));
    }
    return [];
  });

  const addUnavailabilityItem = () => {
    const nextIdx = unavailabilityItems.length + 1;
    const usedIds = new Set(unavailabilityItems.map((u) => u.teacherId));
    const firstFreeTeacher = teachers.find((t) => !usedIds.has(t.id)) || teachers[0];
    const newItem: UnavailabilityConfigItem = {
      id: `unavail-${Date.now()}-${nextIdx}`,
      teacherId: firstFreeTeacher ? firstFreeTeacher.id : '',
      targetDayOrDate: generationMode === 'multiple' ? 'ALL' : date,
      type: 'LEAVE',
      remark: 'Casual Leave',
    };
    setUnavailabilityItems((prev) => [...prev, newItem]);
  };

  const updateUnavailabilityItem = (index: number, updates: Partial<UnavailabilityConfigItem>) => {
    setUnavailabilityItems((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], ...updates };
      }
      return copy;
    });
  };

  const removeUnavailabilityItem = (index: number) => {
    setUnavailabilityItems((prev) => prev.filter((_, i) => i !== index));
  };

  const uniqueUnavailableTeacherCount = useMemo(() => {
    return new Set(unavailabilityItems.map((u) => u.teacherId).filter(Boolean)).size;
  }, [unavailabilityItems]);

  const availableTeachersCount = Math.max(0, teachers.length - uniqueUnavailableTeacherCount);

  // Backward compatibility getter for any logic that reads absentTeacherIds
  const absentTeacherIds = useMemo(() => {
    return Array.from(new Set(unavailabilityItems.map((u) => u.teacherId).filter(Boolean)));
  }, [unavailabilityItems]);

  // Classroom natural numeric sorting (Room No. 1 to Room No. 15)
  const sortedClassrooms = useMemo(() => [...classrooms].sort(compareClassrooms), [classrooms]);

  // Exam Sessions Configuration state (Always in last period, Period 5, for all classrooms)
  const [isExamEnabled, setIsExamEnabled] = useState<boolean>(() => {
    if (recreatingRoutine?.examConfig !== undefined) {
      return Boolean(recreatingRoutine.examConfig.enabled);
    }
    return false;
  });
  const [examName, setExamName] = useState<string>(() => {
    return recreatingRoutine?.examConfig?.name || 'Examination / Assessment';
  });

  // Practical Sessions Configuration state (Rule 9: Consecutive double-period)
  const [isPracticalEnabled, setIsPracticalEnabled] = useState<boolean>(() => {
    if (recreatingRoutine?.practicalConfig !== undefined) {
      return recreatingRoutine.practicalConfig.enabled;
    }
    return localRules.enablePracticalConsecutiveDoublePeriodLimit !== false;
  });

  const [practicalItems, setPracticalItems] = useState<PracticalConfigItemUI[]>(() => {
    if (recreatingRoutine?.practicalConfig?.items && recreatingRoutine.practicalConfig.items.length > 0) {
      return recreatingRoutine.practicalConfig.items.map((item, idx) => {
        const itemPeriods = item.periods && item.periods.length > 0 ? item.periods : (idx % 2 === 0 ? [2, 3] : [4, 5]);
        const itemDuration = item.duration || (itemPeriods.length === 1 ? 1 : 2);
        return {
          id: item.id || `prac-${idx + 1}`,
          practicalSubjectId: item.practicalSubjectId || '',
          name: item.name || 'Practical Lab',
          teacherId: item.teacherId || '',
          roomId: item.roomId || '',
          duration: itemDuration as 1 | 2,
          periods: itemPeriods,
          targetDayOrDate: 'ALL',
        };
      });
    }
    const subs = practicalSubjects && practicalSubjects.length > 0 ? practicalSubjects : INITIAL_PRACTICAL_SUBJECTS;
    const initialSub = subs[0];
    const initialDur = initialSub?.defaultDuration || 2;
    return [
      {
        id: `prac-1`,
        practicalSubjectId: initialSub?.id || 'prac-sub-1',
        name: initialSub?.name || 'Computer Lab & CCTNS Live Data Entry',
        teacherId: initialSub?.defaultTeacherId || '',
        roomId: '', // Auto-balance
        duration: initialDur,
        periods: initialDur === 1 ? [2] : [2, 3],
        targetDayOrDate: 'ALL',
      },
    ];
  });

  const addPracticalItem = () => {
    const nextIdx = practicalItems.length + 1;
    const subs = practicalSubjects && practicalSubjects.length > 0 ? practicalSubjects : INITIAL_PRACTICAL_SUBJECTS;
    const usedSubIds = new Set(practicalItems.map((p) => p.practicalSubjectId));
    const nextSub = subs.find((s) => !usedSubIds.has(s.id)) || subs[0];
    const defaultDur = nextSub?.defaultDuration || 2;
    const newItem: PracticalConfigItemUI = {
      id: `prac-${Date.now()}-${nextIdx}`,
      practicalSubjectId: nextSub ? nextSub.id : '',
      name: nextSub ? nextSub.name : 'Practical Session',
      teacherId: nextSub?.defaultTeacherId || '',
      roomId: '',
      duration: defaultDur,
      periods: defaultDur === 1 ? [2] : (nextIdx % 2 === 0 ? [4, 5] : [2, 3]),
      targetDayOrDate: generationMode === 'multiple' ? 'ALL' : date,
    };
    setPracticalItems((prev) => [...prev, newItem]);
  };

  const updatePracticalItem = (index: number, updates: Partial<PracticalConfigItemUI>) => {
    setPracticalItems((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        if (updates.practicalSubjectId && updates.practicalSubjectId !== copy[index].practicalSubjectId) {
          const subs = practicalSubjects && practicalSubjects.length > 0 ? practicalSubjects : INITIAL_PRACTICAL_SUBJECTS;
          const found = subs.find((s) => s.id === updates.practicalSubjectId);
          if (found) {
            updates.name = found.name;
            if (!updates.teacherId && found.defaultTeacherId) {
              updates.teacherId = found.defaultTeacherId;
            }
            if (found.defaultDuration && !updates.duration) {
              updates.duration = found.defaultDuration;
              updates.periods = found.defaultDuration === 1 ? [2] : [2, 3];
            }
          }
        }
        copy[index] = { ...copy[index], ...updates };
      }
      return copy;
    });
  };

  const removePracticalItem = (index: number) => {
    setPracticalItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Priority tiers per paper: 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL' | 'EXCLUDE'
  const [subjectTiers, setSubjectTiers] = useState<Record<string, SubjectPriorityTier>>(() => {
    const initial: Record<string, SubjectPriorityTier> = {};
    const existingTiers = recreatingRoutine?.subjectPriorityTiers || {};
    for (const p of papers) {
      if (existingTiers[p.id]) {
        initial[p.id] = existingTiers[p.id];
      } else if (recreatingRoutine?.excludedPaperIds?.includes(p.id)) {
        initial[p.id] = 'EXCLUDE';
      } else if (recreatingRoutine?.priorityPaperIds?.includes(p.id)) {
        initial[p.id] = 'HIGH';
      } else {
        initial[p.id] = 'NORMAL';
      }
    }
    return initial;
  });

  // Guaranteed minimum periods per prioritized paper
  const [subjectMinPeriods, setSubjectMinPeriods] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    if (recreatingRoutine?.prioritySubjectMinPeriods) {
      return { ...recreatingRoutine.prioritySubjectMinPeriods };
    }
    for (const p of papers) {
      const tier = recreatingRoutine?.subjectPriorityTiers?.[p.id];
      if (tier === 'HIGH') initial[p.id] = 15;
      else if (tier === 'MEDIUM') initial[p.id] = 9;
      else if (tier === 'LOW') initial[p.id] = 3;
    }
    return initial;
  });

  const [notes, setNotes] = useState<string>(recreatingRoutine?.notes || '');
  const [teacherSearch, setTeacherSearch] = useState<string>('');
  const [subjectSearch, setSubjectSearch] = useState<string>('');
  const [priorityMode, setPriorityMode] = useState<'tiers' | 'roomWise'>('tiers');
  const [roomPriorityMap, setRoomPriorityMap] = useState<Record<string, string[]>>(
    recreatingRoutine?.roomPriorityPaperIds || {}
  );
  const [selectedRoomIdForPriority, setSelectedRoomIdForPriority] = useState<string>(
    classrooms.length > 0 ? classrooms[0].id : ''
  );

  // Synchronize state when recreatingRoutine or isOpen changes
  useEffect(() => {
    if (isOpen) {
      if (recreatingRoutine) {
        setGenerationMode('single'); // Recreate routine is ALWAYS strictly single day
        setDate(recreatingRoutine.date);
        setNotes(recreatingRoutine.notes || '');
        setRoomPriorityMap(recreatingRoutine.roomPriorityPaperIds || {});
        if (recreatingRoutine.unavailableTeachers && recreatingRoutine.unavailableTeachers.length > 0) {
          setUnavailabilityItems(
            recreatingRoutine.unavailableTeachers.map((u, idx) => ({
              id: `unavail-${idx + 1}`,
              teacherId: u.teacherId,
              targetDayOrDate: u.date || recreatingRoutine.date,
              type: u.type,
              remark: u.remark || '',
            }))
          );
        } else if (recreatingRoutine.absentTeacherIds && recreatingRoutine.absentTeacherIds.length > 0) {
          setUnavailabilityItems(
            recreatingRoutine.absentTeacherIds.map((tid, idx) => ({
              id: `unavail-${idx + 1}`,
              teacherId: tid,
              targetDayOrDate: recreatingRoutine.date,
              type: 'ABSENT',
              remark: '',
            }))
          );
        } else {
          setUnavailabilityItems([]);
        }
      } else {
        setGenerationMode('single');
        setDate(getDefaultDate());
        setNotes('');
        setUnavailabilityItems([]);
      }
    }
  }, [isOpen, recreatingRoutine]);

  // History excluding current one if recreating
  const effectiveHistory = isRecreating
    ? historicalRoutines.filter((r) => r.id !== recreatingRoutine.id)
    : historicalRoutines;

  // Calculate cumulative stats to guide deficit scheduling
  const cumulativeStats = calculateCumulativeStats(papers, effectiveHistory, []);


  const setPaperTier = (paperId: string, tier: SubjectPriorityTier) => {
    setSubjectTiers((prev) => ({
      ...prev,
      [paperId]: tier,
    }));
    setSubjectMinPeriods((prev) => {
      const updated = { ...prev };
      if (tier === 'HIGH') updated[paperId] = 15;
      else if (tier === 'MEDIUM') updated[paperId] = 9;
      else if (tier === 'LOW') updated[paperId] = 3;
      else delete updated[paperId];
      return updated;
    });
  };

  const updateMinPeriods = (paperId: string, delta: number) => {
    setSubjectMinPeriods((prev) => {
      const current = prev[paperId] ?? (subjectTiers[paperId] === 'HIGH' ? 15 : subjectTiers[paperId] === 'MEDIUM' ? 9 : 3);
      const nextVal = Math.max(1, Math.min(30, current + delta));
      return { ...prev, [paperId]: nextVal };
    });
  };

  const resetAllTiers = () => {
    const reset: Record<string, SubjectPriorityTier> = {};
    for (const p of papers) {
      reset[p.id] = 'NORMAL';
    }
    setSubjectTiers(reset);
    setSubjectMinPeriods({});
  };

  const toggleRoomPriorityPaper = (paperId: string) => {
    if (!selectedRoomIdForPriority) return;
    setRoomPriorityMap((prev) => {
      const currentList = prev[selectedRoomIdForPriority] || [];
      const updated = currentList.includes(paperId)
        ? currentList.filter((id) => id !== paperId)
        : [...currentList, paperId];
      return { ...prev, [selectedRoomIdForPriority]: updated };
    });
  };

  const copyPriorityToAllRooms = (sourceRoomId: string) => {
    const sourcePapers = roomPriorityMap[sourceRoomId] || [];
    const updated: Record<string, string[]> = {};
    for (const r of classrooms) {
      updated[r.id] = [...sourcePapers];
    }
    setRoomPriorityMap(updated);
  };

  const copyPriorityToBuilding = (sourceRoomId: string, building: 'OLD' | 'NEW') => {
    const sourcePapers = roomPriorityMap[sourceRoomId] || [];
    setRoomPriorityMap((prev) => {
      const updated = { ...prev };
      for (const r of classrooms) {
        if (r.building === building) {
          updated[r.id] = [...sourcePapers];
        }
      }
      return updated;
    });
  };

  const clearAllRoomPriorities = () => {
    setRoomPriorityMap({});
  };

  const filteredTeachers = [...teachers]
    .sort(compareTeacherCodes)
    .filter((t) => {
      const q = teacherSearch.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.designation.toLowerCase().includes(q)
      );
    });

  const handleGenerate = () => {
    const derivedExcluded = Object.entries(subjectTiers)
      .filter(([_, t]) => t === 'EXCLUDE')
      .map(([id]) => id);

    const derivedHighPriority = Object.entries(subjectTiers)
      .filter(([_, t]) => t === 'HIGH')
      .map(([id]) => id);

    // 1. BLANK ROUTINE CREATION (Only when NOT recreating)
    if (!isRecreating && generationMode === 'blank') {
      const blankSlots: ClassSlot[] = [];
      for (const room of classrooms) {
        for (let p = 1; p <= 5; p++) {
          blankSlots.push({
            id: `slot-${dayNumber}-${room.id}-P${p}`,
            roomId: room.id,
            period: p,
            paperId: '',
            teacherId: '',
            isSubstitute: false,
            isPriority: false,
          });
        }
      }

      const blankUnavail = unavailabilityItems.filter(
        (u) => u.teacherId && (u.targetDayOrDate === 'ALL' || u.targetDayOrDate === date)
      );
      const blankAbsentIds = Array.from(new Set(blankUnavail.map((u) => u.teacherId)));
      const blankUnavailableList: UnavailableInstructor[] = blankUnavail.map((u) => ({
        teacherId: u.teacherId,
        type: u.type,
        remark: u.remark || 'Absent',
        date,
      }));

      const blankRoutine: DailyRoutine = {
        id: `routine-day-${dayNumber}-${Date.now()}`,
        dayNumber,
        date,
        absentTeacherIds: blankAbsentIds,
        unavailableTeachers: blankUnavailableList,
        priorityPaperIds: [],
        practicalConfig: { enabled: false, items: [] },
        slots: blankSlots,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLocked: false,
        status: 'draft',
        notes: notes || `Manual Blank Routine for Day ${dayNumber} (${date}) - ready for slot assignment`,
      };

      onRoutineGenerated(blankRoutine);
      return;
    }

    // 2. MULTIPLE DAYS BATCH CREATION (NEVER when recreating!)
    if (!isRecreating && generationMode === 'multiple') {
      const generatedBatch: DailyRoutine[] = [];
      let currentHistory = [...effectiveHistory];

      for (let d = 0; d < multiDayCount; d++) {
        const currentDayNumber = dayNumber + d;
        const dDate = new Date(date);
        dDate.setDate(dDate.getDate() + d);
        const dateStr = dDate.toISOString().split('T')[0];

        // Filter date/day-specific unavailable entries
        const dayUnavail = unavailabilityItems.filter(
          (u) => u.teacherId && (u.targetDayOrDate === 'ALL' || u.targetDayOrDate === dateStr)
        );
        const dayAbsentTeacherIds = Array.from(new Set(dayUnavail.map((u) => u.teacherId)));
        const dayUnavailableTeachersList: UnavailableInstructor[] = dayUnavail.map((u) => ({
          teacherId: u.teacherId,
          type: u.type,
          remark: u.remark || (
            u.type === 'LEAVE' ? 'Sanctioned Leave' :
            u.type === 'DUTY' ? 'Special Duty' :
            u.type === 'SICK' ? 'Sick' :
            u.type === 'REST' ? 'Rest / Standby Reserve' : 'Absent'
          ),
          date: dateStr,
        }));

        // Filter date/day-specific practical entries
        const dayPracItems = practicalItems.filter(
          (p) => p.targetDayOrDate === 'ALL' || p.targetDayOrDate === dateStr
        );
        const dayPracticalConfig: PracticalConfig = {
          enabled: isPracticalEnabled && dayPracItems.length > 0,
          items: isPracticalEnabled
            ? dayPracItems.map((item) => ({
                id: item.id,
                name: item.name,
                teacherId: item.teacherId || undefined,
                roomId: item.roomId || undefined,
                duration: item.duration || (item.periods?.length === 1 ? 1 : 2),
                periods: item.periods,
                practicalSubjectId: item.practicalSubjectId || undefined,
              }))
            : [],
        };

        const currentExamConfig: ExamConfig = {
          enabled: isExamEnabled,
          name: examName.trim() || 'Examination / Assessment',
          targetSessions: 30,
          period: 5,
        };

        const r = generateDailyRoutine({
          classrooms,
          papers,
          teachers,
          absentTeacherIds: dayAbsentTeacherIds,
          priorityPaperIds: derivedHighPriority,
          roomPriorityPaperIds: priorityMode === 'roomWise' ? roomPriorityMap : {},
          subjectPriorityTiers: subjectTiers,
          prioritySubjectMinPeriods: subjectMinPeriods,
          excludedPaperIds: derivedExcluded,
          practicalConfig: dayPracticalConfig,
          examConfig: currentExamConfig,
          rules: localRules,
          historicalRoutines: currentHistory,
          targetDayNumber: currentDayNumber,
          targetDate: dateStr,
          notes:
            notes ||
            `STC, SAP 4th Bn Day ${currentDayNumber} Routine (${dateStr}) - Batch generated (${multiDayCount} days)`,
        });

        r.absentTeacherIds = dayAbsentTeacherIds;
        r.unavailableTeachers = dayUnavailableTeachersList;
        r.practicalConfig = dayPracticalConfig;
        r.examConfig = currentExamConfig;
        generatedBatch.push(r);
        currentHistory.push(r);
      }

      onRoutineGenerated(generatedBatch);
      return;
    }

    // 3. SINGLE DAY STANDARD GENERATION (Also strictly applies for Recreate Routine)
    const singleUnavail = unavailabilityItems.filter(
      (u) => u.teacherId && (u.targetDayOrDate === 'ALL' || u.targetDayOrDate === date)
    );
    const singleAbsentIds = Array.from(new Set(singleUnavail.map((u) => u.teacherId)));
    const singleUnavailableList: UnavailableInstructor[] = singleUnavail.map((u) => ({
      teacherId: u.teacherId,
      type: u.type,
      remark: u.remark || (
        u.type === 'LEAVE' ? 'Sanctioned Leave' :
        u.type === 'DUTY' ? 'Special Duty' :
        u.type === 'SICK' ? 'Sick' :
        u.type === 'REST' ? 'Rest / Standby Reserve' : 'Absent'
      ),
      date,
    }));

    const singlePracItems = practicalItems.filter(
      (p) => p.targetDayOrDate === 'ALL' || p.targetDayOrDate === date
    );
    const singlePracticalConfig: PracticalConfig = {
      enabled: isPracticalEnabled && singlePracItems.length > 0,
      items: isPracticalEnabled
        ? singlePracItems.map((item) => ({
            id: item.id,
            name: item.name,
            teacherId: item.teacherId || undefined,
            roomId: item.roomId || undefined,
            duration: item.duration || (item.periods?.length === 1 ? 1 : 2),
            periods: item.periods,
            practicalSubjectId: item.practicalSubjectId || undefined,
          }))
        : [],
    };

    const singleExamConfig: ExamConfig = {
      enabled: isExamEnabled,
      name: examName.trim() || 'Examination / Assessment',
      targetSessions: 30,
      period: 5,
    };

    const newRoutine = generateDailyRoutine({
      classrooms,
      papers,
      teachers,
      absentTeacherIds: singleAbsentIds,
      priorityPaperIds: derivedHighPriority,
      roomPriorityPaperIds: priorityMode === 'roomWise' ? roomPriorityMap : {},
      subjectPriorityTiers: subjectTiers,
      prioritySubjectMinPeriods: subjectMinPeriods,
      excludedPaperIds: derivedExcluded,
      practicalConfig: singlePracticalConfig,
      examConfig: singleExamConfig,
      rules: localRules,
      historicalRoutines: effectiveHistory,
      targetDayNumber: dayNumber,
      targetDate: date,
      notes:
        notes ||
        `STC, SAP 4th Bn Day ${dayNumber} Routine (${date}) - ${singleAbsentIds.length} instructors unavailable, ${derivedExcluded.length} subjects excluded`,
    });

    newRoutine.absentTeacherIds = singleAbsentIds;
    newRoutine.unavailableTeachers = singleUnavailableList;
    newRoutine.practicalConfig = singlePracticalConfig;
    newRoutine.examConfig = singleExamConfig;

    if (isRecreating && recreatingRoutine) {
      newRoutine.id = recreatingRoutine.id;
    }

    onRoutineGenerated(newRoutine);
  };

  // Counts of tiers
  const tierCounts = {
    HIGH: Object.values(subjectTiers).filter((t) => t === 'HIGH').length,
    MEDIUM: Object.values(subjectTiers).filter((t) => t === 'MEDIUM').length,
    LOW: Object.values(subjectTiers).filter((t) => t === 'LOW').length,
    EXCLUDE: Object.values(subjectTiers).filter((t) => t === 'EXCLUDE').length,
  };

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs ${backdropAnimationClass}`}>
      <div className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden ${modalAnimationClass}`}>
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shrink-0 ${
              isRecreating ? 'bg-amber-600' : 'bg-indigo-600'
            }`}>
              {isRecreating ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                {isRecreating
                  ? `Recreate Routine for Day ${dayNumber}`
                  : `Generate Daily Routine for Day ${dayNumber}`}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                STC, SAP 4th Bn · 15 Classrooms · 5 Periods × 40 min
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
          {/* Generation Mode Selector */}
          {isRecreating ? (
            <div className="p-3 bg-amber-50/80 border border-amber-300 rounded-xl flex items-start gap-3 text-xs text-amber-950">
              <RefreshCw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <span>Recreating Selected Routine: Day {dayNumber} ({formatDisplayDate(date)})</span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide">
                    Single Routine Locked
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Only this specific selected routine will be regenerated and overwritten. Multi-day batch creation is disabled during recreate to prevent unintended routine overwrites.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-indigo-950">
                Routine Creation Mode:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setGenerationMode('single')}
                  className={`p-2.5 rounded-lg border font-semibold flex items-center gap-2 transition-all text-left ${
                    generationMode === 'single'
                      ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs ring-2 ring-indigo-500/20'
                      : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div className="font-bold">Single Day Routine</div>
                    <div className="text-[10px] text-slate-500 font-normal">Generate Day {dayNumber}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setGenerationMode('multiple')}
                  className={`p-2.5 rounded-lg border font-semibold flex items-center gap-2 transition-all text-left ${
                    generationMode === 'multiple'
                      ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs ring-2 ring-indigo-500/20'
                      : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div className="font-bold">Multiple Days (Batch)</div>
                    <div className="text-[10px] text-slate-500 font-normal">Generate {multiDayCount} days together</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setGenerationMode('blank')}
                  className={`p-2.5 rounded-lg border font-semibold flex items-center gap-2 transition-all text-left ${
                    generationMode === 'blank'
                      ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs ring-2 ring-indigo-500/20'
                      : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <FilePlus className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div className="font-bold">New Blank Routine</div>
                    <div className="text-[10px] text-slate-500 font-normal">75 empty slots for manual edit</div>
                  </div>
                </button>
              </div>

              {generationMode === 'multiple' && (
                <div className="pt-2 border-t border-indigo-100 flex items-center justify-between text-xs">
                  <span className="text-indigo-900 font-medium">
                    Consecutive Days to Generate:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[2, 3, 4, 5, 6, 7].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setMultiDayCount(num)}
                        className={`w-7 h-7 rounded-md font-bold text-xs transition-colors ${
                          multiDayCount === num
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                    <span className="text-[11px] text-indigo-700 font-semibold ml-1">
                      (Day {dayNumber} to Day {dayNumber + multiDayCount - 1})
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Day & Date info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Training Day:
              </label>
              <div className="font-bold text-sm text-indigo-700">
                Day {dayNumber} {generationMode === 'multiple' && `to Day ${dayNumber + multiDayCount - 1}`}{' '}
                {isRecreating && <span className="text-xs text-amber-700 font-semibold">(Current Active Routine)</span>}
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {generationMode === 'multiple' ? 'Start Date:' : 'Routine Date:'}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white font-medium text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Section 1: Instructor Absences & Unavailability (Compact Card List with Date/Day and Remarks) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <UserX className="w-4 h-4 text-rose-600" />
                <label className="text-xs font-bold text-slate-900">
                  1. Faculty Leaves, Special Duties & Medical Absences:
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600">
                  {uniqueUnavailableTeacherCount} Unavailable · {availableTeachersCount}/{teachers.length} Active
                </span>
                <button
                  type="button"
                  onClick={addUnavailabilityItem}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg shadow-2xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Leave / Duty / Sick</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Mark faculty on leave, special law &amp; order duty, or medical rest. For multi-day schedules, you can assign absences to &apos;All Days&apos; or to a specific training date with custom remarks.
            </p>

            {unavailabilityItems.length === 0 ? (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-950">All Faculty Available</span>
                    <p className="text-[11px] text-emerald-700">
                      No leaves or external duties recorded. All instructors are eligible for routine assignment.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addUnavailabilityItem}
                  className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-lg shadow-2xs transition-colors shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ Add Leave / Duty / Sick</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="space-y-2 max-h-56 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
                  {unavailabilityItems.map((item, idx) => {
                    const currentTeacher = teachers.find((t) => t.id === item.teacherId);
                    return (
                      <div
                        key={item.id || idx}
                        className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-2"
                      >
                        {/* Entry Header */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                              Entry #{idx + 1}
                            </span>
                            <span className="font-bold text-slate-800 text-[11px]">
                              {currentTeacher
                                ? `[${currentTeacher.code}] ${currentTeacher.name} (${currentTeacher.designation || 'Instructor'})`
                                : 'Select Instructor'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeUnavailabilityItem(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 text-[11px] font-medium flex items-center gap-1 transition-colors"
                            title="Remove unavailability entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>

                        {/* Fields Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          {/* Instructor Selector */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                              Faculty Member:
                            </label>
                            <select
                              value={item.teacherId}
                              onChange={(e) => updateUnavailabilityItem(idx, { teacherId: e.target.value })}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                            >
                              <option value="">-- Choose Instructor --</option>
                              {[...teachers].sort(compareTeacherCodes).map((t) => (
                                <option key={t.id} value={t.id}>
                                  [{t.code}] {t.name} ({t.designation})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Date / Day Selector */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                              Applicable Training Day:
                            </label>
                            {generationMode === 'multiple' ? (
                              <select
                                value={item.targetDayOrDate}
                                onChange={(e) => updateUnavailabilityItem(idx, { targetDayOrDate: e.target.value })}
                                className="w-full px-2 py-1 text-xs border border-indigo-200 rounded-lg bg-indigo-50/60 text-indigo-950 font-semibold focus:ring-1 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                              >
                                <option value="ALL">
                                  All {multiDayCount} Days (Day {dayNumber} to {dayNumber + multiDayCount - 1})
                                </option>
                                {batchDates.map((b) => (
                                  <option key={b.dateStr} value={b.dateStr}>
                                    Day {b.dayNum} ({formatDisplayDate(b.dateStr)})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-100 text-slate-700 font-semibold truncate">
                                Day {dayNumber} ({formatDisplayDate(date)})
                              </div>
                            )}
                          </div>

                          {/* Status Type Selector */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                              Status / Absence Reason:
                            </label>
                            <select
                              value={item.type}
                              onChange={(e) => {
                                const newType = e.target.value as UnavailabilityType;
                                const defaultRemark =
                                  newType === 'LEAVE' ? 'Casual Leave' :
                                  newType === 'DUTY' ? 'Special Duty (Law & Order)' :
                                  newType === 'SICK' ? 'Medical Sick Rest' :
                                  newType === 'REST' ? 'Rest / Standby' : 'Absent';
                                updateUnavailabilityItem(idx, { type: newType, remark: item.remark || defaultRemark });
                              }}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                            >
                              <option value="LEAVE">Leave (CL / Earned Leave)</option>
                              <option value="DUTY">Special Duty / VIP Bandobast</option>
                              <option value="SICK">Medical Rest / Sick</option>
                              <option value="REST">Scheduled Rest / Reserve</option>
                              <option value="ABSENT">Absent (General)</option>
                            </select>
                          </div>
                        </div>

                        {/* Note / Remark with Quick Chips */}
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] font-bold text-slate-600">
                              Note / Specific Remark:
                            </label>
                            <div className="flex items-center gap-1 flex-wrap">
                              {['Casual Leave', 'Special Duty', 'Court Evidence', 'Medical Sick', 'Rest Standby'].map((chip) => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => updateUnavailabilityItem(idx, { remark: chip })}
                                  className={`px-1.5 py-0.2 text-[9px] font-medium rounded border transition-colors ${
                                    item.remark === chip
                                      ? 'bg-indigo-600 text-white border-indigo-700'
                                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                  }`}
                                >
                                  {chip}
                                </button>
                              ))}
                            </div>
                          </div>
                          <input
                            type="text"
                            value={item.remark || ''}
                            onChange={(e) => updateUnavailabilityItem(idx, { remark: e.target.value })}
                            placeholder="e.g. Casual Leave, Law & Order Duty, Court Evidence..."
                            className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-0.5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={addUnavailabilityItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-300 rounded-lg shadow-2xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-rose-600" />
                    <span>+ Add Another Unavailable / Leave Entry</span>
                  </button>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {unavailabilityItems.length} {unavailabilityItems.length === 1 ? 'entry' : 'entries'} recorded
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Subject Priority Tiers & Inclusions Controller (Hidden when Rule 8 Teacher Equalization is ON) */}
          {!localRules.enableTeacherLoadEqualizationPriority && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <label className="text-xs font-bold text-slate-900">
                    2. Subject Priority & Inclusion Tiers:
                  </label>
                </div>

              {/* Mode Toggle: Priority Tiers vs Room-wise */}
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPriorityMode('tiers')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                    priorityMode === 'tiers'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Priority Tiers (High / Low / Exclude)
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityMode('roomWise')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1.5 ${
                    priorityMode === 'roomWise'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Room-Wise Option</span>
                  {Object.values(roomPriorityMap).some((arr) => arr.length > 0) && (
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  )}
                </button>
              </div>
            </div>

            {/* Explanation of the tiers */}
            {priorityMode === 'tiers' && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
                  <div className="p-1.5 rounded bg-amber-50 border border-amber-200 text-amber-900">
                    <span className="font-bold">High (+50%):</span> +50% more subject allocation (max 15 classes)
                  </div>
                  <div className="p-1.5 rounded bg-teal-50 border border-teal-200 text-teal-900">
                    <span className="font-bold">Low (-50%):</span> -50% less subject allocation
                  </div>
                  <div className="p-1.5 rounded bg-rose-50 border border-rose-200 text-rose-900">
                    <span className="font-bold">Exclude (0%):</span> Completely omitted from routine
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    <span className="text-slate-500">Configured:</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                      {tierCounts.HIGH} High (+50%)
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                      {tierCounts.LOW} Low (-50%)
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                      {tierCounts.EXCLUDE} Excluded
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={resetAllTiers}
                    className="text-[10px] text-slate-500 hover:text-slate-800 underline font-semibold"
                  >
                    Reset all to Normal
                  </button>
                </div>

                {/* Search subjects */}
                <input
                  type="text"
                  placeholder="Filter subjects by paper code or name..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />

                {/* Subject tiers list */}
                <div className="space-y-1.5 max-h-56 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                  {papers
                    .filter(
                      (p) =>
                        p.code.toLowerCase().includes(subjectSearch.toLowerCase()) ||
                        p.title.toLowerCase().includes(subjectSearch.toLowerCase())
                    )
                    .map((p) => {
                      const currentTier = subjectTiers[p.id] || 'NORMAL';
                      const stat = cumulativeStats.find((s) => s.paperId === p.id);
                      return (
                        <div
                          key={p.id}
                          className={`p-2 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${
                            currentTier === 'HIGH'
                              ? 'bg-amber-50/70 border-amber-300'
                              : currentTier === 'MEDIUM'
                              ? 'bg-blue-50/70 border-blue-300'
                              : currentTier === 'LOW'
                              ? 'bg-teal-50/70 border-teal-300'
                              : currentTier === 'EXCLUDE'
                              ? 'bg-rose-50/70 border-rose-300 opacity-80'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: p.color }}
                            ></span>
                            <div className="truncate">
                              <p className="font-bold text-xs text-slate-900 truncate">
                                {p.code}: {p.title}
                              </p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                15-Classroom Target: {stat?.targetSessions || p.totalTargetSessions * 15} · Completed: {stat?.completedSessions || 0}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto shrink-0">
                            {/* Segmented Tier Buttons: High (1.50x), Medium (1.00x), Low (0.50x), Exclude (0.00x) */}
                            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[10px] font-bold shrink-0">
                              <button
                                type="button"
                                onClick={() => setPaperTier(p.id, 'HIGH')}
                                className={`px-2 py-1 rounded transition-all ${
                                  currentTier === 'HIGH'
                                    ? 'bg-amber-500 text-white shadow-2xs font-extrabold'
                                    : 'text-slate-600 hover:text-amber-800'
                                }`}
                                title="High Priority (1.50x multiplier: +50% allocation)"
                              >
                                High (1.50x)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaperTier(p.id, 'MEDIUM')}
                                className={`px-2 py-1 rounded transition-all ${
                                  currentTier === 'MEDIUM' || currentTier === 'NORMAL'
                                    ? 'bg-slate-300 text-slate-900 shadow-2xs font-bold'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                                title="Medium Priority (1.00x multiplier: baseline remaining demand)"
                              >
                                Medium (1.00x)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaperTier(p.id, 'LOW')}
                                className={`px-2 py-1 rounded transition-all ${
                                  currentTier === 'LOW'
                                    ? 'bg-teal-600 text-white shadow-2xs font-extrabold'
                                    : 'text-slate-600 hover:text-teal-800'
                                }`}
                                title="Low Priority (0.50x multiplier: -50% allocation)"
                              >
                                Low (0.50x)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaperTier(p.id, 'EXCLUDE')}
                                className={`px-2 py-1 rounded transition-all ${
                                  currentTier === 'EXCLUDE'
                                    ? 'bg-rose-600 text-white shadow-2xs font-extrabold'
                                    : 'text-slate-600 hover:text-rose-800'
                                }`}
                                title="Exclude (0.00x multiplier: completely omitted from routine)"
                              >
                                Exclude (0)
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Room-Wise Classroom Selector Strip */}
            {priorityMode === 'roomWise' && (
              <div className="space-y-2 bg-slate-100/70 p-2.5 rounded-lg border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-700">
                    Active Room:{' '}
                    <strong className="text-indigo-700">
                      {classrooms.find((c) => c.id === selectedRoomIdForPriority)?.name || 'Select Room'}
                    </strong>{' '}
                    ({classrooms.find((c) => c.id === selectedRoomIdForPriority)?.building === 'OLD' ? 'Old Bldg' : 'New Bldg'})
                  </span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => copyPriorityToAllRooms(selectedRoomIdForPriority)}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-50 font-semibold text-slate-700 shadow-2xs"
                    >
                      Copy to All 15 Rooms
                    </button>
                    <button
                      type="button"
                      onClick={() => copyPriorityToBuilding(selectedRoomIdForPriority, 'OLD')}
                      className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 font-semibold text-amber-800"
                    >
                      Copy to Old Bldg
                    </button>
                    <button
                      type="button"
                      onClick={() => copyPriorityToBuilding(selectedRoomIdForPriority, 'NEW')}
                      className="px-2 py-0.5 bg-sky-50 border border-sky-200 rounded hover:bg-sky-100 font-semibold text-sky-800"
                    >
                      Copy to New Bldg
                    </button>
                    <button
                      type="button"
                      onClick={clearAllRoomPriorities}
                      className="px-2 py-0.5 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 font-semibold text-rose-700"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {sortedClassrooms.map((r) => {
                    const isSelected = r.id === selectedRoomIdForPriority;
                    const count = (roomPriorityMap[r.id] || []).length;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRoomIdForPriority(r.id)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                            : count > 0
                            ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{r.building === 'OLD' ? 'Old' : 'New'}: {r.name}</span>
                        {count > 0 && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Papers list for room-wise selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-white">
                  {papers.map((p) => {
                    const isSelected = (roomPriorityMap[selectedRoomIdForPriority] || []).includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleRoomPriorityPaper(p.id)}
                        className={`p-2 rounded-lg text-left text-xs transition-colors border flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-amber-50 border-amber-400 text-amber-950 font-semibold ring-1 ring-amber-300'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: p.color }}
                          ></span>
                          <div className="truncate">
                            <p className="font-semibold text-[11px] truncate">
                              {p.code}: {p.title}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold shrink-0">
                            ★ Priority
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          )}

          {/* Section 3: Practical Sessions Setup & Allotment (Rule 9) */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                  <FlaskConical className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-900">
                      3. Practical Sessions Setup & Allotment:
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Rule 9: 2x2 = 4 slots
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Consecutive double-period practical class (e.g. Computer Lab, Forensics). Instructor exempt from theory.
                  </p>
                </div>
              </div>

              {/* Enable / Disable Practical Toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={isPracticalEnabled}
                    onChange={(e) => setIsPracticalEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Enable Practical</span>
                </label>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isPracticalEnabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {isPracticalEnabled ? `${practicalItems.length} Configured` : 'Disabled'}
                </span>
              </div>
            </div>

            {isPracticalEnabled && (
              <div className="space-y-2.5">
                {practicalItems.length === 0 ? (
                  <div className="p-3 text-center bg-white rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs">
                    No practical sessions added yet. Click "+ Add Practical Session" to schedule a practical class.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {practicalItems.map((item, idx) => {
                      const allSubs =
                        practicalSubjects && practicalSubjects.length > 0
                          ? practicalSubjects
                          : INITIAL_PRACTICAL_SUBJECTS;
                      const selectedSub = allSubs.find((s) => s.id === item.practicalSubjectId);
                      const subColor = selectedSub?.color || '#059669';

                      return (
                        <div
                          key={item.id || idx}
                          className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: subColor }}
                              />
                              <span className="text-xs font-bold text-slate-800">
                                Practical Session #{idx + 1}
                              </span>
                              {selectedSub && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                  {selectedSub.code}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => removePracticalItem(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete practical session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                            {/* Practical Subject Dropdown */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                Practical Subject / Lab:
                              </label>
                              <select
                                value={item.practicalSubjectId || ''}
                                onChange={(e) => updatePracticalItem(idx, { practicalSubjectId: e.target.value })}
                                className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                              >
                                {allSubs.map((sub) => (
                                  <option key={sub.id} value={sub.id}>
                                    {sub.code}: {sub.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Practical Duration (Rule 9 / 9A) */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                Duration / Periods:
                              </label>
                              <select
                                value={item.duration || (item.periods?.length === 1 ? 1 : 2)}
                                onChange={(e) => {
                                  const dur = Number(e.target.value) as 1 | 2;
                                  updatePracticalItem(idx, {
                                    duration: dur,
                                    periods: dur === 1 ? [2] : [2, 3],
                                  });
                                }}
                                className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                              >
                                <option value={2}>2 Periods (Double Period)</option>
                                <option value={1}>1 Period (Single Period)</option>
                              </select>
                            </div>

                            {/* Period Selection */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                {(item.duration || (item.periods?.length === 1 ? 1 : 2)) === 1
                                  ? 'Practical Period:'
                                  : 'Consecutive Periods (Rule 9):'}
                              </label>
                              {(item.duration || (item.periods?.length === 1 ? 1 : 2)) === 1 ? (
                                <select
                                  value={item.periods && item.periods.length === 1 ? String(item.periods[0]) : '2'}
                                  onChange={(e) => {
                                    const p = Number(e.target.value);
                                    updatePracticalItem(idx, { duration: 1, periods: [p] });
                                  }}
                                  className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                >
                                  <option value="1">Period 1 (09:40 - 10:20)</option>
                                  <option value="2">Period 2 (10:25 - 11:05)</option>
                                  <option value="3">Period 3 (11:10 - 11:50)</option>
                                  <option value="4">Period 4 (12:05 - 12:45)</option>
                                  <option value="5">Period 5 (12:50 - 13:30)</option>
                                </select>
                              ) : (
                                <select
                                  value={item.periods && item.periods.length === 2 ? `${item.periods[0]}-${item.periods[1]}` : '2-3'}
                                  onChange={(e) => {
                                    const [p1, p2] = e.target.value.split('-').map(Number);
                                    updatePracticalItem(idx, { duration: 2, periods: [p1, p2] });
                                  }}
                                  className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                >
                                  <option value="2-3">Period 2 & 3 (10:25 - 11:50) [Pre-Recess]</option>
                                  <option value="4-5">Period 4 & 5 (12:05 - 13:30) [Post-Recess]</option>
                                </select>
                              )}
                            </div>

                            {/* Instructor Dropdown */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                Designated Instructor:
                              </label>
                              <select
                                value={item.teacherId || ''}
                                onChange={(e) => updatePracticalItem(idx, { teacherId: e.target.value })}
                                className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                              >
                                <option value="">Auto-Assign (Lagging Instructor)</option>
                                {[...teachers].sort(compareTeacherCodes).map((t) => {
                                  const isAbsent = absentTeacherIds.includes(t.id);
                                  return (
                                    <option key={t.id} value={t.id} disabled={isAbsent}>
                                      {t.code}: {t.name} ({t.assignedBuilding}){isAbsent ? ' (Unavailable)' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {/* Classroom Dropdown */}
                            <div>
                              <div className="flex items-center justify-between mb-0.5">
                                <label className="block text-[10px] font-bold text-slate-600">
                                  Classroom Venue:
                                </label>
                                <span className="text-[9px] text-emerald-700 font-semibold">Max 2 practicals / room</span>
                              </div>
                              <select
                                value={item.roomId || ''}
                                onChange={(e) => updatePracticalItem(idx, { roomId: e.target.value })}
                                className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                              >
                                <option value="">Auto-Balance (Lowest Prior Visits)</option>
                                {sortedClassrooms.map((c) => {
                                  const otherItemsForRoom = practicalItems.filter(
                                    (other, oIdx) => oIdx !== idx && other.roomId === c.id
                                  );
                                  const currentPracticalKey = item.practicalSubjectId || item.name;
                                  const hasSameSubject = otherItemsForRoom.some(
                                    (other) => (other.practicalSubjectId || other.name) === currentPracticalKey
                                  );
                                  const currentPeriodsKey = item.periods ? item.periods.join('-') : '2-3';
                                  const hasSamePeriods = otherItemsForRoom.some(
                                    (other) => (other.periods ? other.periods.join('-') : '2-3') === currentPeriodsKey
                                  );
                                  const isMaxReached = otherItemsForRoom.length >= 2;

                                  const isDisabled = isMaxReached || hasSameSubject || hasSamePeriods;
                                  let hint = '';
                                  if (isMaxReached) hint = ' (Max 2 practicals reached)';
                                  else if (hasSameSubject) hint = ' (Same practical subject already in room)';
                                  else if (hasSamePeriods) hint = ' (Period conflict)';
                                  else if (otherItemsForRoom.length === 1) hint = ' (1 different practical assigned)';

                                  return (
                                    <option key={c.id} value={c.id} disabled={isDisabled}>
                                      {c.name} ({c.building === 'OLD' ? 'Old Bldg' : 'New Bldg'})
                                      {hint}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {/* Multi-Day Target Date Selector (when in multi-day mode) */}
                            {generationMode === 'multiple' && (
                              <div className="sm:col-span-2 lg:col-span-5 pt-1 border-t border-slate-100 flex items-center justify-between">
                                <label className="text-[10px] font-bold text-slate-600">
                                  Applies to Date / Day:
                                </label>
                                <select
                                  value={item.targetDayOrDate || 'ALL'}
                                  onChange={(e) => updatePracticalItem(idx, { targetDayOrDate: e.target.value })}
                                  className="text-xs rounded-lg border border-slate-300 px-2 py-0.5 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                >
                                  <option value="ALL">All {multiDayCount} Days in Batch</option>
                                  {batchDates.map((b) => (
                                    <option key={b.dateStr} value={b.dateStr}>
                                      Day {b.dayNum} ({formatDisplayDate(b.dateStr)})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-0.5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={addPracticalItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>+ Add Practical Session</span>
                  </button>
                  <span className="text-[10px] text-slate-500 font-medium italic">
                    * Practical instructors are exempted from theory classes on that day.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Examination & Assessment Session Setup */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-900">
                      4. Examination & Assessment Session Setup:
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                      Last Period (P5: 12:50 - 13:30) · All 15 Classrooms · 30 Target Sessions
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Jab exam session on karenge, hamesha last period (Period 5) me sabhi classrooms me ek exam session add ho jayega. Koi bhi available teacher invigilation duty ke liye detail ho sakta hai.
                  </p>
                </div>
              </div>

              {/* Enable / Disable Exam Toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={isExamEnabled}
                    onChange={(e) => setIsExamEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Enable Exam Session</span>
                </label>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isExamEnabled
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {isExamEnabled ? 'Active in Period 5 (15 Rooms)' : 'Disabled'}
                </span>
              </div>
            </div>

            {isExamEnabled && (
              <div className="p-3 bg-white rounded-xl border border-rose-200 shadow-2xs space-y-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Examination / Assessment Title:
                    </label>
                    <input
                      type="text"
                      value={examName}
                      onChange={(e) => setExamName(e.target.value)}
                      placeholder="e.g. Weekly Examination / Assessment"
                      className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white text-slate-800 font-semibold focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Period & Classroom Allocation:
                    </label>
                    <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium text-[11px] flex items-center justify-between">
                      <span>Period 5 (12:50 - 13:30) [Last Period]</span>
                      <span className="font-bold text-rose-700">All 15 Classrooms</span>
                    </div>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-rose-50/60 border border-rose-200/60 text-[11px] text-rose-900 flex items-center justify-between">
                  <span>✓ 15 active instructors will be flexibly assigned across Old and New building classrooms for exam duty.</span>
                  <span className="font-mono font-bold">Quota: 30 Sessions</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Routine Generation Constraint Checks */}
          <div className="border border-slate-200 rounded-xl bg-slate-50/70 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsRulesExpanded(!isRulesExpanded)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    5. Routine Generation Rules & Constraint Checks
                  </span>
                  <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {MASTER_ROUTINE_RULES.filter((r) => Boolean(localRules[r.key])).length}/{MASTER_ROUTINE_RULES.length} Active
                  </span>
                </div>
              </div>
              {isRulesExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {isRulesExpanded && (
              <div className="p-3.5 pt-0 border-t border-slate-200/80 space-y-3 mt-2">
                {/* Priority Hierarchy notice */}
                <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                  <strong>Priority Hierarchy:</strong> Tier 1 (Hard Rules: 1, 2, 3, 4, 5, 6, 6A, 6B, 7) &gt; Tier 2 (Curriculum Rules 10–16) &gt; Tier 3 (Staffing Rules 17–24). Any conflict is resolved in favor of the higher tier.
                </div>

                {[
                  {
                    tier: 'Tier 1: Inviolable Operational Constraints (Hard Rules: 1, 2, 3, 4, 5, 6, 6A, 6B, 7)',
                    rules: MASTER_ROUTINE_RULES.filter((r) => r.tierNumber === 1),
                  },
                  {
                    tier: 'Tier 2: Curriculum Progression & Subject Detailment (Moto I & IV: Rules 10–16)',
                    rules: MASTER_ROUTINE_RULES.filter((r) => r.tierNumber === 2),
                  },
                  {
                    tier: 'Tier 3: Faculty Staffing & Workload Management (Moto III: Rules 17–24)',
                    rules: MASTER_ROUTINE_RULES.filter((r) => r.tierNumber === 3),
                  },
                ].map((tierGroup, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100/70 px-2 py-0.5 rounded">
                      {tierGroup.tier}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {tierGroup.rules.map((rule) => {
                        const disabled = isRuleDisabled(rule.key as keyof RoutineRuleConfig, localRules);
                        const isChecked = !disabled && Boolean(localRules[rule.key as keyof RoutineRuleConfig]);
                        return (
                          <label
                            key={rule.key}
                            title={disabled ? (rule.disabledHint || 'Disabled by rule dependency') : rule.description}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs select-none transition ${
                              disabled
                                ? 'bg-slate-100/50 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
                                : isChecked
                                ? 'bg-white border-blue-200 text-slate-900 font-medium shadow-2xs cursor-pointer'
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-pointer'
                            }`}
                          >
                            <span className="truncate pr-2">
                              {rule.title}
                              {disabled && <span className="block text-[10px] text-amber-700 font-normal">↳ {rule.disabledHint}</span>}
                            </span>
                            <input
                              type="checkbox"
                              disabled={disabled}
                              checked={isChecked}
                              onChange={() => {
                                if (disabled) return;
                                setLocalRules((prev) =>
                                  normalizeRuleConfig({
                                    ...prev,
                                    [rule.key]: !prev[rule.key as keyof RoutineRuleConfig],
                                  })
                                );
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Paper-Wise Syllabus Content & Directives (Multiline) */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Paper-Wise Syllabus Content / Lesson Topics / Directives:
              </label>
              <span className="text-[10px] text-indigo-600 font-semibold">
                Appears at bottom of routine PDF
              </span>
            </div>
            <textarea
              rows={4}
              placeholder={`Enter paper-wise syllabus contents to be taught during class sessions (multiline):\ne.g.\nPaper-01: BNSS Ch 2 (Constitution of Criminal Courts)\nPaper-02: BNS Sec 100-106 (Offences against Human Body)\nPaper-12: Police Ethics, Code of Conduct & Human Rights`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed resize-y"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              * In this multiline note, write the exact syllabus topics to be covered paper-wise. This exact text will appear at the bottom of the routine during PDF creation and printing.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg text-white shadow-xs flex items-center gap-1.5 ${
              isRecreating
                ? 'bg-amber-600 hover:bg-amber-700'
                : generationMode === 'blank'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isRecreating ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : generationMode === 'blank' ? (
              <FilePlus className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>
              {isRecreating
                ? `Regenerate & Overwrite Day ${dayNumber}`
                : generationMode === 'blank'
                ? `Create Blank Routine (Day ${dayNumber})`
                : generationMode === 'multiple'
                ? `Generate Batch (${multiDayCount} Days)`
                : `Generate & Save Day ${dayNumber} Routine`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
