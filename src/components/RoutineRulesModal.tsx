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
  category: 'Tier 1: Inviolable Constraints' | 'Tier 2: Curriculum & Progression (Moto I & IV)' | 'Tier 3: Staffing & Substitution (Moto III)';
  description: string;
  badge: string;
  tierNumber: 1 | 2 | 3;
}

const RULES_LIST: RuleItem[] = [
  // ==========================================
  // TIER 1: INVIOLABLE CONSTRAINTS (HARD RULES)
  // ==========================================
  {
    key: 'enableZeroDoubleBooking',
    title: '1. Strict Zero Double-Booking Guarantee',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Hard Rule 1',
    tierNumber: 1,
    description:
      'Strictly prohibits any instructor from being scheduled in multiple classrooms simultaneously during the exact same period.',
  },
  {
    key: 'enableStrictAbsenteeExclusion',
    title: '2. Faculty Unavailability & Leave Exclusion',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Hard Rule 2',
    tierNumber: 1,
    description:
      'Instructors marked Absent, On Leave, Duty, or Sick in the Unavailability Register are strictly excluded from routine creation.',
  },
  {
    key: 'enableStrictBuildingBinding',
    title: '3. Strict Building-Bound Faculty Detailment (Moto III)',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Moto III: Hard Rule',
    tierNumber: 1,
    description:
      'Old Building (OB) teachers are strictly bound to Old Building classrooms (OB-1 to OB-8). New Building (NB) teachers are strictly bound to New Building (NB-1 to NB-7). Only Floating teachers can cross between buildings.',
  },
  {
    key: 'enableBuildingChangeGap',
    title: '4. Mandatory 1-Period Gap on Floating Campus Transit (Moto III)',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Transit Gap',
    tierNumber: 1,
    description:
      'When a Floating instructor crosses between Old School Building and New School Building, a mandatory 1-period buffer is enforced to allow physical movement across campus.',
  },
  {
    key: 'enableRoomQuotaCompletionLock',
    title: '5. Classroom 100% Syllabus Quota Lockout',
    category: 'Tier 1: Inviolable Constraints',
    badge: '100% Quota Lock',
    tierNumber: 1,
    description:
      'Strictly locks and excludes any subject paper from being allocated to a classroom once that classroom has reached 100% of its target sessions for that subject, preserving class periods for lagging subjects.',
  },
  {
    key: 'enableMaxOnePeriodPerSubjectPerRoomDaily',
    title: '6. Single Period per Subject per Room Daily (Moto II)',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Moto II: Daily Variety',
    tierNumber: 1,
    description:
      'Ek room me ek hi din same subject ka 2 period nahi hoga. Har class me din ke 5 periods me 5 alag-alag subjects deliver honge.',
  },
  {
    key: 'enableNonConsecutiveGapForSameSubject',
    title: '7. Mandatory Non-Consecutive Gap for Same Subject (Moto II)',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Moto II: No Back-to-Back',
    tierNumber: 1,
    description:
      'Agar kisi class me kisi subject ke 2 period allow kiye jayein, toh wo kabhi bhi back-to-back nahi honge. Beech me kam se kam 1 period ka gap lazmi hoga (e.g. Period 1 and Period 3/4).',
  },
  {
    key: 'enableMaxRoomDailyLimit',
    title: '8. Classroom Daily Max Limit (Max 2 Periods/Subject/Day)',
    category: 'Tier 1: Inviolable Constraints',
    badge: 'Frequency Cap',
    tierNumber: 1,
    description:
      'Prevents any subject paper from being scheduled more than twice in the exact same classroom on a single day to preserve curriculum diversity.',
  },

  // ==========================================
  // TIER 2: CURRICULUM PROGRESSION (MOTO I & IV)
  // ==========================================
  {
    key: 'enableClassroomSubjectEqualization',
    title: '9. Room-Wise Syllabus Completion % Equalization (Moto I)',
    category: 'Tier 2: Curriculum & Progression (Moto I & IV)',
    badge: 'Moto I: % Equalizer',
    tierNumber: 2,
    description:
      'Subject aise detailment ho har rooms me ki overall sessions completion percentage (completed / target quota %) har room aur subject me lagbhag equal aur balanced rahe.',
  },
  {
    key: 'enablePaperRotationalFlow',
    title: '10. Sequential Subject Rotational Flow Across Classrooms (Moto IV)',
    category: 'Tier 2: Curriculum & Progression (Moto I & IV)',
    badge: 'Moto IV: Wave Flow',
    tierNumber: 2,
    description:
      'Subject detailment har next period me next room me detail ho (Room K in Period P -> Room K+1 in Period P+1). Teachers subject ke upar building-wise aur floating aadhar par allot honge.',
  },
  {
    key: 'enableProportionalRemainingRatio',
    title: '11. Proportional Remaining Quota Fill-Up (75 Daily Sessions)',
    category: 'Tier 2: Curriculum & Progression (Moto I & IV)',
    badge: 'Remaining % Ratio',
    tierNumber: 2,
    description:
      'Fills daily classroom sessions (5 periods x 15 classrooms = 75 total sessions) in exact proportion to each subject remaining session percentage across classrooms.',
  },
  {
    key: 'enableSubjectPriorityTiers',
    title: '12. Percentage-Based Priority Scaling (High: +50%, Low: -50%)',
    category: 'Tier 2: Curriculum & Progression (Moto I & IV)',
    badge: 'Priority % Scale',
    tierNumber: 2,
    description:
      'Awards +50% allocation to High Priority subjects and reduces Low Priority by -50%, capped at classroom count.',
  },
  {
    key: 'enableGuaranteedPriorityPeriods',
    title: '13. Guaranteed Priority Minimum Periods Delivery',
    category: 'Tier 2: Curriculum & Progression (Moto I & IV)',
    badge: 'Strict Priority Delivery',
    tierNumber: 2,
    description:
      'Guarantees that subjects prioritized during routine generation strictly receive their minimum required periods (at least 1 period per prioritized classroom or designated quota).',
  },
  {
    key: 'enableDayToDayProgression',
    title: '14. Day-to-Day Room Progression Carryover',
    category: 'Tier 2: Curriculum & Progression (Moto I & IV)',
    badge: 'Daily Stepper',
    tierNumber: 2,
    description:
      'Seeds Period 1 starting rooms based on where routine ended on the previous day (e.g. Room 1 advances to Room 2 on next day).',
  },

  // ==========================================
  // TIER 3: STAFFING & WORKLOAD (MOTO III)
  // ==========================================
  {
    key: 'enableWorkloadEqualization',
    title: '15. Cumulative Faculty Workload Equalization',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Fair Workload',
    tierNumber: 3,
    description:
      'Dynamically prioritizes lagging instructors in Practical and Backup slots so all 26 instructors gradually converge to approximately equal total sessions.',
  },
  {
    key: 'enableDailyWorkloadSoftCap',
    title: '16. Daily Workload Soft-Cap (Max 3 Periods/Day)',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Soft-Cap (<=3)',
    tierNumber: 3,
    description:
      'Prioritizes instructors with fewer than 3 periods today before assigning a 4th period, keeping daily teaching load balanced across campus.',
  },
  {
    key: 'enableNoSubstituteAllotment',
    title: '17. Strict Main Teacher Only (No Substitute Allotment)',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'No Substitute Allotment',
    tierNumber: 3,
    description:
      'Agar kisi subject ke liye main teacher nahi hai to koi substitute teacher apply nahi hoga. Wo jagah bilkul khali (blank) rahegi.',
  },
  {
    key: 'replaceWithAvailableSubjectIfNoPrimary',
    title: '18. Replace with Alternate Available Subject (Sub-Rule)',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Alternate Subject Fill',
    tierNumber: 3,
    description:
      'Sub-rule under No Substitute: Agar main teacher unavailable ho to khali chhodne ke bajaye slot ko dusre available subject aur uske available primary teacher se replace karein.',
  },
  {
    key: 'enableDesignatedBackup',
    title: '19. Designated Backup Instructor Substitution',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Backup Slots 1 & 2',
    tierNumber: 3,
    description:
      'When substitution is allowed: Automatically appoints designated Backup Slot 1 and Backup Slot 2 instructors (acting 100% Floating across campus) when primary instructor is absent.',
  },
  {
    key: 'enableCrossMutualBackup',
    title: '20. Cross-Subject Mutual Instructor Backup',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Subject Pairings',
    tierNumber: 3,
    description:
      'Enforces mutual cross-backup pairs: Forensics (Paper-5) <-> ICT Cyber (Paper-6) and Police Admin (Paper-8/9) <-> Criminology (Paper-7).',
  },
  {
    key: 'enablePracticalFlexible',
    title: '21. Flexible Practical (Paper-13) Staffing',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Staffing Equalizer',
    tierNumber: 3,
    description:
      'Practical does not have dedicated instructors; permits any qualified available instructor to conduct Practical sessions to balance workloads.',
  },
  {
    key: 'enableCaravanFlow',
    title: '22. Instructor-Bound Caravan Flow (Default: OFF)',
    category: 'Tier 3: Staffing & Substitution (Moto III)',
    badge: 'Teacher Caravan',
    tierNumber: 3,
    description:
      'Forces the specific instructor to physically travel with their subject consecutively from Room K to Room K+1. Kept OFF by default in favor of Subject Rotational Flow.',
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

  const categories = [
    'ALL',
    'Tier 1: Inviolable Constraints',
    'Tier 2: Curriculum & Progression (Moto I & IV)',
    'Tier 3: Staffing & Substitution (Moto III)',
  ];

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
