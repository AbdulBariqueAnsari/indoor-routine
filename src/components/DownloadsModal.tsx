/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppSettings, Classroom, ColumnConfig, compareClassrooms, DailyRoutine, Paper, ReportPageSetupConfig, Teacher } from '../types';
import {
  exportToExcel,
  exportToPdf,
  formatReportFileName,
  formatRoutineDateDDMMYYYY,
  generateDailyDutyData,
  generateDeploymentTrackerData,
  generateIndoorRoutineData,
  generateInstructorLedgerData,
  generateInstructorPhoneDirectoryData,
  generateInstructorUnavailabilityData,
  generateSessionCounterData,
  generateSubjectFullHierarchyData,
  generateSubjectMainTeachersData,
  generateTeacherMappingData,
  generateUnavailabilityIncidentLogData,
} from '../utils/exportUtils';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layers,
  Phone,
  Printer,
  Search,
  Shield,
  Table,
  UserCheck,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface DownloadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  papers: Paper[];
  classrooms: Classroom[];
  allRoutines: DailyRoutine[];
  currentRoutine: DailyRoutine | null;
  settings?: AppSettings;
}

interface ActivePrintPreview {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
  fileName: string;
}

export const DownloadsModal: React.FC<DownloadsModalProps> = ({
  isOpen,
  onClose,
  teachers,
  papers,
  classrooms,
  allRoutines,
  currentRoutine,
  settings,
}) => {
  const { shouldRender, backdropAnimationClass, modalAnimationClass } = useModalAnimation(isOpen);
  const [activeTab, setActiveTab] = useState<'all' | 'faculty' | 'curriculum'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);
  const [activePrintPreview, setActivePrintPreview] = useState<ActivePrintPreview | null>(null);

  useEffect(() => {
    if (activePrintPreview) {
      document.body.classList.add('printing-active-report');
    } else {
      document.body.classList.remove('printing-active-report');
    }
    return () => {
      document.body.classList.remove('printing-active-report');
    };
  }, [activePrintPreview]);

  if (!shouldRender) return null;

  const showToast = (msg: string) => {
    setDownloadSuccessToast(msg);
    setTimeout(() => {
      setDownloadSuccessToast(null);
    }, 3500);
  };

  const centreName = settings?.trainingCenterName || 'SUBSIDIARY TRAINING CENTRE';
  const institutionName = settings?.institutionName || 'STC, SAP 4TH BN';
  const address = settings?.address || 'Kasba, Raiganj, Uttar Dinajpur';

  // Official Reports Definitions (With Dynamic Naming: <slug>_d<dayNumber>_(<DD.MM.YYYY>))
  const reports = [
    {
      id: 'indoor-routine',
      title: `Daily Indoor Routine (Day ${currentRoutine?.dayNumber || 1})`,
      subtitle: 'Official 15-classroom timetable matrix with period timings, subject allocations and substitutes',
      category: 'curriculum',
      icon: Clock,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      recordCount: '15 Classrooms × 5 Periods (75 Sessions)',
      getFileName: () => formatReportFileName('indoor_routine', currentRoutine?.dayNumber || 1, currentRoutine?.date),
      getHeaders: () => [
        'Room Name',
        'Room Code',
        'Building',
        'Capacity',
        'Period 1 (09:40-10:20)',
        'Period 2 (10:25-11:05)',
        'Period 3 (11:10-11:50)',
        'Period 4 (12:05-12:45)',
        'Period 5 (12:50-13:30)',
      ],
      getData: () => generateIndoorRoutineData(currentRoutine, classrooms, papers, teachers, allRoutines),
    },
    {
      id: 'session-counter',
      title: 'Session Counter (Room-wise Subject Progress)',
      subtitle: 'Complete classroom-by-classroom syllabus completion, quotas, and remaining sessions',
      category: 'curriculum',
      icon: Calendar,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      recordCount: `${classrooms.length * papers.length} entries (15 Rooms × 13 Papers)`,
      getFileName: () => formatReportFileName('session_counter', currentRoutine?.dayNumber || 1, currentRoutine?.date),
      getHeaders: () => [
        'Room Name',
        'Building',
        'Paper Code',
        'Paper Title',
        'Target Sessions',
        'Past Completed',
        'Today Scheduled',
        'Total Completed',
        'Remaining Quota',
        'Progress %',
      ],
      getData: () => generateSessionCounterData(classrooms, papers, allRoutines, currentRoutine),
    },
    {
      id: 'deployment-tracker',
      title: 'Instructor Deployment Tracker',
      subtitle: 'Classroom visit frequencies and multi-day teacher distribution across 15 rooms',
      category: 'faculty',
      icon: Users,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      recordCount: `${teachers.length} Instructors across 15 Classrooms`,
      getFileName: () => formatReportFileName('deployment_tracker', currentRoutine?.dayNumber || 1, currentRoutine?.date),
      getHeaders: () => [
        'Teacher Code',
        'Instructor Name',
        ...[...classrooms].sort(compareClassrooms).map((c) => c.name || `Room ${c.roomNumber}`),
        'Total Sessions',
      ],
      getData: () => generateDeploymentTrackerData(teachers, classrooms, allRoutines, currentRoutine),
    },
    {
      id: 'instructor-ledger',
      title: 'Instructor Academic Workload Ledger',
      subtitle: 'Historical workload accounting, today sessions, cumulative totals, and daily average',
      category: 'faculty',
      icon: Table,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      recordCount: `${teachers.length} Instructors Workload Records`,
      getFileName: () => formatReportFileName('instructor_ledger', currentRoutine?.dayNumber || 1, currentRoutine?.date),
      getHeaders: () => [
        'Sl No',
        'Teacher Code',
        'Instructor Name',
        'Primary Subject(s)',
        'Past Days Load',
        "Today's Load",
        'Cumulative Total',
        'Daily Average',
        'Equalization Status',
      ],
      getData: () => generateInstructorLedgerData(teachers, papers, allRoutines, currentRoutine),
    },
    {
      id: 'instructor-duty',
      title: 'Instructor Daily Duty Roster',
      subtitle: 'Period 1 to Period 5 assignments, room allocations, substitutes, and duty statuses',
      category: 'faculty',
      icon: UserCheck,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      recordCount: `${teachers.length} Instructors (Day ${currentRoutine?.dayNumber || 1})`,
      getFileName: () => formatReportFileName('instructor_duty', currentRoutine?.dayNumber || 1, currentRoutine?.date),
      getHeaders: () => [
        'Teacher Code',
        'Instructor Name',
        'Period 1 (09:40-10:20)',
        'Period 2 (10:25-11:05)',
        'Period 3 (11:10-11:50)',
        'Period 4 (12:05-12:45)',
        'Period 5 (12:50-13:30)',
        'Total Periods Today',
        'Faculty Status',
      ],
      getData: () => generateDailyDutyData(currentRoutine, teachers, classrooms, papers),
    },
    {
      id: 'instructor-mapping',
      title: `Instructor Mapping Matrix (T1–T${teachers.length})`,
      subtitle: 'Master faculty register with primary subject codes, backups, and daily period caps',
      category: 'faculty',
      icon: Database,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      recordCount: `${teachers.length} Master Faculty Profiles`,
      getFileName: () => formatReportFileName('instructor_mapping', currentRoutine?.dayNumber || 1, currentRoutine?.date),
      getHeaders: () => [
        'Sl No',
        'Teacher Code',
        'Instructor Name',
        'Designation',
        'Campus Base',
        'Primary Paper Assignments',
        'Backup Papers',
        'Secondary Papers',
        'Max Daily Limit',
        'Contact Number',
        'Faculty Status',
      ],
      getData: () => generateTeacherMappingData(teachers, papers),
    },
    {
      id: 'subject-main-teachers',
      title: 'Subject-wise Primary Instructors Directory',
      subtitle: 'List of designated main / primary teachers for Paper 1, Paper 2 up to Paper 13',
      category: 'curriculum',
      icon: GraduationCap,
      color: 'text-teal-600 bg-teal-50 border-teal-200',
      recordCount: `${papers.length} Subject Papers (Paper-1 to Paper-13)`,
      getFileName: () => formatReportFileName('subject_main_teachers', currentRoutine?.dayNumber || 1, currentRoutine?.date),
      getHeaders: () => [
        'Paper Code',
        'Subject Title',
        'Category',
        'Quota Sessions',
        'Main / Primary Instructors',
        'Main Faculty Count',
        'Teacher Codes',
        'Instructor Contact Numbers',
      ],
      getData: () => generateSubjectMainTeachersData(papers, teachers),
    },
    {
      id: 'subject-hierarchy',
      title: 'Subject-wise Staffing Hierarchy (Main + Backup 1 + Backup 2)',
      subtitle: '3-tier emergency substitution and backup deployment tree for each subject paper',
      category: 'curriculum',
      icon: Layers,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      recordCount: `${papers.length} Subject Papers with 3-tier Fallbacks`,
      getFileName: () => formatReportFileName('subject_hierarchy', currentRoutine?.dayNumber || 1, currentRoutine?.date),
      getHeaders: () => [
        'Paper Code',
        'Subject Title',
        'Category',
        'Quota Sessions',
        'Main / Primary Instructor(s)',
        'Backup 1 Instructor(s)',
        'Backup 2 Instructor(s)',
      ],
      getData: () => generateSubjectFullHierarchyData(papers, teachers),
    },
    {
      id: 'instructor-directory',
      title: 'Instructors Telephone & Contact Directory',
      subtitle: 'Official faculty calling directory with mobile numbers, ranks, and primary subjects',
      category: 'faculty',
      icon: Phone,
      color: 'text-sky-600 bg-sky-50 border-sky-200',
      recordCount: `${teachers.length} Instructors with Mobile Numbers`,
      getFileName: () => formatReportFileName('phone_directory', currentRoutine?.dayNumber || 1, currentRoutine?.date),
      getHeaders: () => [
        'Sl No',
        'Teacher Code',
        'Instructor Name',
        'Rank / Designation',
        'Mobile / Telephone Number',
        'Campus Base',
        'Primary Subject Code',
        'Subject Title',
        'Duty Status',
        'Official Email',
      ],
      getData: () => generateInstructorPhoneDirectoryData(teachers, papers),
    },
    {
      id: 'instructor-unavailability',
      title: 'Instructor Unavailability & Leave Ledger',
      subtitle: 'Complete breakdown of instructor leaves, special duties, sick records, rest, and absences across all routines',
      category: 'faculty',
      icon: UserX,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      recordCount: `${teachers.length} Instructors Across ${allRoutines.length} Routines`,
      getFileName: () => formatReportFileName('instructor_unavailability', currentRoutine?.dayNumber || 1, currentRoutine?.date),
      getHeaders: () => [
        'Sl No',
        'Teacher Code',
        'Instructor Name',
        'Designation',
        'Campus Base',
        'Total Unavailable Days',
        'Leave (Casual/Earned)',
        'Special Duty',
        'Sick / Medical',
        'Rest (Standby Reserve)',
        'Absent (Uninformed)',
        'Attendance Rate (%)',
        'Date-wise Details & Remarks Log',
      ],
      getData: () => generateInstructorUnavailabilityData(teachers, allRoutines),
    },
    {
      id: 'unavailability-incident-log',
      title: 'Unavailability Incident Log (Chronological)',
      subtitle: 'Date-wise chronological log of all leave, duty, sick, rest, and absence incidents across routines',
      category: 'faculty',
      icon: Clock,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      recordCount: `All Logged Incidents Across ${allRoutines.length} Routines`,
      getFileName: () => formatReportFileName('unavailability_incident_log', currentRoutine?.dayNumber || 1, currentRoutine?.date),
      getHeaders: () => [
        'Sl No',
        'Date',
        'Day Number',
        'Teacher Code',
        'Instructor Name',
        'Designation',
        'Unavailability Type',
        'Remark / Reason',
        'Routine Status',
      ],
      getData: () => generateUnavailabilityIncidentLogData(teachers, allRoutines),
    },
  ];

  const getReportConfig = (reportId: string): ReportPageSetupConfig | undefined => {
    return (
      settings?.downloadsConfig?.reports?.[reportId] ||
      (reportId === 'instructor-directory' ? settings?.downloadsConfig?.reports?.['phone-directory'] : undefined) ||
      (reportId === 'phone-directory' ? settings?.downloadsConfig?.reports?.['instructor-directory'] : undefined)
    );
  };

  const filteredReports = reports.filter((r) => {
    // Check if report is excluded in Page Setup downloads configuration
    const config = getReportConfig(r.id);
    if (config && config.enabled === false) {
      return false;
    }
    const matchesTab = activeTab === 'all' || r.category === activeTab;
    const matchesQuery =
      searchQuery.trim() === '' ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesQuery;
  });

  const getCustomizedReportData = (report: (typeof reports)[0]) => {
    const rawHeaders = report.getHeaders();
    const rawRows = report.getData();
    const config = getReportConfig(report.id);
    const reportTitle = config?.customTitle || report.title;
    const reportSubtitle = config?.customSubtitle || report.subtitle;

    if (!config || !config.columns || config.columns.length === 0) {
      return {
        title: reportTitle,
        subtitle: reportSubtitle,
        headers: rawHeaders,
        rows: rawRows,
        fileName: report.getFileName(),
        config,
      };
    }

    // Match enabled columns and customized labels
    const columnIndicesToKeep: number[] = [];
    const customizedHeaders: string[] = [];

    config.columns.forEach((col: ColumnConfig, idx: number) => {
      // Find matching raw header index by defaultLabel or by direct index
      let targetIdx = idx;
      if (targetIdx >= rawHeaders.length || rawHeaders[targetIdx] !== col.defaultLabel) {
        const found = rawHeaders.findIndex(
          (h) => h.trim().toLowerCase() === (col.defaultLabel || '').trim().toLowerCase()
        );
        if (found !== -1) {
          targetIdx = found;
        }
      }

      if (targetIdx >= 0 && targetIdx < rawHeaders.length) {
        if (col.enabled !== false) {
          columnIndicesToKeep.push(targetIdx);
          customizedHeaders.push(col.customLabel || col.defaultLabel || rawHeaders[targetIdx]);
        }
      }
    });

    if (columnIndicesToKeep.length === 0) {
      return {
        title: reportTitle,
        subtitle: reportSubtitle,
        headers: rawHeaders,
        rows: rawRows,
        fileName: report.getFileName(),
        config,
      };
    }

    const customizedRows = rawRows.map((row) =>
      columnIndicesToKeep.map((colIdx) => row[colIdx])
    );

    return {
      title: reportTitle,
      subtitle: reportSubtitle,
      headers: customizedHeaders,
      rows: customizedRows,
      fileName: report.getFileName(),
      config,
    };
  };

  const handleDownloadExcel = async (report: (typeof reports)[0]) => {
    const { title, headers, rows, fileName } = getCustomizedReportData(report);
    await exportToExcel(fileName, title, headers, rows, {
      centreName,
      institutionName,
      address,
      date: formatRoutineDateDDMMYYYY(currentRoutine?.date),
      activeDayNumber: currentRoutine?.dayNumber,
      activeDayDate: currentRoutine?.date,
    });
    showToast(`Excel workbook "${fileName}.xls" exported to exports folder!`);
  };

  const handleDownloadPdf = async (report: (typeof reports)[0]) => {
    const { title, headers, rows, fileName, config } = getCustomizedReportData(report);
    await exportToPdf(fileName, title, headers, rows, {
      centreName,
      institutionName,
      address,
      date: formatRoutineDateDDMMYYYY(currentRoutine?.date),
      activeDayNumber: currentRoutine?.dayNumber,
      activeDayDate: currentRoutine?.date,
      orientation: config?.orientation,
      paperSize: config?.paperSize,
      includeHeader: config?.includeHeader,
      includeSignatures: config?.includeSignatures,
    });
    showToast(`PDF document "${fileName}.pdf" exported to exports folder!`);
  };

  const handleOpenPrintPreview = (report: (typeof reports)[0]) => {
    const { title, subtitle, headers, rows, fileName } = getCustomizedReportData(report);
    setActivePrintPreview({
      title,
      subtitle,
      headers,
      rows,
      fileName,
    });
  };

  return (
    <>
      {/* Downloads Hub Modal Window */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs no-print ${backdropAnimationClass}`}>
        <div className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden ${modalAnimationClass}`}>
          {/* Modal Header */}
          <div className="px-5 py-4 border-b border-slate-200 bg-linear-to-r from-slate-50 via-indigo-50/30 to-emerald-50/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Downloads & Reports Export Hub
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    PDF & Excel Exports
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {centreName} · {institutionName} · Official Registers & Academic Downloads
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
              title="Close Downloads Hub"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            {/* Category Tabs */}
            <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg text-xs w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Reports ({reports.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('faculty')}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  activeTab === 'faculty'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Faculty & Staffing (5)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('curriculum')}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  activeTab === 'curriculum'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Curriculum & Quotas (3)
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports by title or keyword..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Toast Notification */}
          {downloadSuccessToast && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2 flex items-center justify-between text-xs text-emerald-800 font-semibold animate-in fade-in duration-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{downloadSuccessToast}</span>
              </div>
              <button
                onClick={() => setDownloadSuccessToast(null)}
                className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Reports Grid */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredReports.map((report, idx) => {
                const IconComponent = report.icon;
                const config = getReportConfig(report.id);
                const displayTitle = config?.customTitle || report.title;
                const displaySubtitle = config?.customSubtitle || report.subtitle;
                const activeCols = config?.columns ? config.columns.filter((c: ColumnConfig) => c.enabled !== false).length : report.getHeaders().length;
                const totalCols = config?.columns?.length || report.getHeaders().length;

                return (
                  <div
                    key={report.id}
                    className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${report.color}`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-400 font-mono">
                              #{idx + 1}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {totalCols ? (
                                <span className="text-[9.5px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-mono">
                                  {activeCols}/{totalCols} Cols
                                </span>
                              ) : null}
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                {report.recordCount}
                              </span>
                            </div>
                          </div>
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug mt-0.5">
                            {displayTitle}
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                            {displaySubtitle}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Excel (.xls), PDF (.pdf), Print Preview */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {/* Download Excel (.xls) */}
                        <button
                          type="button"
                          onClick={() => handleDownloadExcel(report)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 transition-colors shadow-2xs cursor-pointer"
                          title="Download Excel spreadsheet and save directly to exports folder"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Excel (.xls)</span>
                        </button>

                        {/* Download PDF (.pdf) */}
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(report)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100 hover:border-rose-400 transition-colors shadow-2xs cursor-pointer"
                          title="Download official PDF and save directly to exports folder"
                        >
                          <FileText className="w-3.5 h-3.5 text-rose-600" />
                          <span>PDF (.pdf)</span>
                        </button>
                      </div>

                      {/* PDF Print Preview Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenPrintPreview(report)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors shadow-2xs cursor-pointer ml-auto"
                        title="Open Print-ready document formatted with academy header and signatures"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Preview</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs text-slate-500 shrink-0">
            <span className="flex items-center gap-1 text-[11px]">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Official police training academy records formatted for administrative audits & review</span>
            </span>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* PRINT PREVIEW MODAL FOR SELECTED REPORT */}
      {/* =================================================================== */}
      {activePrintPreview && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs no-print modal-backdrop-animate">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden modal-pop-in">
            {/* Modal Top Control Bar */}
            <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {activePrintPreview.title} - Official Print Preview
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Formatted with official Academy Header, Address, and physical signature endorsement
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await exportToPdf(activePrintPreview.fileName, activePrintPreview.title, activePrintPreview.headers, activePrintPreview.rows, {
                      centreName,
                      institutionName,
                      address,
                      date: formatRoutineDateDDMMYYYY(currentRoutine?.date),
                      activeDayNumber: currentRoutine?.dayNumber,
                      activeDayDate: currentRoutine?.date,
                    });
                    showToast(`PDF document "${activePrintPreview.fileName}.pdf" exported to exports folder!`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-xs cursor-pointer"
                  title="Directly save PDF to exports folder"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 shadow-2xs cursor-pointer"
                  title="Print this document or Save as PDF via browser print dialog"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Browser Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePrintPreview(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sheet Preview Body */}
            <div className="overflow-y-auto p-4 sm:p-6 bg-slate-100 flex-1">
              <div className="bg-white shadow-md border border-slate-300 rounded p-4 sm:p-6 max-w-5xl mx-auto text-black font-sans">
                {/* Official Police Academy Header (Exact User-Specified Sequence) */}
                <div className="text-center pb-2 mb-3">
                  {/* 1. Training Centre Name (Large & Bold) */}
                  <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider text-black">
                    {centreName}
                  </h1>

                  {/* 2. STC, SAP 4th Bn (Next Line) */}
                  <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-900 mt-0.5">
                    {institutionName}
                  </div>

                  {/* 3. Address (Next Line) */}
                  <div className="text-[10px] sm:text-[11px] font-medium text-slate-700 mt-0.5">
                    {address}
                  </div>

                  {/* 4. Report Title */}
                  <h2 className="text-[11px] sm:text-xs font-extrabold text-slate-900 uppercase tracking-wide mt-1.5 pt-1">
                    {activePrintPreview.title}
                  </h2>

                  {/* 5. Metadata Bar */}
                  <div className="flex flex-wrap justify-between items-center text-[10px] mt-1.5 font-mono pt-1">
                    <span>DOCUMENT: <strong>OFFICIAL ACADEMIC RECORD</strong></span>
                    <span>ACTIVE DAY: <strong className="font-black text-black text-xs uppercase tracking-wider">DAY {currentRoutine?.dayNumber || 1} ({formatRoutineDateDDMMYYYY(currentRoutine?.date)})</strong></span>
                    <span>TOTAL ENTRIES: <strong>{activePrintPreview.rows.length} ROWS</strong></span>
                  </div>
                </div>

                {/* Report Table */}
                <div className="overflow-x-auto mb-4">
                  <table className="w-full border-collapse border border-black text-[9px]">
                    <thead>
                      <tr className="bg-slate-200 text-black">
                        {activePrintPreview.headers.map((h, i) => (
                          <th key={i} className="border border-black py-1 px-1.5 text-center font-bold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activePrintPreview.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={`border-b border-black break-inside-avoid ${
                            rIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                          }`}
                        >
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="border border-black py-1 px-1.5 align-top">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Official Signature Endorsement */}
                <div className="mt-6 pt-3 flex justify-end break-inside-avoid">
                  <div className="text-center font-bold text-xs text-black min-w-[200px]">
                    <div className="border-b border-black mb-1 pb-6">
                      {/* Space for physical signature / seal stamp */}
                    </div>
                    <div className="uppercase tracking-wider font-extrabold text-[11px]">
                      {settings?.signatoryDesignation || 'O/C STC (Indoor)'}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-800">
                      {institutionName}
                    </div>
                  </div>
                </div>

                {/* Bottom Footer: Date Generated on Bottom-Left */}
                <div className="mt-3 pt-1 flex items-center justify-between text-[9px] font-mono text-slate-700 break-inside-avoid">
                  <div>
                    Date Generated: <strong className="text-black font-bold">{new Date().toLocaleDateString('en-GB')}</strong>
                  </div>
                  <div className="text-slate-500 font-sans">
                    {institutionName} · Official Academic Record
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STANDALONE BROWSER PRINT DOCUMENT FOR SELECTED REPORT (Active only in Print) */}
      {/* =================================================================== */}
      {activePrintPreview &&
        createPortal(
          <div id="printable-report-document" className="print-report-only">
            <div className="p-4 sm:p-6 bg-white text-black font-sans max-w-7xl mx-auto">
              {/* Official Police Academy Header */}
              <div className="text-center pb-2 mb-3">
                <h1 className="text-xl font-black uppercase tracking-wider text-black">
                  {centreName}
                </h1>
                <div className="text-sm font-bold uppercase tracking-wide text-slate-900 mt-0.5">
                  {institutionName}
                </div>
                <div className="text-xs font-medium text-slate-700 mt-0.5">
                  {address}
                </div>
                <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide mt-1.5 pt-1">
                  {activePrintPreview.title}
                </h2>
                <div className="flex justify-between items-center text-[10px] mt-1.5 font-mono pt-1">
                  <span>DOCUMENT: <strong>OFFICIAL ACADEMIC RECORD</strong></span>
                  <span>ACTIVE DAY: <strong className="font-black text-black text-xs uppercase tracking-wider">DAY {currentRoutine?.dayNumber || 1} ({formatRoutineDateDDMMYYYY(currentRoutine?.date)})</strong></span>
                  <span>TOTAL ENTRIES: <strong>{activePrintPreview.rows.length} ROWS</strong></span>
                </div>
              </div>

              {/* Report Table */}
              <div className="mb-4">
                <table className="w-full border-collapse border border-black text-[9px]">
                  <thead>
                    <tr className="bg-slate-200 text-black">
                      {activePrintPreview.headers.map((h, i) => (
                        <th key={i} className="border border-black py-1 px-1.5 text-center font-bold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activePrintPreview.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={`border-b border-black break-inside-avoid ${
                          rIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                        }`}
                      >
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="border border-black py-1 px-1.5 align-top">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Official Signature Endorsement */}
              <div className="mt-6 pt-3 flex justify-end break-inside-avoid">
                <div className="text-center font-bold text-xs text-black min-w-[200px]">
                  <div className="border-b border-black mb-1 pb-6"></div>
                  <div className="uppercase tracking-wider font-extrabold text-[11px]">
                    {settings?.signatoryDesignation || 'O/C STC (Indoor)'}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-800">
                    {institutionName}
                  </div>
                </div>
              </div>

              {/* Bottom Footer: Date Generated */}
              <div className="mt-3 pt-1 flex items-center justify-between text-[9px] font-mono text-slate-700 break-inside-avoid">
                <div>
                  Date Generated: <strong className="text-black font-bold">{new Date().toLocaleDateString('en-GB')}</strong>
                </div>
                <div className="text-slate-500 font-sans">
                  {institutionName} · Official Academic Record
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
