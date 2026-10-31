/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppSettings, Classroom, DailyRoutine, Paper, Teacher } from '../types';

export interface ReportDefinition {
  id: string;
  title: string;
  subtitle: string;
  category: 'Faculty' | 'Curriculum' | 'Daily Operations';
  icon: string;
  description: string;
  fileName: string;
  getHeaders: () => string[];
  getData: (params: {
    teachers: Teacher[];
    papers: Paper[];
    classrooms: Classroom[];
    allRoutines: DailyRoutine[];
    currentRoutine: DailyRoutine | null;
    settings?: AppSettings;
  }) => (string | number)[][];
}

/**
 * Triggers instant browser download of a clean formatted Excel (.xls) file.
 * Uses an XML/HTML table spreadsheet format with UTF-8 encoding that natively opens
 * in Microsoft Excel, Google Sheets, LibreOffice, and Apple Numbers with headers, borders and styles.
 */
export function exportToExcel(
  fileName: string,
  sheetTitle: string,
  headers: string[],
  rows: (string | number)[][],
  meta?: {
    centreName?: string;
    institutionName?: string;
    address?: string;
    date?: string;
  }
) {
  const safeTitle = sheetTitle.replace(/[\\/*?[\]:]/g, ' ');
  const safeFileName = fileName.endsWith('.xls') ? fileName : `${fileName}.xls`;

  let html = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${safeTitle.slice(0, 31)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
    <style>
      .inst-title { font-size: 15pt; font-weight: bold; text-align: center; color: #1e3a8a; }
      .inst-sub { font-size: 11pt; font-weight: bold; text-align: center; color: #0f172a; }
      .inst-addr { font-size: 10pt; text-align: center; color: #475569; }
      .doc-title { font-size: 12pt; font-weight: bold; text-align: center; background-color: #f1f5f9; color: #0f172a; padding: 6px; }
      .meta-bar { font-size: 9pt; color: #334155; text-align: center; }
      th { background-color: #1e293b; color: #ffffff; font-weight: bold; border: 1px solid #000000; text-align: center; padding: 6px 10px; font-size: 10pt; }
      td { border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 9.5pt; color: #0f172a; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .num { text-align: right; }
    </style>
  </head>
  <body>
    <table>
      ${meta?.centreName ? `<tr><td colspan="${headers.length}" class="inst-title">${meta.centreName}</td></tr>` : ''}
      ${meta?.institutionName ? `<tr><td colspan="${headers.length}" class="inst-sub">${meta.institutionName}</td></tr>` : ''}
      ${meta?.address ? `<tr><td colspan="${headers.length}" class="inst-addr">${meta.address}</td></tr>` : ''}
      <tr><td colspan="${headers.length}" class="doc-title">${sheetTitle}</td></tr>
      ${meta?.date ? `<tr><td colspan="${headers.length}" class="meta-bar">Generated: ${meta.date}</td></tr>` : ''}
      <tr><td colspan="${headers.length}"></td></tr>
      <thead>
        <tr>
          ${headers.map((h) => `<th>${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) =>
              `<tr>${r
                .map((cell) => {
                  const val = cell !== undefined && cell !== null ? String(cell) : '';
                  const isNum = typeof cell === 'number' || /^-?\d+(\.\d+)?%?$/.test(val.trim());
                  return `<td class="${isNum ? 'center' : ''}">${val.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
                })
                .join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>
  </body>
  </html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Triggers instant download of CSV formatted file with UTF-8 BOM so non-ASCII / Unicode text works in Excel.
 */
export function exportToCsv(fileName: string, headers: string[], rows: (string | number)[][]) {
  const safeFileName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  const escapeCell = (c: string | number) => {
    const str = c !== undefined && c !== null ? String(c) : '';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))];

  // Prepend UTF-8 BOM \uFEFF so Excel opens CSV without encoding issues
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =========================================================================
// DATA GENERATORS FOR THE 8 OFFICIAL DOWNLOAD REPORTS
// =========================================================================

/**
 * 1. Session Counter (Room-wise Subject Quotas & Completion)
 */
export function generateSessionCounterData(
  classrooms: Classroom[],
  papers: Paper[],
  allRoutines: DailyRoutine[],
  currentRoutine: DailyRoutine | null
): (string | number)[][] {
  const rows: (string | number)[][] = [];

  // Index past completed routines (excluding current routine)
  const completedRoutines = allRoutines.filter((r) => r.id !== currentRoutine?.id);
  const roomPaperCounts = new Map<string, number>();

  for (const r of completedRoutines) {
    if (!r.slots) continue;
    for (const s of r.slots) {
      const key = `${r.id ? s.roomId : ''}:${s.paperId}`;
      const actualKey = `${s.roomId}:${s.paperId}`;
      roomPaperCounts.set(actualKey, (roomPaperCounts.get(actualKey) || 0) + 1);
    }
  }

  // Today's counts
  const todayCounts = new Map<string, number>();
  if (currentRoutine?.slots) {
    for (const s of currentRoutine.slots) {
      const actualKey = `${s.roomId}:${s.paperId}`;
      todayCounts.set(actualKey, (todayCounts.get(actualKey) || 0) + 1);
    }
  }

  const sortedClassrooms = [...classrooms].sort((a, b) => a.code.localeCompare(b.code));
  const sortedPapers = [...papers].sort((a, b) => a.code.localeCompare(b.code));

  for (const room of sortedClassrooms) {
    for (const paper of sortedPapers) {
      const key = `${room.id}:${paper.id}`;
      const completed = roomPaperCounts.get(key) || 0;
      const today = todayCounts.get(key) || 0;
      const total = completed + today;
      const target = Math.round(paper.totalTargetSessions / classrooms.length) || 12;
      const remaining = Math.max(0, target - total);
      const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 100;

      rows.push([
        room.code,
        room.name,
        room.building === 'OLD' ? 'Old Bldg' : 'New Bldg',
        paper.code,
        paper.title,
        target,
        completed,
        today,
        total,
        remaining,
        `${pct}%`,
      ]);
    }
  }

  return rows;
}

/**
 * 2. Instructor Deployment Tracker
 */
export function generateDeploymentTrackerData(
  teachers: Teacher[],
  classrooms: Classroom[],
  allRoutines: DailyRoutine[],
  currentRoutine: DailyRoutine | null
): (string | number)[][] {
  const rows: (string | number)[][] = [];

  // Build room-wise delivery map for each teacher
  const teacherRoomDeliveries = new Map<string, Map<string, number>>();
  for (const t of teachers) {
    teacherRoomDeliveries.set(t.id, new Map<string, number>());
  }

  for (const r of allRoutines) {
    if (!r.slots) continue;
    for (const s of r.slots) {
      const roomMap = teacherRoomDeliveries.get(s.teacherId);
      if (roomMap) {
        roomMap.set(s.roomId, (roomMap.get(s.roomId) || 0) + 1);
      }
    }
  }

  for (const t of teachers) {
    const roomMap = teacherRoomDeliveries.get(t.id) || new Map<string, number>();
    let totalSessions = 0;
    let roomsVisited = 0;

    const roomCounts = classrooms.map((c) => {
      const count = roomMap.get(c.id) || 0;
      totalSessions += count;
      if (count > 0) roomsVisited++;
      return count;
    });

    const coveragePct = classrooms.length > 0 ? Math.round((roomsVisited / classrooms.length) * 100) : 0;

    rows.push([
      t.code,
      t.name,
      t.designation || 'Instructor',
      t.assignedBuilding || 'FLOATING',
      ...roomCounts,
      totalSessions,
      `${roomsVisited} / ${classrooms.length}`,
      `${coveragePct}%`,
    ]);
  }

  return rows;
}

/**
 * 3. Instructor Academic Workload Ledger
 */
export function generateInstructorLedgerData(
  teachers: Teacher[],
  papers: Paper[],
  allRoutines: DailyRoutine[],
  currentRoutine: DailyRoutine | null
): (string | number)[][] {
  const rows: (string | number)[][] = [];
  const paperMap = new Map(papers.map((p) => [p.id, p]));

  // Past routines (excluding current routine)
  const pastRoutines = allRoutines.filter((r) => r.id !== currentRoutine?.id);
  const pastLoads = new Map<string, number>();

  for (const r of pastRoutines) {
    if (!r.slots) continue;
    for (const s of r.slots) {
      pastLoads.set(s.teacherId, (pastLoads.get(s.teacherId) || 0) + 1);
    }
  }

  // Today's loads
  const todayLoads = new Map<string, number>();
  if (currentRoutine?.slots) {
    for (const s of currentRoutine.slots) {
      todayLoads.set(s.teacherId, (todayLoads.get(s.teacherId) || 0) + 1);
    }
  }

  let idx = 1;
  for (const t of teachers) {
    const past = pastLoads.get(t.id) || 0;
    const today = todayLoads.get(t.id) || 0;
    const total = past + today;
    const totalDays = Math.max(1, allRoutines.length);
    const avgPerDay = (total / totalDays).toFixed(1);

    const primarySubjects = t.primaryPaperIds
      .map((pid) => paperMap.get(pid)?.code || pid)
      .join(', ');

    const status = total >= 16 ? 'Balanced' : total >= 12 ? 'Normal' : 'Light Load';

    rows.push([
      idx++,
      t.code,
      t.name,
      t.designation || 'Instructor',
      primarySubjects || 'General',
      t.assignedBuilding || 'FLOATING',
      past,
      today,
      total,
      avgPerDay,
      status,
    ]);
  }

  return rows;
}

/**
 * 4. Instructor Daily Duty Roster (Active Routine)
 */
export function generateDailyDutyData(
  currentRoutine: DailyRoutine | null,
  teachers: Teacher[],
  classrooms: Classroom[],
  papers: Paper[]
): (string | number)[][] {
  const rows: (string | number)[][] = [];
  if (!currentRoutine) return rows;

  const roomMap = new Map(classrooms.map((c) => [c.id, c]));
  const paperMap = new Map(papers.map((p) => [p.id, p]));

  let idx = 1;
  for (const t of teachers) {
    // Check if teacher is marked absent/leave/duty/sick
    let statusText = 'ACTIVE DUTY';
    if (currentRoutine.absentTeacherIds.includes(t.id)) {
      statusText = 'ABSENT';
    }
    if (currentRoutine.unavailableTeachers) {
      const u = currentRoutine.unavailableTeachers.find((x) => x.teacherId === t.id);
      if (u) {
        statusText = u.type === 'LEAVE' ? 'ON LEAVE' : u.type === 'DUTY' ? 'ON DUTY' : u.type === 'SICK' ? 'SICK' : 'ABSENT';
        if (u.remark) statusText += ` (${u.remark})`;
      }
    }

    // Slots assigned for periods 1 to 5
    const teacherSlots = (currentRoutine.slots || []).filter((s) => s.teacherId === t.id);
    const pSlots: string[] = [];

    for (let p = 1; p <= 5; p++) {
      const slot = teacherSlots.find((s) => s.period === p);
      if (slot) {
        const room = roomMap.get(slot.roomId);
        const paper = paperMap.get(slot.paperId);
        pSlots.push(`${room?.code || slot.roomId} [${paper?.code || slot.paperId}]${slot.isSubstitute ? ' (Sub)' : ''}`);
      } else {
        pSlots.push('-');
      }
    }

    rows.push([
      idx++,
      t.code,
      t.name,
      t.designation || 'Instructor',
      t.assignedBuilding || 'FLOATING',
      pSlots[0],
      pSlots[1],
      pSlots[2],
      pSlots[3],
      pSlots[4],
      teacherSlots.length,
      statusText,
    ]);
  }

  return rows;
}

/**
 * 5. Instructor Mapping Matrix (T1 to T26)
 */
export function generateTeacherMappingData(teachers: Teacher[], papers: Paper[]): (string | number)[][] {
  const rows: (string | number)[][] = [];
  const paperMap = new Map(papers.map((p) => [p.id, p]));

  let idx = 1;
  for (const t of teachers) {
    const primaryStr = t.primaryPaperIds
      .map((pid) => {
        const p = paperMap.get(pid);
        return p ? `${p.code} (${p.title})` : pid;
      })
      .join('; ');

    const backupStr = (t.backupPaperIds || [])
      .map((pid) => {
        const p = paperMap.get(pid);
        return p ? `${p.code}` : pid;
      })
      .join(', ');

    const secStr = (t.secondaryPaperIds || [])
      .map((pid) => {
        const p = paperMap.get(pid);
        return p ? `${p.code}` : pid;
      })
      .join(', ');

    rows.push([
      idx++,
      t.code,
      t.name,
      t.designation || 'Instructor',
      t.assignedBuilding || 'FLOATING',
      primaryStr || 'Practical / General',
      backupStr || '-',
      secStr || '-',
      t.maxDailyPeriods || 4,
      t.phone || 'N/A',
      t.status || 'ACTIVE',
    ]);
  }

  return rows;
}

/**
 * 6. Subject-Wise Primary / Main Instructors Directory
 * e.g., Paper-1 main teachers, Paper-2 main teachers, etc.
 */
export function generateSubjectMainTeachersData(papers: Paper[], teachers: Teacher[]): (string | number)[][] {
  const rows: (string | number)[][] = [];

  for (const paper of papers) {
    // Find all teachers who have this paper in primaryPaperIds
    const mainTeachers = teachers.filter((t) => t.primaryPaperIds.includes(paper.id));

    if (mainTeachers.length === 0) {
      rows.push([
        paper.code,
        paper.title,
        paper.category,
        paper.totalTargetSessions,
        'Flexible (Any Available Instructor conducts Practical)',
        '0',
        'Practical Cadre / Standby instructors',
        'N/A',
      ]);
    } else {
      const names = mainTeachers.map((t) => `[${t.code}] ${t.name} (${t.assignedBuilding || 'FLOATING'})`).join('; ');
      const phones = mainTeachers.map((t) => `${t.name}: ${t.phone || 'N/A'}`).join('; ');

      rows.push([
        paper.code,
        paper.title,
        paper.category,
        paper.totalTargetSessions,
        names,
        mainTeachers.length,
        mainTeachers.map((t) => t.code).join(', '),
        phones,
      ]);
    }
  }

  return rows;
}

/**
 * 7. Subject-Wise Full Faculty Hierarchy (Main + Backup 1 + Backup 2)
 * Paper-wise 3-tier staffing hierarchy
 */
export function generateSubjectFullHierarchyData(papers: Paper[], teachers: Teacher[]): (string | number)[][] {
  const rows: (string | number)[][] = [];

  for (const paper of papers) {
    // 1. Main Teachers
    const mainTeachers = teachers.filter((t) => t.primaryPaperIds.includes(paper.id));
    const mainStr =
      mainTeachers.length > 0
        ? mainTeachers.map((t) => `[${t.code}] ${t.name}`).join('; ')
        : 'All Available Instructors (Practical)';

    // 2. Backup 1 Teachers (Teachers whose backupPaperIds includes this paper, but not primary)
    const backup1Teachers = teachers.filter(
      (t) => !t.primaryPaperIds.includes(paper.id) && t.backupPaperIds && t.backupPaperIds.includes(paper.id)
    );
    const backup1Str =
      backup1Teachers.length > 0
        ? backup1Teachers.map((t) => `[${t.code}] ${t.name} (${t.assignedBuilding || 'FLT'})`).join('; ')
        : 'Assigned as needed';

    // 3. Backup 2 Teachers (Teachers whose secondaryPaperIds includes this paper, or cross-subject backup)
    const backup2Teachers = teachers.filter(
      (t) =>
        !t.primaryPaperIds.includes(paper.id) &&
        (!t.backupPaperIds || !t.backupPaperIds.includes(paper.id)) &&
        ((t.secondaryPaperIds && t.secondaryPaperIds.includes(paper.id)) ||
          (t.crossSubjectBackupPaperIds && t.crossSubjectBackupPaperIds.includes(paper.id)))
    );
    const backup2Str =
      backup2Teachers.length > 0
        ? backup2Teachers.map((t) => `[${t.code}] ${t.name}`).join('; ')
        : 'Reserve Floating Faculty';

    rows.push([
      paper.code,
      paper.title,
      paper.category,
      paper.totalTargetSessions,
      mainStr,
      backup1Str,
      backup2Str,
    ]);
  }

  return rows;
}

/**
 * 8. Instructors Telephone & Contact Directory
 * Complete official calling and contact directory
 */
export function generateInstructorPhoneDirectoryData(teachers: Teacher[], papers: Paper[]): (string | number)[][] {
  const rows: (string | number)[][] = [];
  const paperMap = new Map(papers.map((p) => [p.id, p]));

  let idx = 1;
  for (const t of teachers) {
    const primarySubjectCodes = t.primaryPaperIds.map((pid) => paperMap.get(pid)?.code || pid).join(', ');
    const primarySubjectTitles = t.primaryPaperIds.map((pid) => paperMap.get(pid)?.title || pid).join('; ');

    rows.push([
      idx++,
      t.code,
      t.name,
      t.designation || 'Training Instructor',
      t.phone || '+91 94120 10000',
      t.assignedBuilding || 'FLOATING',
      primarySubjectCodes || 'Practical',
      primarySubjectTitles || 'Applied Practical Training',
      t.status || 'ACTIVE',
      t.email || `${t.code.toLowerCase()}@stc.police.gov.in`,
    ]);
  }

  return rows;
}
