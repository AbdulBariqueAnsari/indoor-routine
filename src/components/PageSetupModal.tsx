/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppSettings } from '../types';
import { APP_DEVELOPER_MAINTAINER, DEFAULT_APP_SETTINGS } from '../data/initialData';
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Eye,
  GraduationCap,
  Info,
  LayoutTemplate,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  User,
  X,
} from 'lucide-react';

interface PageSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (updated: Partial<AppSettings>) => Promise<void>;
}

export const PageSetupModal: React.FC<PageSetupModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  // Local form state initialized from current settings or defaults
  const [formData, setFormData] = useState<AppSettings>({
    institutionName: settings.institutionName || DEFAULT_APP_SETTINGS.institutionName,
    battalionUnit: settings.battalionUnit || DEFAULT_APP_SETTINGS.battalionUnit,
    trainingCenterName: settings.trainingCenterName || DEFAULT_APP_SETTINGS.trainingCenterName,
    subTitle: settings.subTitle || DEFAULT_APP_SETTINGS.subTitle,
    location: settings.location || DEFAULT_APP_SETTINGS.location,
    signatoryDesignation: settings.signatoryDesignation || DEFAULT_APP_SETTINGS.signatoryDesignation,
    tagline: settings.tagline || DEFAULT_APP_SETTINGS.tagline,
    activeRoutineId: settings.activeRoutineId || '',
    language: settings.language || 'en',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field: keyof AppSettings, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  };

  const handleResetDefaults = () => {
    setFormData({
      institutionName: DEFAULT_APP_SETTINGS.institutionName,
      battalionUnit: DEFAULT_APP_SETTINGS.battalionUnit,
      trainingCenterName: DEFAULT_APP_SETTINGS.trainingCenterName,
      subTitle: DEFAULT_APP_SETTINGS.subTitle,
      location: DEFAULT_APP_SETTINGS.location,
      signatoryDesignation: DEFAULT_APP_SETTINGS.signatoryDesignation,
      tagline: DEFAULT_APP_SETTINGS.tagline,
      activeRoutineId: settings.activeRoutineId,
      language: settings.language || 'en',
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
        signatoryDesignation: formData.signatoryDesignation?.trim() || DEFAULT_APP_SETTINGS.signatoryDesignation,
        tagline: formData.tagline?.trim() || DEFAULT_APP_SETTINGS.tagline,
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to save page setup settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-linear-to-r from-slate-50 to-indigo-50/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Page Setup — View & Print Configuration
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  <Eye className="w-2.5 h-2.5 text-indigo-600" />
                  View Only Details
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize STC, SAP Bn & Training Centre presentation details across navbar, routine sheet & reports
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
            title="Close Page Setup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Information Notice Alert */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-blue-950">
                Institutional Presentation & View Setup
              </p>
              <p className="text-blue-800 text-[11px] leading-relaxed">
                These settings configure institutional names, training centre headers, subtitles, and official signature endorsements. They apply exclusively to views and printable sheets without affecting routine generation algorithms or constraints.
              </p>
            </div>
          </div>

          {/* Section 1: Institution & Battalion Configuration */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-900 font-bold text-sm">
              <Building className="w-4 h-4 text-indigo-600" />
              <span>STC & SAP Battalion Details (View Setup)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Displayed on top navbar brand, printable sheet header, and card titles.
                </p>
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
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Full official unit designation for document headers & official reports.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Training Centre & Routine Sheet Presentation */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-900 font-bold text-sm">
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              <span>Training Centre & Routine View Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Training Centre Name
                </label>
                <input
                  type="text"
                  value={formData.trainingCenterName || ''}
                  onChange={(e) => handleChange('trainingCenterName', e.target.value)}
                  placeholder="e.g. Specialised Training Centre"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Training academy name shown in routine sheets and training records.
                </p>
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
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Campus location printed in routine metadata bar.
                </p>
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
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Printed directly below institution name on official printable timetables.
                </p>
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
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Authority designation for physical signature & stamp block.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Application Header Tagline
                </label>
                <input
                  type="text"
                  value={formData.tagline || ''}
                  onChange={(e) => handleChange('tagline', e.target.value)}
                  placeholder="e.g. Daily Indoor Class Routine Scheduler · 15 Rooms · 26 Instructors"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Descriptive tagline displayed in the main top bar and footer.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Designer & Maintainer (STRICTLY NON-EDITABLE / LOCKED) */}
          <div className="bg-amber-50/60 border-2 border-amber-300/80 rounded-xl p-4 sm:p-5 space-y-3 relative">
            <div className="flex items-center justify-between pb-2 border-b border-amber-200">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>System Designer & Maintainer (Non-Editable)</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300">
                <Lock className="w-2.5 h-2.5 text-amber-800" />
                Fixed / Read-Only Credit
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-900 mb-1">
                Developer & System Maintainer Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={APP_DEVELOPER_MAINTAINER}
                  readOnly
                  disabled
                  tabIndex={-1}
                  className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-amber-100/70 border border-amber-300 rounded-lg text-slate-900 cursor-not-allowed select-none shadow-2xs"
                  title="Developer & Maintainer credit is locked and cannot be edited"
                />
                <Lock className="w-4 h-4 text-amber-700 absolute left-3 top-2.5 pointer-events-none" />
              </div>
              <p className="text-[11px] text-amber-800 mt-1.5 flex items-center gap-1.5 font-medium">
                <Shield className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  Permanent system attribution: <strong>{APP_DEVELOPER_MAINTAINER}</strong>. Per system policy, designer and maintainer credentials are strictly non-editable.
                </span>
              </p>
            </div>
          </div>

          {/* Section 4: Live View Preview */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-900 text-white space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-slate-700 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Live View & Document Header Preview</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">Real-Time Sync</span>
            </div>

            <div className="text-center py-2 space-y-1">
              <div className="text-sm sm:text-base font-extrabold tracking-wide uppercase text-white">
                {formData.institutionName || 'STC, SAP 4TH BN'}
              </div>
              {formData.trainingCenterName && (
                <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wide">
                  {formData.trainingCenterName}
                </div>
              )}
              <div className="text-[11px] font-medium text-slate-300 max-w-xl mx-auto">
                {formData.subTitle || 'Daily Indoor Class Routine & Instructor Assignment Master Sheet'}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-slate-400 pt-1 font-mono">
                <span>Location: <strong className="text-slate-200">{formData.location || 'SAP 4th Bn Campus'}</strong></span>
                <span>•</span>
                <span>Issuing Authority: <strong className="text-slate-200">{formData.signatoryDesignation || 'O/C STC (Indoor)'}</strong></span>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Reset institutional details to standard factory defaults"
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
