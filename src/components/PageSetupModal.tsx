/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppSettings, BrowserPrintConfig, ColumnConfig, ReportPageSetupConfig } from '../types';
import {
  APP_DEVELOPER_MAINTAINER,
  DEFAULT_APP_SETTINGS,
  DEFAULT_BROWSER_PRINT_CONFIG,
  DEFAULT_REPORT_PAGE_CONFIGS,
} from '../data/initialData';
import {
  AlertCircle,
  Building,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Compass,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Info,
  KeyRound,
  LayoutTemplate,
  Loader2,
  Lock,
  Printer,
  RotateCcw,
  Save,
  Search,
  Shield,
  Sparkles,
  Sliders,
  Square,
  X,
} from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface PageSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (updated: Partial<AppSettings>) => Promise<void>;
  onOpenChangePassword?: () => void;
}

export const PageSetupModal: React.FC<PageSetupModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onOpenChangePassword,
}) => {
  const { shouldRender, backdropAnimationClass, modalAnimationClass } = useModalAnimation(isOpen);
  const [activeTab, setActiveTab] = useState<'institutional' | 'downloads' | 'browser-print'>('institutional');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  // Local form state initialized from current settings or defaults
  const [formData, setFormData] = useState<AppSettings>({
    institutionName: settings.institutionName || DEFAULT_APP_SETTINGS.institutionName,
    battalionUnit: settings.battalionUnit || DEFAULT_APP_SETTINGS.battalionUnit,
    trainingCenterName: settings.trainingCenterName || DEFAULT_APP_SETTINGS.trainingCenterName,
    subTitle: settings.subTitle || DEFAULT_APP_SETTINGS.subTitle,
    location: settings.location || DEFAULT_APP_SETTINGS.location,
    address: settings.address || DEFAULT_APP_SETTINGS.address || '',
    signatoryDesignation: settings.signatoryDesignation || DEFAULT_APP_SETTINGS.signatoryDesignation,
    tagline: settings.tagline || DEFAULT_APP_SETTINGS.tagline,
    activeRoutineId: settings.activeRoutineId || '',
    language: settings.language || 'en',
    downloadsConfig: settings.downloadsConfig || {
      reports: { ...DEFAULT_REPORT_PAGE_CONFIGS },
      browserPrint: { ...DEFAULT_BROWSER_PRINT_CONFIG },
    },
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!shouldRender) return null;

  const handleChange = (field: keyof AppSettings, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  };

  const handleReportConfigChange = (
    reportId: string,
    updates: Partial<ReportPageSetupConfig>
  ) => {
    setFormData((prev) => {
      const existingReports = prev.downloadsConfig?.reports || { ...DEFAULT_REPORT_PAGE_CONFIGS };
      const current = existingReports[reportId] || DEFAULT_REPORT_PAGE_CONFIGS[reportId] || {
        id: reportId,
        name: reportId,
        enabled: true,
        orientation: 'landscape',
        paperSize: 'a4',
        includeHeader: true,
        includeSignatures: true,
      };
      const updatedConfig = { ...current, ...updates };
      return {
        ...prev,
        downloadsConfig: {
          ...prev.downloadsConfig,
          reports: {
            ...existingReports,
            [reportId]: updatedConfig,
            ...(reportId === 'instructor-directory'
              ? { 'phone-directory': { ...updatedConfig, id: 'phone-directory' } }
              : {}),
            ...(reportId === 'phone-directory'
              ? { 'instructor-directory': { ...updatedConfig, id: 'instructor-directory' } }
              : {}),
          },
        },
      };
    });
    setSaveSuccess(false);
  };

  const handleColumnToggle = (reportId: string, columnKey: string, enabled: boolean) => {
    setFormData((prev) => {
      const existingReports = prev.downloadsConfig?.reports || { ...DEFAULT_REPORT_PAGE_CONFIGS };
      const currentReport = existingReports[reportId] || DEFAULT_REPORT_PAGE_CONFIGS[reportId];
      const defaultReport = DEFAULT_REPORT_PAGE_CONFIGS[reportId];
      const columns = currentReport?.columns || defaultReport?.columns || [];

      const updatedColumns = columns.map((col: ColumnConfig) =>
        col.key === columnKey ? { ...col, enabled } : col
      );
      const updatedReport = {
        ...currentReport,
        columns: updatedColumns,
      };

      return {
        ...prev,
        downloadsConfig: {
          ...prev.downloadsConfig,
          reports: {
            ...existingReports,
            [reportId]: updatedReport,
            ...(reportId === 'instructor-directory'
              ? { 'phone-directory': { ...updatedReport, id: 'phone-directory' } }
              : {}),
            ...(reportId === 'phone-directory'
              ? { 'instructor-directory': { ...updatedReport, id: 'instructor-directory' } }
              : {}),
          },
        },
      };
    });
    setSaveSuccess(false);
  };

  const handleColumnLabelChange = (reportId: string, columnKey: string, customLabel: string) => {
    setFormData((prev) => {
      const existingReports = prev.downloadsConfig?.reports || { ...DEFAULT_REPORT_PAGE_CONFIGS };
      const currentReport = existingReports[reportId] || DEFAULT_REPORT_PAGE_CONFIGS[reportId];
      const defaultReport = DEFAULT_REPORT_PAGE_CONFIGS[reportId];
      const columns = currentReport?.columns || defaultReport?.columns || [];

      const updatedColumns = columns.map((col: ColumnConfig) =>
        col.key === columnKey ? { ...col, customLabel } : col
      );
      const updatedReport = {
        ...currentReport,
        columns: updatedColumns,
      };

      return {
        ...prev,
        downloadsConfig: {
          ...prev.downloadsConfig,
          reports: {
            ...existingReports,
            [reportId]: updatedReport,
            ...(reportId === 'instructor-directory'
              ? { 'phone-directory': { ...updatedReport, id: 'phone-directory' } }
              : {}),
            ...(reportId === 'phone-directory'
              ? { 'instructor-directory': { ...updatedReport, id: 'instructor-directory' } }
              : {}),
          },
        },
      };
    });
    setSaveSuccess(false);
  };

  const handleResetColumns = (reportId: string) => {
    const defaultCols = DEFAULT_REPORT_PAGE_CONFIGS[reportId]?.columns || [];
    handleReportConfigChange(reportId, {
      columns: defaultCols.map((c: ColumnConfig) => ({ ...c })),
    });
  };

  const handleBrowserPrintChange = (updates: Partial<BrowserPrintConfig>) => {
    setFormData((prev) => {
      const current = prev.downloadsConfig?.browserPrint || DEFAULT_BROWSER_PRINT_CONFIG;
      return {
        ...prev,
        downloadsConfig: {
          ...prev.downloadsConfig,
          reports: prev.downloadsConfig?.reports || { ...DEFAULT_REPORT_PAGE_CONFIGS },
          browserPrint: {
            ...current,
            ...updates,
          },
        },
      };
    });
    setSaveSuccess(false);
  };

  const handleToggleAllReports = (enable: boolean) => {
    setFormData((prev) => {
      const existingReports = prev.downloadsConfig?.reports || { ...DEFAULT_REPORT_PAGE_CONFIGS };
      const updatedReports = { ...existingReports };
      Object.keys(updatedReports).forEach((k) => {
        updatedReports[k] = { ...updatedReports[k], enabled: enable };
      });
      return {
        ...prev,
        downloadsConfig: {
          ...prev.downloadsConfig,
          reports: updatedReports,
        },
      };
    });
    setSaveSuccess(false);
  };

  const handleResetDefaults = () => {
    setFormData({
      institutionName: DEFAULT_APP_SETTINGS.institutionName,
      battalionUnit: DEFAULT_APP_SETTINGS.battalionUnit,
      trainingCenterName: DEFAULT_APP_SETTINGS.trainingCenterName,
      subTitle: DEFAULT_APP_SETTINGS.subTitle,
      location: DEFAULT_APP_SETTINGS.location,
      address: DEFAULT_APP_SETTINGS.address,
      signatoryDesignation: DEFAULT_APP_SETTINGS.signatoryDesignation,
      tagline: DEFAULT_APP_SETTINGS.tagline,
      activeRoutineId: settings.activeRoutineId,
      language: settings.language || 'en',
      downloadsConfig: {
        reports: { ...DEFAULT_REPORT_PAGE_CONFIGS },
        browserPrint: { ...DEFAULT_BROWSER_PRINT_CONFIG },
      },
    });
    setSaveSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveSettings({
        institutionName: formData.institutionName.trim() || DEFAULT_APP_SETTINGS.institutionName,
        battalionUnit: formData.battalionUnit?.trim() || DEFAULT_APP_SETTINGS.battalionUnit,
        trainingCenterName: formData.trainingCenterName?.trim() || DEFAULT_APP_SETTINGS.trainingCenterName,
        subTitle: formData.subTitle?.trim() || DEFAULT_APP_SETTINGS.subTitle,
        location: formData.location?.trim() || DEFAULT_APP_SETTINGS.location,
        address: formData.address?.trim() || DEFAULT_APP_SETTINGS.address,
        signatoryDesignation: formData.signatoryDesignation?.trim() || DEFAULT_APP_SETTINGS.signatoryDesignation,
        tagline: formData.tagline?.trim() || DEFAULT_APP_SETTINGS.tagline,
        downloadsConfig: formData.downloadsConfig,
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 900);
    } catch (err) {
      console.error('Failed to save page setup settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const currentReports = formData.downloadsConfig?.reports || DEFAULT_REPORT_PAGE_CONFIGS;
  const currentBrowserPrint = formData.downloadsConfig?.browserPrint || DEFAULT_BROWSER_PRINT_CONFIG;
  const enabledReportsCount = Object.values(currentReports).filter((r) => r.enabled).length;
  const totalReportsCount = Object.keys(currentReports).length;

  const filteredReportList = Object.entries(currentReports).filter(([id, config]) => {
    if (!reportSearchQuery.trim()) return true;
    const q = reportSearchQuery.toLowerCase();
    return (
      id.toLowerCase().includes(q) ||
      config.name.toLowerCase().includes(q) ||
      (config.customTitle && config.customTitle.toLowerCase().includes(q))
    );
  });

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs no-print ${backdropAnimationClass}`}>
      <div className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden ${modalAnimationClass}`}>
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-sm shrink-0">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Page Setup — View, Downloads & Print Configuration
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-400/20 text-indigo-200 border border-indigo-400/30 font-mono">
                  Full Depth Setup
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Institutional presentation, custom export column selections, labels & browser print options
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close Page Setup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Tabs Navigation Bar */}
        <div className="px-4 pt-1.5 border-b border-slate-200 bg-slate-100 flex items-center gap-1 sm:gap-2 shrink-0 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('institutional')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'institutional'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>STC & Institutional Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('downloads')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'downloads'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Downloads & Column Customization</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-mono font-bold">
              {enabledReportsCount}/{totalReportsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('browser-print')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'browser-print'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Browser Print Setup</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50 modal-tab-container">
          <div key={activeTab} className="tab-pane-animated space-y-4">
          {/* TAB 1: Institutional Details */}
          {activeTab === 'institutional' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Notice */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-950">
                    Institutional Presentation & Routine View Details
                  </p>
                  <p className="text-blue-800 text-[11px] leading-relaxed">
                    Configure institutional names, training centre headers, and official signature endorsements printed on timetables and reports.
                  </p>
                </div>
              </div>

              {/* Institution & Battalion Details */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-900 font-bold text-xs">
                  <Building className="w-4 h-4 text-indigo-600" />
                  <span>STC & SAP Battalion Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Institution Name / Short Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.institutionName}
                      onChange={(e) => handleChange('institutionName', e.target.value)}
                      placeholder="e.g. STC, SAP 4th Bn"
                      required
                      className="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Battalion / Unit Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.battalionUnit || ''}
                      onChange={(e) => handleChange('battalionUnit', e.target.value)}
                      placeholder="e.g. Special Armed Police 4th Battalion"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Training Centre & Routine Presentation */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-900 font-bold text-xs">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                  <span>Training Centre & Routine View Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Training Centre Name
                    </label>
                    <input
                      type="text"
                      value={formData.trainingCenterName || ''}
                      onChange={(e) => handleChange('trainingCenterName', e.target.value)}
                      placeholder="e.g. Specialised Training Centre"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Campus / Facility Location
                    </label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => handleChange('location', e.target.value)}
                      placeholder="e.g. SAP 4th Bn Campus"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Institutional / Campus Address (Printed on PDF headers)
                    </label>
                    <input
                      type="text"
                      value={formData.address || ''}
                      onChange={(e) => handleChange('address', e.target.value)}
                      placeholder="e.g. Kasba, Raiganj, Uttar Dinajpur"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Routine Sheet Subtitle / Heading
                    </label>
                    <input
                      type="text"
                      value={formData.subTitle || ''}
                      onChange={(e) => handleChange('subTitle', e.target.value)}
                      placeholder="e.g. Daily Indoor Class Routine & Instructor Assignment Master Sheet"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Official Signatory / Issuing Authority
                    </label>
                    <input
                      type="text"
                      value={formData.signatoryDesignation || ''}
                      onChange={(e) => handleChange('signatoryDesignation', e.target.value)}
                      placeholder="e.g. O/C STC (Indoor)"
                      className="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Application Header Tagline
                    </label>
                    <input
                      type="text"
                      value={formData.tagline || ''}
                      onChange={(e) => handleChange('tagline', e.target.value)}
                      placeholder="e.g. Daily Indoor Class Routine Scheduler · 15 Rooms · Multi-Instructor Matrix"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Developer & Maintainer (Strictly Non-Editable) */}
              <div className="bg-amber-50/60 border border-amber-300/80 rounded-xl p-3.5 space-y-2 relative">
                <div className="flex items-center justify-between pb-1.5 border-b border-amber-200">
                  <div className="flex items-center gap-1.5 text-amber-950 font-bold text-xs">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>System Designer & Maintainer (Non-Editable)</span>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded">
                    Fixed Attribution
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={APP_DEVELOPER_MAINTAINER}
                    readOnly
                    disabled
                    tabIndex={-1}
                    className="w-full pl-8 pr-3 py-1.5 text-xs font-bold bg-amber-100/70 border border-amber-300 rounded-lg text-slate-900 cursor-not-allowed select-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-amber-700 absolute left-2.5 top-2 pointer-events-none" />
                </div>
              </div>

              {/* Security Password */}
              {onOpenChangePassword && (
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Admin Security Password</h4>
                      <p className="text-[11px] text-slate-500">
                        Update administrative password for routine generation and editing.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenChangePassword();
                    }}
                    className="px-3 py-1 text-xs font-bold rounded-lg border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 shrink-0 transition-colors cursor-pointer"
                  >
                    Change Password...
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Downloads & Reports Page Setup with Column Customization */}
          {activeTab === 'downloads' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <span className="font-bold text-indigo-950">In-Depth Report & Column Configuration</span>
                    <p className="text-indigo-800 text-[11px]">
                      Select columns to include, rename labels, set orientation & paper size for each report.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleAllReports(true)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-indigo-300 rounded text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAllReports(false)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Search filter for reports */}
              <div className="relative">
                <input
                  type="text"
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  placeholder="Search download reports..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>

              {/* Reports Accordion Cards */}
              <div className="space-y-2.5">
                {filteredReportList.map(([reportId, config]) => {
                  const defaultDef = DEFAULT_REPORT_PAGE_CONFIGS[reportId];
                  const columns = config.columns || defaultDef?.columns || [];
                  const isExpanded = expandedReportId === reportId;
                  const enabledColsCount = columns.filter((c: ColumnConfig) => c.enabled !== false).length;

                  return (
                    <div
                      key={reportId}
                      className={`rounded-xl border transition-all duration-150 ${
                        config.enabled
                          ? 'bg-white border-slate-300 shadow-2xs hover:border-slate-400'
                          : 'bg-slate-50/80 border-slate-200 opacity-60'
                      }`}
                    >
                      {/* Report Main Bar */}
                      <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            id={`report-check-${reportId}`}
                            checked={config.enabled}
                            onChange={(e) =>
                              handleReportConfigChange(reportId, { enabled: e.target.checked })
                            }
                            className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <label
                              htmlFor={`report-check-${reportId}`}
                              className="font-bold text-xs text-slate-900 cursor-pointer select-none block truncate"
                            >
                              {config.customTitle || config.name}
                            </label>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 font-mono">
                              <span className="bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                {reportId}
                              </span>
                              <span>·</span>
                              <span className="text-indigo-700 font-semibold">
                                {enabledColsCount}/{columns.length} columns active
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Quick Orientation, Size & Column Editor Toggle */}
                        <div className="flex flex-wrap items-center gap-2 pl-6 md:pl-0 shrink-0">
                          <select
                            value={config.orientation || 'landscape'}
                            disabled={!config.enabled}
                            onChange={(e) =>
                              handleReportConfigChange(reportId, {
                                orientation: e.target.value as 'landscape' | 'portrait',
                              })
                            }
                            className="text-[11px] font-semibold bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 disabled:opacity-50 cursor-pointer focus:outline-hidden"
                            title="Page Orientation"
                          >
                            <option value="landscape">Landscape</option>
                            <option value="portrait">Portrait</option>
                          </select>

                          <select
                            value={config.paperSize || 'a4'}
                            disabled={!config.enabled}
                            onChange={(e) =>
                              handleReportConfigChange(reportId, {
                                paperSize: e.target.value as 'a4' | 'legal' | 'letter',
                              })
                            }
                            className="text-[11px] font-semibold bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 disabled:opacity-50 cursor-pointer focus:outline-hidden"
                            title="Paper Size"
                          >
                            <option value="a4">A4</option>
                            <option value="legal">Legal</option>
                            <option value="letter">Letter</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => setExpandedReportId(isExpanded ? null : reportId)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                              isExpanded
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            <span>Columns &amp; Labels</span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-300 ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Section: Custom Title, Subtitle & Column Checklist (Smooth Accordion) */}
                      <div
                        className={`grid transition-all duration-300 ease-in-out ${
                          isExpanded
                            ? 'grid-rows-[1fr] opacity-100'
                            : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="p-3 border-t border-slate-200 bg-slate-50/80 space-y-3">
                            {/* Title & Subtitle Override */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                Custom Export Report Heading / Title:
                              </label>
                              <input
                                type="text"
                                value={config.customTitle || ''}
                                onChange={(e) =>
                                  handleReportConfigChange(reportId, { customTitle: e.target.value })
                                }
                                placeholder={config.name}
                                className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                Custom Subtitle:
                              </label>
                              <input
                                type="text"
                                value={config.customSubtitle || ''}
                                onChange={(e) =>
                                  handleReportConfigChange(reportId, { customSubtitle: e.target.value })
                                }
                                placeholder="e.g. Official Academic Record"
                                className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>

                          {/* Header & Signature Checks */}
                          <div className="flex items-center gap-4 text-xs">
                            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                              <input
                                type="checkbox"
                                checked={config.includeHeader !== false}
                                onChange={(e) =>
                                  handleReportConfigChange(reportId, {
                                    includeHeader: e.target.checked,
                                  })
                                }
                                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300"
                              />
                              <span>Include Academy Header</span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                              <input
                                type="checkbox"
                                checked={config.includeSignatures !== false}
                                onChange={(e) =>
                                  handleReportConfigChange(reportId, {
                                    includeSignatures: e.target.checked,
                                  })
                                }
                                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300"
                              />
                              <span>Include Authority Signatures Block</span>
                            </label>

                            <button
                              type="button"
                              onClick={() => handleResetColumns(reportId)}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline ml-auto cursor-pointer"
                            >
                              Reset Columns to Default
                            </button>
                          </div>

                          {/* Column Checklist & Label Renaming */}
                          <div>
                            <div className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                              <span>Configurable Download Columns:</span>
                              <span className="text-[10px] text-slate-500 font-normal">
                                Uncheck to hide column; edit text to rename header label
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto p-1 border border-slate-200 rounded-lg bg-white">
                              {columns.map((col: ColumnConfig) => (
                                <div
                                  key={col.key}
                                  className={`p-1.5 rounded-md border flex items-center gap-2 transition-colors ${
                                    col.enabled !== false
                                      ? 'bg-slate-50 border-slate-200'
                                      : 'bg-slate-100 border-slate-200 opacity-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    id={`col-${reportId}-${col.key}`}
                                    checked={col.enabled !== false}
                                    onChange={(e) =>
                                      handleColumnToggle(reportId, col.key, e.target.checked)
                                    }
                                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 cursor-pointer shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <input
                                      type="text"
                                      value={col.customLabel}
                                      onChange={(e) =>
                                        handleColumnLabelChange(reportId, col.key, e.target.value)
                                      }
                                      placeholder={col.defaultLabel}
                                      className="w-full px-1.5 py-0.5 text-[11px] font-semibold bg-white border border-slate-300 rounded text-slate-900 focus:outline-hidden"
                                    />
                                    <span className="text-[9px] text-slate-400 font-mono block truncate">
                                      Default: {col.defaultLabel}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* TAB 3: Browser Print Setup */}
          {activeTab === 'browser-print' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2.5">
                <Printer className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-indigo-950">
                    Browser Timetable Print & Sheet Layout Configuration
                  </p>
                  <p className="text-indigo-800 text-[11px]">
                    Configure display elements, period timings, badges, reserve faculty table, and authority signature block for browser printing.
                  </p>
                </div>
              </div>

              {/* Title & Page Setup */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                <div className="font-bold text-xs text-slate-900 pb-1.5 border-b border-slate-200 flex items-center justify-between">
                  <span>Print Document Headings & Format</span>
                  <span className="text-[10px] text-slate-500 font-normal">Applies to Print Timetable modal and browser print</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Printable Sheet Title / Header:
                    </label>
                    <input
                      type="text"
                      value={currentBrowserPrint.customTitle || ''}
                      onChange={(e) => handleBrowserPrintChange({ customTitle: e.target.value })}
                      placeholder="e.g. DAILY INDOOR CLASS ROUTINE & INSTRUCTOR ASSIGNMENT MASTER SHEET"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Printable Sheet Subtitle:
                    </label>
                    <input
                      type="text"
                      value={currentBrowserPrint.customSubtitle || ''}
                      onChange={(e) => handleBrowserPrintChange({ customSubtitle: e.target.value })}
                      placeholder="e.g. 15 Classrooms (8 Old Building + 7 New Building) · 75 Daily Slots"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Print Orientation:
                    </label>
                    <select
                      value={currentBrowserPrint.orientation || 'landscape'}
                      onChange={(e) =>
                        handleBrowserPrintChange({
                          orientation: e.target.value as 'landscape' | 'portrait',
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 cursor-pointer"
                    >
                      <option value="landscape">Landscape (Horizontal — Recommended for 15 Rooms)</option>
                      <option value="portrait">Portrait (Vertical)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Paper Size:
                    </label>
                    <select
                      value={currentBrowserPrint.paperSize || 'a4'}
                      onChange={(e) =>
                        handleBrowserPrintChange({
                          paperSize: e.target.value as 'a4' | 'legal' | 'letter',
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 cursor-pointer"
                    >
                      <option value="a4">A4 (Standard 210 × 297 mm)</option>
                      <option value="legal">Legal (8.5 × 14 in)</option>
                      <option value="letter">Letter</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Display Element Toggles */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 shadow-2xs">
                <div className="font-bold text-xs text-slate-900 pb-1.5 border-b border-slate-200">
                  Printable Elements &amp; Information Visibility
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentBrowserPrint.showHeader !== false}
                      onChange={(e) => handleBrowserPrintChange({ showHeader: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Official Academy Header</span>
                      <span className="text-[10px] text-slate-500">Training Centre name, STC SAP Bn & address block</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentBrowserPrint.showTimings !== false}
                      onChange={(e) => handleBrowserPrintChange({ showTimings: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Period Timing Hours</span>
                      <span className="text-[10px] text-slate-500">Show 09:40-10:20, 10:25-11:05, etc. under period columns</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentBrowserPrint.showCapacities !== false}
                      onChange={(e) => handleBrowserPrintChange({ showCapacities: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Classroom Capacities</span>
                      <span className="text-[10px] text-slate-500">Show Capacity: 70 or 52 candidates under room name</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentBrowserPrint.showTeacherCodes !== false}
                      onChange={(e) => handleBrowserPrintChange({ showTeacherCodes: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Teacher Code Badges</span>
                      <span className="text-[10px] text-slate-500">Show [T1], [T2], [T27] codes beside teacher name</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentBrowserPrint.showSubjectCodes !== false}
                      onChange={(e) => handleBrowserPrintChange({ showSubjectCodes: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Subject Paper Codes</span>
                      <span className="text-[10px] text-slate-500">Show Paper-1, Paper-2, etc. badge on top of slot</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentBrowserPrint.showSubstituteBadge !== false}
                      onChange={(e) => handleBrowserPrintChange({ showSubstituteBadge: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Substitute Badges</span>
                      <span className="text-[10px] text-slate-500">Show "SUB" badge when substitute instructor conducts class</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentBrowserPrint.showSessionCount !== false}
                      onChange={(e) => handleBrowserPrintChange({ showSessionCount: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Session Number Badges</span>
                      <span className="text-[10px] text-slate-500">Show session count (e.g. (1), (2)) in brackets beside instructor</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentBrowserPrint.showPriorityBadge !== false}
                      onChange={(e) => handleBrowserPrintChange({ showPriorityBadge: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Priority Star Indicators</span>
                      <span className="text-[10px] text-slate-500">Highlight ★ Priority tag on prioritized subjects</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentBrowserPrint.showReserveTable !== false}
                      onChange={(e) => handleBrowserPrintChange({ showReserveTable: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Reserve / Free Faculty Roster</span>
                      <span className="text-[10px] text-slate-500">Show period-wise standby instructors roster at bottom</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentBrowserPrint.showLeaveTable !== false}
                      onChange={(e) => handleBrowserPrintChange({ showLeaveTable: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Faculty On-Leave / Unavailable Box</span>
                      <span className="text-[10px] text-slate-500">Show Leave, Duty, Sick, and Absent faculty list</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentBrowserPrint.showSignatures !== false}
                      onChange={(e) => handleBrowserPrintChange({ showSignatures: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Official Signature Endorsement</span>
                      <span className="text-[10px] text-slate-500">Show physical signature endorsement block for O/C STC</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Reset to factory defaults"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Reset Defaults</span>
            <span className="sm:hidden">Reset</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg text-white shadow-xs transition-all cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Page Setup</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
