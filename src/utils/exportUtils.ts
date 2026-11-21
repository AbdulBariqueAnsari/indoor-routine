/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppSettings, Classroom, compareClassrooms, compareTeacherCodes, DailyRoutine, Paper, Teacher, UnavailableInstructor, UnavailabilityType } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from './api';
import { buildRoutineSessionNumbersMap } from './scheduler';

export interface ReportDefinition {
  id: string;
  slug?: string;
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
 * Formats date into DD.MM.YYYY format (e.g. 2026-10-11 -> 11.10.2026)
 */
export function formatRoutineDateDDMMYYYY(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }
  const clean = dateStr.trim();
  // YYYY-MM-DD
  const ymd = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    const dd = ymd[3].padStart(2, '0');
    const mm = ymd[2].padStart(2, '0');
    const yyyy = ymd[1];
    return `${dd}.${mm}.${yyyy}`;
  }
  // DD.MM.YYYY
  const dmy = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    const yyyy = dmy[3];
    return `${dd}.${mm}.${yyyy}`;
  }
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }
  return clean;
}

/**
 * Generates official filename in format:
 * <slug>_d<dayNumber>_(<DD.MM.YYYY>)
 * e.g. indoor_routine_d5_(11.10.2026)
 */
export function formatReportFileName(
  slug: string,
  dayNumber?: number,
  dateStr?: string
): string {
  const day = dayNumber ? `_d${dayNumber}` : '';
  const formattedDate = formatRoutineDateDDMMYYYY(dateStr);
  return `${slug}${day}_(${formattedDate})`;
}

/**
 * Extracts and formats active day detail for display at the top of PDF & Excel exports
 */
export function resolveActiveDayDetail(
  meta?: { activeDayNumber?: number; activeDayDate?: string; date?: string },
  fileName?: string,
  sheetTitle?: string
): string | null {
  let dayNum: number | string | undefined = meta?.activeDayNumber;
  let dayDate: string | undefined = meta?.activeDayDate;

  if (!dayNum && fileName) {
    const m = fileName.match(/_d(\d+)_/i);
    if (m) dayNum = m[1];
  }
  if (!dayNum && sheetTitle) {
    const m = sheetTitle.match(/Day\s*(\d+)/i);
    if (m) dayNum = m[1];
  }
  if (!dayDate && fileName) {
    const m = fileName.match(/\(([\d.]+)\)/);
    if (m) dayDate = m[1];
  }
  if (!dayDate && meta?.date) {
    dayDate = meta.date;
  }

  if (dayNum && dayDate) {
    return `DAY ${dayNum} (${formatRoutineDateDDMMYYYY(dayDate)})`;
  }
  if (dayNum) {
    return `DAY ${dayNum}`;
  }
  if (dayDate) {
    return `DATE: ${formatRoutineDateDDMMYYYY(dayDate)}`;
  }
  return null;
}

/**
 * Triggers instant download of a clean formatted Excel (.xls) file
 * and simultaneously saves directly to the server's exports directory (replaces if exists).
 */
export async function exportToExcel(
  fileName: string,
  sheetTitle: string,
  headers: string[],
  rows: (string | number)[][],
  meta?: {
    centreName?: string;
    institutionName?: string;
    address?: string;
    date?: string;
    activeDayNumber?: number;
    activeDayDate?: string;
  },
  downloadInBrowser: boolean = false
) {
  const safeTitle = sheetTitle.replace(/[\\/*?[\]:]/g, ' ');
  const safeFileName = fileName.endsWith('.xls') ? fileName : `${fileName}.xls`;
  const activeDayText = resolveActiveDayDetail(meta, safeFileName, sheetTitle);

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
      .active-day-bar { font-size: 10.5pt; font-weight: bold; text-align: center; background-color: #e0e7ff; color: #1e1b4b; padding: 5px; }
      .meta-bar { font-size: 9pt; color: #475569; text-align: center; padding: 4px; }
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
      ${activeDayText ? `<tr><td colspan="${headers.length}" class="active-day-bar">ACTIVE SCHEDULE DAY: ${activeDayText}</td></tr>` : ''}
      <tr><td colspan="${headers.length}" class="meta-bar">DOCUMENT: OFFICIAL ACADEMIC RECORD &nbsp;&nbsp;|&nbsp;&nbsp; TOTAL ENTRIES: ${rows.length} ROWS &nbsp;&nbsp;|&nbsp;&nbsp; DATE GENERATED: ${meta?.date || new Date().toLocaleDateString('en-GB')}</td></tr>
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

  // 1. Save directly to server's exports directory (replaces if existing)
  try {
    await api.saveExportFile(safeFileName, html, false);
  } catch (err) {
    console.warn('[Export] Could not save directly to exports folder:', err);
  }

  // 2. Browser download only if explicitly requested
  if (downloadInBrowser) {
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

  return { success: true, fileName: safeFileName };
}

/**
 * Generates an official styled PDF document, downloads in browser,
 * and simultaneously saves directly to the server's exports directory (replaces if existing).
 */
export async function exportToPdf(
  fileName: string,
  sheetTitle: string,
  headers: string[],
  rows: (string | number)[][],
  meta?: {
    centreName?: string;
    institutionName?: string;
    address?: string;
    date?: string;
    activeDayNumber?: number;
    activeDayDate?: string;
    orientation?: 'landscape' | 'portrait';
    paperSize?: 'a4' | 'legal' | 'letter';
    includeHeader?: boolean;
    includeSignatures?: boolean;
  },
  downloadInBrowser: boolean = false
) {
  const safeFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const isLandscape = meta?.orientation ? meta.orientation === 'landscape' : headers.length > 6;
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: meta?.paperSize || 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const includeHeader = meta?.includeHeader !== false;
  const includeSignatures = meta?.includeSignatures !== false;
  const activeDayText = resolveActiveDayDetail(meta, safeFileName, sheetTitle);

  let currentY = 28;

  if (includeHeader) {
    // Draw Academy Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 58, 138); // navy blue
    doc.text(meta?.centreName || 'SUBSIDIARY TRAINING CENTRE', pageWidth / 2, 32, { align: 'center' });

    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(meta?.institutionName || 'STC, SAP 4TH BN', pageWidth / 2, 47, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(meta?.address || 'Kasba, Raiganj, Uttar Dinajpur', pageWidth / 2, 59, { align: 'center' });

    currentY = 68;
  }

  // Document Title Box
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(25, currentY, pageWidth - 50, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(sheetTitle.toUpperCase(), pageWidth / 2, currentY + 13, { align: 'center' });

  // Metadata bar with Active Day Details prominently at top
  currentY += 25;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('DOCUMENT: OFFICIAL ACADEMIC RECORD', 25, currentY);

  if (activeDayText) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(`ACTIVE DAY: ${activeDayText.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`TOTAL ENTRIES: ${rows.length} ROWS`, pageWidth - 25, currentY, { align: 'right' });

  currentY += 5;

  // Adjust font size based on column count so wide tables fit neatly
  const colCount = headers.length;
  const tableFontSize = colCount > 15 ? 6 : colCount > 10 ? 7 : colCount > 7 ? 7.5 : 8.5;
  const cellPadding = colCount > 12 ? 2.5 : 3.5;

  autoTable(doc, {
    startY: currentY + 6,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: tableFontSize,
      cellPadding,
      lineWidth: 0.5,
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      textColor: [15, 23, 42],
      fontSize: tableFontSize,
      cellPadding,
      lineWidth: 0.5,
      lineColor: [203, 213, 225],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 25, right: 25, bottom: includeSignatures ? 40 : 25 },
    didDrawPage: (data) => {
      // Bottom footer bar on each page: Date Generated placed on Bottom-Left Corner
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const dateText = meta?.date ? `Date Generated: ${meta.date}  ·  ` : '';
      doc.text(
        `${dateText}STC, SAP 4th Bn · Official Academic Record · Page ${data.pageNumber}`,
        25,
        pageHeight - 15
      );
      if (includeSignatures) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(
          'O/C STC (Indoor)',
          pageWidth - 25,
          pageHeight - 15,
          { align: 'right' }
        );
      }
    },
  });

  // 1. Save directly to server's exports directory (replaces if existing)
  try {
    const rawDataUri = doc.output('datauristring');
    const base64Data = rawDataUri.includes(';base64,') ? rawDataUri.split(';base64,')[1] : rawDataUri;
    await api.saveExportFile(safeFileName, base64Data, true);
  } catch (err) {
    console.warn('[Export] Could not save directly to exports folder:', err);
  }

  // 2. Trigger browser download only if explicitly requested
  if (downloadInBrowser) {
    doc.save(safeFileName);
  }

  return { success: true, fileName: safeFileName };
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
// DATA GENERATORS FOR OFFICIAL DOWNLOAD REPORTS
// =========================================================================

/**
 * 0. Daily Indoor Class Routine (Active Master Schedule)
 */
export function generateIndoorRoutineData(
  currentRoutine: DailyRoutine | null,
  classrooms: Classroom[],
  papers: Paper[],
  teachers: Teacher[],
  allRoutines: DailyRoutine[] = []
): (string | number)[][] {
  if (!currentRoutine || !currentRoutine.slots) return [];

  const paperMap = new Map(papers.map((p) => [p.id, p]));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const sessionNumbersMap = buildRoutineSessionNumbersMap(currentRoutine, allRoutines);

  const sortedClassrooms = [...classrooms].sort(compareClassrooms);
  const rows: (string | number)[][] = [];

  for (const room of sortedClassrooms) {
    const periodSlots: string[] = [];
    for (let p = 1; p <= 5; p++) {
      const slot = currentRoutine.slots.find((s) => s.roomId === room.id && s.period === p);
      if (slot) {
        const paper = paperMap.get(slot.paperId);
        const teacher = teacherMap.get(slot.teacherId);
        const subTag = slot.isSubstitute ? ' (Sub)' : '';
        const practicalTag = slot.practicalName ? ` (${slot.practicalName})` : '';
        const examTag = slot.isExam ? ` (${slot.examName || 'Exam'})` : '';
        const sessionNum = sessionNumbersMap.get(slot.id) || sessionNumbersMap.get(`${slot.roomId}_${slot.period}`) || 0;
        const sessionTag = sessionNum > 0 ? ` (${sessionNum})` : '';
        periodSlots.push(`${paper?.code || slot.paperId}${practicalTag}${examTag} - ${teacher?.name || slot.teacherId}${sessionTag}${subTag}`);
      } else {
        periodSlots.push('-');
      }
    }

    rows.push([
      room.name,
      room.code,
      room.building === 'OLD' ? 'Old Bldg' : 'New Bldg',
      room.capacity,
      periodSlots[0],
      periodSlots[1],
      periodSlots[2],
      periodSlots[3],
      periodSlots[4],
    ]);
  }

  return rows;
}

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

  const sortedClassrooms = [...classrooms].sort(compareClassrooms);
  const sortedPapers = [...papers].sort((a, b) => a.code.localeCompare(b.code));

  for (const room of sortedClassrooms) {
    for (const paper of sortedPapers) {
      const key = `${room.id}:${paper.id}`;
      const completed = roomPaperCounts.get(key) || 0;
      const today = todayCounts.get(key) || 0;
      const total = completed + today;
      const target = paper.totalTargetSessions > 0 ? paper.totalTargetSessions : 30;
      const remaining = Math.max(0, target - total);
      const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 100;

      rows.push([
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
  const sortedTeachers = [...teachers].sort(compareTeacherCodes);

  // Build room-wise delivery map for each teacher
  const teacherRoomDeliveries = new Map<string, Map<string, number>>();
  for (const t of sortedTeachers) {
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

  const sortedClassrooms = [...classrooms].sort(compareClassrooms);

  for (const t of sortedTeachers) {
    const roomMap = teacherRoomDeliveries.get(t.id) || new Map<string, number>();
    let totalSessions = 0;

    const roomCounts = sortedClassrooms.map((c) => {
      const count = roomMap.get(c.id) || 0;
      totalSessions += count;
      return count;
    });

    rows.push([
      t.code,
      t.name,
      ...roomCounts,
      totalSessions,
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
  const sortedTeachers = [...teachers].sort(compareTeacherCodes);
  for (const t of sortedTeachers) {
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
      primarySubjects || 'General',
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
  const sortedTeachers = [...teachers].sort(compareTeacherCodes);

  for (const t of sortedTeachers) {
    // Check if teacher is marked absent/leave/duty/sick
    let statusText = 'ACTIVE DUTY';
    if (currentRoutine.absentTeacherIds.includes(t.id)) {
      statusText = 'ABSENT';
    }
    if (currentRoutine.unavailableTeachers) {
      const u = currentRoutine.unavailableTeachers.find((x) => x.teacherId === t.id);
      if (u) {
        statusText = u.type === 'LEAVE' ? 'ON LEAVE' : u.type === 'DUTY' ? 'ON DUTY' : u.type === 'SICK' ? 'SICK' : u.type === 'REST' ? 'REST / STANDBY' : 'ABSENT';
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
        const practicalTag = slot.practicalName ? ` (${slot.practicalName})` : '';
        pSlots.push(`${room?.code || slot.roomId} [${paper?.code || slot.paperId}${practicalTag}]${slot.isSubstitute ? ' (Sub)' : ''}`);
      } else {
        pSlots.push('-');
      }
    }

    rows.push([
      t.code,
      t.name,
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
  const sortedTeachers = [...teachers].sort(compareTeacherCodes);
  for (const t of sortedTeachers) {
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
    const mainTeachers = teachers
      .filter((t) => t.primaryPaperIds.includes(paper.id))
      .sort(compareTeacherCodes);

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
    const mainTeachers = teachers
      .filter((t) => t.primaryPaperIds.includes(paper.id))
      .sort(compareTeacherCodes);
    const mainStr =
      mainTeachers.length > 0
        ? mainTeachers.map((t) => `[${t.code}] ${t.name}`).join('; ')
        : 'All Available Instructors (Practical)';

    // 2. Backup 1 Teachers (Teachers whose backupPaperIds includes this paper, but not primary)
    const backup1Teachers = teachers
      .filter(
        (t) => !t.primaryPaperIds.includes(paper.id) && t.backupPaperIds && t.backupPaperIds.includes(paper.id)
      )
      .sort(compareTeacherCodes);
    const backup1Str =
      backup1Teachers.length > 0
        ? backup1Teachers.map((t) => `[${t.code}] ${t.name} (${t.assignedBuilding || 'FLT'})`).join('; ')
        : 'Assigned as needed';

    // 3. Backup 2 Teachers (Teachers whose secondaryPaperIds includes this paper, or cross-subject backup)
    const backup2Teachers = teachers
      .filter(
        (t) =>
          !t.primaryPaperIds.includes(paper.id) &&
          (!t.backupPaperIds || !t.backupPaperIds.includes(paper.id)) &&
          ((t.secondaryPaperIds && t.secondaryPaperIds.includes(paper.id)) ||
            (t.crossSubjectBackupPaperIds && t.crossSubjectBackupPaperIds.includes(paper.id)))
      )
      .sort(compareTeacherCodes);
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
  const sortedTeachers = [...teachers].sort(compareTeacherCodes);
  for (const t of sortedTeachers) {
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

export interface TeacherUnavailabilityIncident {
  date: string;
  dayNumber: number;
  routineId?: string;
  type: UnavailabilityType;
  remark: string;
  routineStatus?: string;
}

export interface TeacherUnavailabilitySummary {
  teacher: Teacher;
  totalUnavailableDays: number;
  leaveCount: number;
  dutyCount: number;
  sickCount: number;
  restCount: number;
  absentCount: number;
  totalRoutinesCount: number;
  attendanceRate: number; // percentage (0 - 100)
  incidents: TeacherUnavailabilityIncident[];
}

/**
 * Computes consolidated faculty unavailability statistics and incident details across all daily routines.
 */
export function computeInstructorUnavailabilityStats(
  teachers: Teacher[],
  allRoutines: DailyRoutine[],
  standaloneUnavailability: UnavailableInstructor[] = []
): TeacherUnavailabilitySummary[] {
  const sortedRoutines = [...allRoutines].sort((a, b) => a.dayNumber - b.dayNumber);
  const totalRoutinesCount = Math.max(1, sortedRoutines.length);
  const sortedTeachers = [...teachers].sort(compareTeacherCodes);

  const summaryMap = new Map<string, TeacherUnavailabilitySummary>();
  for (const t of sortedTeachers) {
    summaryMap.set(t.id, {
      teacher: t,
      totalUnavailableDays: 0,
      leaveCount: 0,
      dutyCount: 0,
      sickCount: 0,
      restCount: 0,
      absentCount: 0,
      totalRoutinesCount,
      attendanceRate: 100,
      incidents: [],
    });
  }

  // Track routine-based unavailability
  for (const r of sortedRoutines) {
    const recordedInRoutine = new Set<string>();

    if (r.unavailableTeachers && r.unavailableTeachers.length > 0) {
      for (const u of r.unavailableTeachers) {
        const item = summaryMap.get(u.teacherId);
        if (item) {
          recordedInRoutine.add(u.teacherId);
          item.totalUnavailableDays++;
          const type = (u.type || 'ABSENT').toUpperCase() as UnavailabilityType;
          if (type === 'LEAVE') item.leaveCount++;
          else if (type === 'DUTY') item.dutyCount++;
          else if (type === 'SICK') item.sickCount++;
          else if (type === 'REST') item.restCount++;
          else item.absentCount++;

          item.incidents.push({
            date: u.date || r.date,
            dayNumber: r.dayNumber,
            routineId: r.id,
            type,
            remark: u.remark || `${type} Record`,
            routineStatus: r.status || 'published',
          });
        }
      }
    }

    for (const tid of r.absentTeacherIds || []) {
      if (!recordedInRoutine.has(tid)) {
        const item = summaryMap.get(tid);
        if (item) {
          recordedInRoutine.add(tid);
          item.totalUnavailableDays++;
          item.absentCount++;
          item.incidents.push({
            date: r.date,
            dayNumber: r.dayNumber,
            routineId: r.id,
            type: 'ABSENT',
            remark: 'Marked Absent',
            routineStatus: r.status || 'published',
          });
        }
      }
    }
  }

  // Include standalone records if they belong to dates not present in allRoutines
  const routineDates = new Set(sortedRoutines.map((r) => r.date));
  for (const u of standaloneUnavailability) {
    if (u.date && !routineDates.has(u.date)) {
      const item = summaryMap.get(u.teacherId);
      if (item) {
        item.totalUnavailableDays++;
        const type = (u.type || 'ABSENT').toUpperCase() as UnavailabilityType;
        if (type === 'LEAVE') item.leaveCount++;
        else if (type === 'DUTY') item.dutyCount++;
        else if (type === 'SICK') item.sickCount++;
        else if (type === 'REST') item.restCount++;
        else item.absentCount++;

        item.incidents.push({
          date: u.date,
          dayNumber: 0,
          type,
          remark: u.remark || 'Standalone Register Entry',
          routineStatus: 'register',
        });
      }
    }
  }

  // Calculate attendance percentages
  for (const item of summaryMap.values()) {
    const presentDays = Math.max(0, totalRoutinesCount - item.totalUnavailableDays);
    item.attendanceRate = Math.round((presentDays / totalRoutinesCount) * 1000) / 10;
  }

  return Array.from(summaryMap.values()).sort((a, b) => compareTeacherCodes(a.teacher, b.teacher));
}

/**
 * 9. Instructor Unavailability Summary Data Generator (Excel & CSV)
 */
export function generateInstructorUnavailabilityData(
  teachers: Teacher[],
  allRoutines: DailyRoutine[],
  standaloneUnavailability: UnavailableInstructor[] = []
): (string | number)[][] {
  const stats = computeInstructorUnavailabilityStats(teachers, allRoutines, standaloneUnavailability);
  const rows: (string | number)[][] = [];

  let idx = 1;
  for (const item of stats) {
    const formattedIncidents = item.incidents.length > 0
      ? item.incidents
          .map((inc) => `Day ${inc.dayNumber || 'Ext'} (${inc.date}) [${inc.type}]: ${inc.remark || 'No remark'}`)
          .join('; ')
      : 'Full Attendance (0 Absent Days)';

    rows.push([
      idx++,
      item.teacher.code,
      item.teacher.name,
      item.teacher.designation || 'Instructor',
      item.teacher.assignedBuilding || 'FLOATING',
      item.totalUnavailableDays,
      item.leaveCount,
      item.dutyCount,
      item.sickCount,
      item.restCount,
      item.absentCount,
      `${item.attendanceRate}%`,
      formattedIncidents,
    ]);
  }

  return rows;
}

/**
 * 10. Unavailability Incident Log Data Generator (Chronological per incident)
 */
export function generateUnavailabilityIncidentLogData(
  teachers: Teacher[],
  allRoutines: DailyRoutine[],
  standaloneUnavailability: UnavailableInstructor[] = []
): (string | number)[][] {
  const stats = computeInstructorUnavailabilityStats(teachers, allRoutines, standaloneUnavailability);
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const rows: (string | number)[][] = [];

  const allIncidents: {
    incident: TeacherUnavailabilityIncident;
    teacher: Teacher;
  }[] = [];

  for (const s of stats) {
    for (const inc of s.incidents) {
      allIncidents.push({
        incident: inc,
        teacher: s.teacher,
      });
    }
  }

  allIncidents.sort((a, b) => {
    if (a.incident.dayNumber !== b.incident.dayNumber) {
      return a.incident.dayNumber - b.incident.dayNumber;
    }
    if (a.incident.date !== b.incident.date) {
      return a.incident.date.localeCompare(b.incident.date);
    }
    return compareTeacherCodes(a.teacher, b.teacher);
  });

  let idx = 1;
  for (const item of allIncidents) {
    rows.push([
      idx++,
      item.incident.date,
      item.incident.dayNumber > 0 ? `Day ${item.incident.dayNumber}` : 'General',
      item.teacher.code,
      item.teacher.name,
      item.teacher.designation || 'Instructor',
      item.incident.type,
      item.incident.remark || '',
      item.incident.routineStatus || 'published',
    ]);
  }

  return rows;
}
