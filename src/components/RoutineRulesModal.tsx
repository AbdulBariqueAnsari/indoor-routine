/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RoutineRuleConfig } from '../types';
import { DEFAULT_ROUTINE_RULES, MASTER_ROUTINE_RULES, MasterRuleDefinition } from '../data/initialData';
import { Check, CheckCircle2, RotateCcw, Shield, Sliders, X, AlertTriangle } from 'lucide-react';

interface RoutineRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: RoutineRuleConfig;
  onSaveRules: (updatedRules: RoutineRuleConfig) => Promise<void>;
}

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
    MASTER_ROUTINE_RULES.forEach((r) => {
      updated[r.key] = true;
    });
    setLocalRules(updated);
  };

  const handleDisableAll = () => {
    const updated: any = {};
    MASTER_ROUTINE_RULES.forEach((r) => {
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
      ? MASTER_ROUTINE_RULES
      : MASTER_ROUTINE_RULES.filter((r) => r.category === filterCategory);

  const activeCount = MASTER_ROUTINE_RULES.filter((r) => Boolean(localRules[r.key])).length;

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
                Configure operational conditions for daily routine creation. Settings persist directly on server disk.
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
              {activeCount} of {MASTER_ROUTINE_RULES.length} Enabled
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

        {/* Priority Hierarchy Banner */}
        <div className="mx-5 mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 text-amber-950 text-xs flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="font-bold text-[11px] uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <span>Rule Hierarchy & Conflict Resolution Protocol</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-200/70 text-amber-900 font-semibold text-[10px]">Tier 1 &gt; Tier 2 &gt; Tier 3</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Jab bhi do rules me conflict hoga, higher tier rule strictly lower tier ko override karega:
              <br />
              • <strong>Tier 1 (Hard Rules 1–9)</strong>: Inviolable constraints (Zero Double-Booking, Building Binding, Transit Gap, 100% Lock, Max 1 Period/Room, Non-consecutive, Hard-cap &le;4 periods/day). Never compromised.
              <br />
              • <strong>Tier 2 (Curriculum Rules 10–16)</strong>: Moto I &amp; IV subject detailment (Syllabus % equality, 6-day load balance, Rotational sequence, Priority quotas).
              <br />
              • <strong>Tier 3 (Staffing Rules 17–24)</strong>: Moto III teacher assignment &amp; substitution policies (Cumulative load balance, Soft-cap &le;3, No substitute / blank slot, Backup pairing).
            </p>
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap gap-1.5 mt-3">
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
        <div className="p-5 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
          {filteredRules.map((item) => {
            const isEnabled = Boolean(localRules[item.key]);
            const tierColor =
              item.tierNumber === 1
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : item.tierNumber === 2
                ? 'bg-blue-100 text-blue-800 border-blue-200'
                : 'bg-emerald-100 text-emerald-800 border-emerald-200';

            return (
              <div
                key={item.key}
                onClick={() => handleToggle(item.key)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-start justify-between gap-4 ${
                  isEnabled
                    ? 'bg-white border-blue-200 shadow-xs hover:border-blue-400'
                    : 'bg-slate-100/80 border-slate-200 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-900">{item.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tierColor}`}>
                      Tier {item.tierNumber}
                    </span>
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
            <span>Persisted directly to Server Storage (`data/rules.json`)</span>
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
