/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RoutineRuleConfig } from '../types';
import { ConfirmModal } from './ConfirmModal';
import {
  DEFAULT_ROUTINE_RULES,
  MASTER_ROUTINE_RULES,
  isRuleDisabled,
  getRuleDisabledHint,
  normalizeRuleConfig,
} from '../data/initialData';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface RoutineRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: RoutineRuleConfig;
  onSaveRules: (updatedRules: RoutineRuleConfig) => Promise<void>;
}

export function RoutineRulesModal({
  isOpen,
  onClose,
  rules,
  onSaveRules,
}: RoutineRulesModalProps) {
  const { shouldRender, backdropAnimationClass, modalAnimationClass } = useModalAnimation(isOpen);
  const [localRules, setLocalRules] = useState<RoutineRuleConfig>(normalizeRuleConfig(rules));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [isHierarchyExpanded, setIsHierarchyExpanded] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  if (!shouldRender) return null;

  const handleToggle = (key: keyof RoutineRuleConfig) => {
    if (isRuleDisabled(key, localRules)) return;
    setLocalRules((prev) => {
      const next = {
        ...prev,
        [key]: !prev[key],
      };
      return normalizeRuleConfig(next);
    });
  };

  const handleEnableAll = () => {
    const updated: any = {};
    MASTER_ROUTINE_RULES.forEach((r) => {
      updated[r.key] = true;
    });
    setLocalRules(normalizeRuleConfig(updated));
  };

  const handleDisableAll = () => {
    const updated: any = {};
    MASTER_ROUTINE_RULES.forEach((r) => {
      updated[r.key] = false;
    });
    setLocalRules(normalizeRuleConfig(updated));
  };

  const handleResetDefaults = () => {
    setLocalRules(normalizeRuleConfig(DEFAULT_ROUTINE_RULES));
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
      setAlertConfig({
        isOpen: true,
        title: 'Save Failed',
        message: 'Failed to save rules to server. Please try again.',
        variant: 'danger',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const categories = [
    { id: 'ALL', label: 'All Checks (Rules 3–24)' },
    { id: 'Tier 1: Inviolable Constraints', label: 'Tier 1: Constraints (3–9)' },
    { id: 'Tier 2: Curriculum & Progression (Moto I & IV)', label: 'Tier 2: Subject Detailment (10–16)' },
    { id: 'Tier 3: Staffing & Substitution (Moto III)', label: 'Tier 3: Teacher Staffing (17–24)' },
  ];

  const filteredRules =
    filterCategory === 'ALL'
      ? MASTER_ROUTINE_RULES
      : MASTER_ROUTINE_RULES.filter((r) => r.category === filterCategory);

  const activeCount = MASTER_ROUTINE_RULES.filter((r) => Boolean(localRules[r.key])).length;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 no-print ${backdropAnimationClass}`}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 ${modalAnimationClass}`}>
        {/* Compact Header with Gradient */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4 text-blue-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                  Routine Rules & Constraint Checks
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-400/20 text-blue-200 border border-blue-400/30 font-mono">
                  {activeCount}/{MASTER_ROUTINE_RULES.length} Active
                </span>
              </div>
              <p className="text-[11px] text-blue-200/80 truncate">
                Configure scheduling conditions, hard limits & curriculum progression rules
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar & Filters */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 sm:px-5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  filterCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-2xs scale-[1.02]'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Quick Bulk Actions */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={handleEnableAll}
              className="text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            >
              Enable All
            </button>
            <button
              onClick={handleDisableAll}
              className="text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            >
              Disable All
            </button>
            <button
              onClick={handleResetDefaults}
              className="text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-md border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center space-x-1 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Defaults</span>
            </button>
          </div>
        </div>

        {/* Collapsible Priority Hierarchy Overview */}
        <div className="px-4 py-1.5 bg-amber-50/70 border-b border-amber-200/80 text-amber-950 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setIsHierarchyExpanded(!isHierarchyExpanded)}
            className="w-full flex items-center justify-between text-left font-semibold text-[11px] text-amber-900 hover:text-amber-950 cursor-pointer"
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Priority Protocol:</span>
              <span className="font-bold text-amber-800">
                Core Rules (1 &amp; 2) &gt; Tier 1 Constraints &gt; Tier 2 (Curriculum) / Tier 3 (Staffing)
              </span>
              <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full border ${
                localRules.enableTeacherLoadEqualizationPriority
                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                  : 'bg-blue-100 text-blue-900 border-blue-300'
              }`}>
                {localRules.enableTeacherLoadEqualizationPriority
                  ? 'Teacher-First Equalization Active (Rules 10–16 Locked)'
                  : 'Curriculum-First Mode Active (Rules 17, 18, 22, 24 Locked)'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-amber-700 font-medium shrink-0">
              <span>{isHierarchyExpanded ? 'Hide info' : 'View hierarchy'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-300 ${
                  isHierarchyExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          <div
            className={`grid transition-all duration-300 ease-in-out ${
              isHierarchyExpanded
                ? 'grid-rows-[1fr] opacity-100'
                : 'grid-rows-[0fr] opacity-0 pointer-events-none'
            }`}
          >
            <div className="overflow-hidden">
              <div className="pt-1.5 pb-0.5 text-[10px] text-amber-900 leading-relaxed space-y-0.5 border-t border-amber-200/60 mt-1">
                <p>
                  • <strong>Inviolable Core Constraints</strong>: Rule 1 (Zero Double-Booking) and Rule 2 (Leave/Unavailability Exclusion) are always active. Instructor mapping daily period caps are strictly enforced.
                </p>
                <p>
                  • <strong>Tier 1 (Hard Rules 3–9)</strong>: Strict campus constraints (Building Binding, Transit Gap, 100% Lock, Single Period / Max 2, Excuse Protection, Rule 8 Equalizer, Practical Block).
                </p>
                <p>
                  • <strong>Rule 8 Mode Switch</strong>: When Rule 8 (Teacher Load Equalization) is ON, detailment prioritizes teacher deployment history, locking Subject Rules 10–16. When Rule 8 is OFF, Curriculum Rules 10–16 are active, locking Teacher-specific Rules 17, 18, 22, 24.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Inviolable Core Constraints Informational Banner (Always Active, Non-Toggleable) */}
        <div className="mx-3 sm:mx-4 mt-2.5 p-2 rounded-xl bg-slate-900 text-white flex items-center justify-between text-xs shadow-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-[10.5px] text-emerald-300 uppercase tracking-wider block">
                Inviolable Core Constraints (Permanently Active)
              </span>
              <div className="text-[10px] text-slate-300 font-medium truncate">
                • Rule 1: Zero Double-Booking Guarantee &nbsp;|&nbsp; • Rule 2: Unavailability &amp; Leave Exclusion &nbsp;|&nbsp; • Instructor Mapping Daily Period Hard-Cap
              </div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shrink-0 ml-2">
            Always Enforced
          </span>
        </div>

        {/* Rules Dense 2-Column Grid (Maximizes on-screen checks) */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredRules.map((item) => {
              const disabled = isRuleDisabled(item.key, localRules);
              const hint = getRuleDisabledHint(item.key, localRules) || item.disabledHint;
              const isEnabled = !disabled && Boolean(localRules[item.key]);
              const tierBadgeClass =
                item.tierNumber === 1
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : item.tierNumber === 2
                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-200';

              return (
                <div
                  key={item.key}
                  onClick={() => !disabled && handleToggle(item.key)}
                  className={`p-2.5 rounded-xl border transition-all duration-150 select-none flex items-start justify-between gap-2.5 ${
                    disabled
                      ? 'bg-slate-100/60 border-slate-200 opacity-50 cursor-not-allowed'
                      : isEnabled
                      ? 'bg-white border-blue-300 shadow-2xs hover:shadow-xs hover:border-blue-500 cursor-pointer hover:scale-[1.01]'
                      : 'bg-slate-50/80 border-slate-200 opacity-75 hover:opacity-100 cursor-pointer hover:border-slate-300 hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {/* Header line with title and tier badges */}
                    <div className="flex items-center flex-wrap gap-1.5">
                      <span className="text-xs font-bold text-slate-900 truncate leading-tight">
                        {item.title}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border shrink-0 ${tierBadgeClass}`}
                      >
                        Tier {item.tierNumber}
                      </span>
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full shrink-0 ${
                          disabled
                            ? 'bg-slate-200 text-slate-500'
                            : isEnabled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {disabled ? 'Locked' : item.badge}
                      </span>
                    </div>

                    {/* Compact Description (2-line clamped) */}
                    <p
                      className="text-[10px] text-slate-600 line-clamp-2 leading-tight"
                      title={item.description}
                    >
                      {item.description}
                    </p>

                    {/* Dependency lock message if applicable */}
                    {disabled && hint && (
                      <p className="text-[9.5px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded inline-block mt-0.5">
                        ↳ {hint}
                      </p>
                    )}
                  </div>

                  {/* Compact Toggle Switch */}
                  <div className="shrink-0 pt-0.5">
                    <div
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 duration-200 transition-colors ${
                        disabled
                          ? 'bg-slate-200 cursor-not-allowed justify-start'
                          : isEnabled
                          ? 'bg-blue-600 justify-end cursor-pointer shadow-inner'
                          : 'bg-slate-300 justify-start cursor-pointer'
                      }`}
                    >
                      <div className="bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Compact Footer */}
        <div className="px-4 py-2.5 sm:px-5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Persisted to SQL database (`data/routine_scheduler.sql`)</span>
            <span className="sm:hidden font-mono font-bold text-slate-700">{activeCount} checks active</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 disabled:opacity-50 transition cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save & Apply'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        variant={alertConfig.variant || 'danger'}
        isAlert={true}
        confirmText="OK"
        onConfirm={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
        onCancel={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
