/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RoutineRuleConfig } from '../types';
import { DEFAULT_ROUTINE_RULES } from '../data/initialData';
import { Check, CheckCircle2, RotateCcw, Shield, Sliders, X } from 'lucide-react';

interface RoutineRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: RoutineRuleConfig;
  onSaveRules: (updatedRules: RoutineRuleConfig) => Promise<void>;
}

interface RuleItem {
  key: keyof RoutineRuleConfig;
  title: string;
  category: 'Workload & Balancing' | 'Movement & Building' | 'Attendance & Substitution' | 'Curriculum & Room Limits';
  description: string;
  badge: string;
}

const RULES_LIST: RuleItem[] = [
  {
    key: 'enableWorkloadEqualization',
    title: 'Workload & Session Equalization',
    category: 'Workload & Balancing',
    badge: 'Fair Workload',
    description:
      'Dynamically prioritizes lagging instructors in Practical and Backup slots so all 26 instructors gradually converge to approximately equal total sessions.',
  },
  {
    key: 'enableDailyWorkloadSoftCap',
    title: 'Daily Workload Soft-Cap (Max 3 Periods/Day)',
    category: 'Workload & Balancing',
    badge: 'Quota Control',
    description:
      'Prioritizes instructors with fewer than 3 periods today before assigning a 4th period, keeping daily teaching load balanced across campus.',
  },
  {
    key: 'enablePracticalFlexible',
    title: 'Flexible Practical (Paper-13) Staffing',
    category: 'Workload & Balancing',
    badge: 'Staffing Equalizer',
    description:
      'Practical does not have dedicated instructors; permits any qualified available instructor to conduct Practical sessions to balance workloads.',
  },
  {
    key: 'enablePaperRotationalFlow',
    title: 'Subject / Paper Rotational Caravan Flow',
    category: 'Movement & Building',
    badge: 'Rotational Mode',
    description:
      'Rotational curriculum mode: If Paper X is in Room 2 in Period 1, it automatically advances to Room 3 in Period 2, Room 4 in Period 3, and so on across classrooms. Qualified instructors are assigned dynamically.',
  },
  {
    key: 'enableCaravanFlow',
    title: 'Instructor-Bound Caravan Flow (Default: OFF)',
    category: 'Movement & Building',
    badge: 'Teacher Caravan',
    description:
      'Forces the specific instructor to physically travel with their subject consecutively from Room K to Room K+1. Kept OFF by default in favor of Subject Rotational Flow.',
  },
  {
    key: 'enableBuildingChangeGap',
    title: 'Mandatory 1-Period Gap on Building Transition',
    category: 'Movement & Building',
    badge: 'Campus Transit',
    description:
      'Requires at least a 1-period buffer when shifting between Old School Building and New School Building to accommodate transit time.',
  },
  {
    key: 'enableDayToDayProgression',
    title: 'Day-to-Day Room Progression Carryover',
    category: 'Movement & Building',
    badge: 'Daily Stepper',
    description:
      'Seeds Period 1 starting rooms based on where each instructor finished on the previous day (e.g., Room 1 on Day 1 advances to Room 2 on Day 2).',
  },
  {
    key: 'enableZeroDoubleBooking',
    title: 'Strict Zero Double-Booking Guarantee',
    category: 'Attendance & Substitution',
    badge: 'Conflict Prevention',
    description:
      'Strictly prohibits any instructor from being scheduled in multiple classrooms simultaneously during the exact same period.',
  },
  {
    key: 'enableStrictAbsenteeExclusion',
    title: 'Strict Absentee & Leave Exclusion',
    category: 'Attendance & Substitution',
    badge: 'Leave Enforcement',
    description:
      'Completely excludes instructors on medical or casual leave from routine generation and triggers substitute staffing protocols.',
  },
  {
    key: 'enableDesignatedBackup',
    title: 'Designated Backup Instructor Substitution',
    category: 'Attendance & Substitution',
    badge: 'Backup Slots 1 & 2',
    description:
      'Automatically appoints designated Backup Slot 1 and Backup Slot 2 instructors (acting 100% Floating across campus) when primary instructor is absent.',
  },
  {
    key: 'enableCrossMutualBackup',
    title: 'Cross-Subject Mutual Instructor Backup',
    category: 'Attendance & Substitution',
    badge: 'Subject Pairings',
    description:
      'Enforces mutual cross-backup pairs: Forensics (Paper-5) <-> ICT Cyber (Paper-6) and Police Admin (Paper-8/9) <-> Criminology (Paper-7).',
  },
  {
    key: 'enableSubjectPriorityTiers',
    title: 'Percentage-Based Priority Scaling (High: +50%, Low: -50%)',
    category: 'Curriculum & Room Limits',
    badge: 'Priority % Scale',
    description:
      'Prioritizes subjects on a percentage scale: High priority awards +50% more subject allocation over its standard remaining ratio, Low priority reduces allocation by -50%, strictly capped at the maximum classroom count (15 classrooms).',
  },
  {
    key: 'enableProportionalRemainingRatio',
    title: 'Proportional Remaining Quota Fill-Up (75 Daily Sessions)',
    category: 'Curriculum & Room Limits',
    badge: 'Remaining % Ratio',
    description:
      'Fills daily classroom sessions (5 periods × 15 classrooms = 75 total sessions) in exact proportion to each subject\'s remaining session percentage across classrooms, ensuring subjects with large remaining quotas get proportionally more time while small-quota subjects complete at a measured pace.',
  },
  {
    key: 'enableGuaranteedPriorityPeriods',
    title: 'Guaranteed Priority Minimum Periods Delivery',
    category: 'Curriculum & Room Limits',
    badge: 'Strict Priority Quota',
    description:
      'Guarantees that subjects prioritized during routine generation strictly receive their minimum required periods (at least 1 period per prioritized classroom or designated quota), using substitute staffing and slot balancing while fully adhering to all other operational rules (zero double-booking, building change gap, instructor caps).',
  },
  {
    key: 'enableClassroomSubjectEqualization',
    title: 'Individual Classroom Subject Equalization (Quota %)',
    category: 'Curriculum & Room Limits',
    badge: 'Class % Balance',
    description:
      'Dynamically prioritizes subjects with the lowest completion percentage (sessions delivered / room target quota %) in each specific classroom, ensuring curriculum progress advances equally across all subjects inside every individual class.',
  },
  {
    key: 'enableRoomQuotaCompletionLock',
    title: 'Classroom 100% Syllabus Completion Lockout',
    category: 'Curriculum & Room Limits',
    badge: '100% Quota Lock',
    description:
      'Strictly locks and excludes any subject paper from being allocated to a classroom once that classroom has reached 100% of its target sessions for that subject, preventing surplus over-teaching and preserving class periods for incomplete subjects.',
  },
  {
    key: 'enableMaxRoomDailyLimit',
    title: 'Classroom Daily Subject Frequency Cap (Max 2/Day)',
    category: 'Curriculum & Room Limits',
    badge: 'Topic Variety',
    description:
      'Prevents any subject paper from being scheduled more than twice in the exact same classroom on a single day to maintain curriculum diversity.',
  },
];

export function RoutineRulesModal({ isOpen, onClose, rules, onSaveRules }: RoutineRulesModalProps) {
  const [localRules, setLocalRules] = useState<RoutineRuleConfig>({ ...rules });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  if (!isOpen) return null;

  const handleToggle = (key: keyof RoutineRuleConfig) => {
    setLocalRules((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleEnableAll = () => {
    const updated: any = {};
    RULES_LIST.forEach((r) => {
      updated[r.key] = true;
    });
    setLocalRules(updated);
  };

  const handleDisableAll = () => {
    const updated: any = {};
    RULES_LIST.forEach((r) => {
      updated[r.key] = false;
    });
    setLocalRules(updated);
  };

  const handleResetDefaults = () => {
    setLocalRules({ ...DEFAULT_ROUTINE_RULES });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveRules(localRules);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Error saving rules to server:', err);
      alert('Failed to save rules to server.');
    } finally {
      setIsSaving(false);
    }
  };

  const categories = ['ALL', 'Workload & Balancing', 'Movement & Building', 'Attendance & Substitution', 'Curriculum & Room Limits'];

  const filteredRules =
    filterCategory === 'ALL'
      ? RULES_LIST
      : RULES_LIST.filter((r) => r.category === filterCategory);

  const activeCount = Object.values(localRules).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <Sliders className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Routine Generation Constraint Checks</h2>
              <p className="text-xs text-blue-200/80">
                Enable or disable operational conditions for daily routine generation. All settings persist on the server disk.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Toolbar & Category Filters */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Checks:
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {activeCount} of {RULES_LIST.length} Enabled
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleEnableAll}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition"
            >
              Enable All
            </button>
            <button
              onClick={handleDisableAll}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition"
            >
              Disable All
            </button>
            <button
              onClick={handleResetDefaults}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center space-x-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                filterCategory === cat
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Rules Grid */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1 bg-slate-50/50">
          {filteredRules.map((item) => {
            const isEnabled = Boolean(localRules[item.key]);
            return (
              <div
                key={item.key}
                onClick={() => handleToggle(item.key)}
                className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex items-start justify-between gap-4 ${
                  isEnabled
                    ? 'bg-white border-blue-200 shadow-sm hover:border-blue-400'
                    : 'bg-slate-100/80 border-slate-200 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-slate-900">{item.title}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                </div>

                {/* Toggle switch */}
                <div className="pt-0.5">
                  <div
                    className={`w-12 h-6 flex items-center rounded-full p-1 duration-300 cursor-pointer ${
                      isEnabled ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center space-x-1.5">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Persisted directly to Server Storage (`data/routine_store.json`)</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold shadow-md shadow-blue-500/20 flex items-center space-x-2 disabled:opacity-50 transition"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Saved to Server!</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'Saving to Server...' : 'Save & Apply to Server'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
