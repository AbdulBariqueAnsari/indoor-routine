/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Classroom, ClassSlot, Paper, Teacher } from '../types';
import { PERIOD_TIMINGS } from '../data/initialData';
import { BookOpen, Building, Clock, GraduationCap, Shield, User, UserCheck, X } from 'lucide-react';

interface SlotDetailModalProps {
  slot: ClassSlot | null;
  classroom?: Classroom;
  paper?: Paper;
  teacher?: Teacher;
  onClose: () => void;
}

export const SlotDetailModal: React.FC<SlotDetailModalProps> = ({
  slot,
  classroom,
  paper,
  teacher,
  onClose,
}) => {
  if (!slot) return null;

  const timing = PERIOD_TIMINGS.find((p) => p.period === slot.period);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Class Period Details</h2>
              <p className="text-[11px] text-slate-300">
                Period {slot.period} ({timing?.time || '40 min'}) · {classroom?.name || slot.roomId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Paper Info Banner */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <span
                className="font-mono font-bold text-xs px-2.5 py-1 rounded text-white shadow-2xs"
                style={{ backgroundColor: paper?.color || '#4F46E5' }}
              >
                {paper?.code || slot.paperId}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                {paper?.category || 'Syllabus Module'}
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                {paper?.title || 'Subject / Course Module'}
              </h3>
            </div>

            {paper?.description && (
              <p className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                {paper.description}
              </p>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Assigned Instructor */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 mb-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Assigned Instructor</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-xs bg-indigo-50 border border-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded">
                  {teacher?.code || slot.teacherId}
                </span>
                <span className="font-bold text-slate-900 text-xs truncate">
                  {teacher?.name || 'Instructor'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {teacher?.designation || 'Training Instructor'}
              </p>
              <div className="mt-2 text-[10px] text-slate-600 font-medium">
                Base Building:{' '}
                <strong className="text-slate-800">
                  {teacher?.assignedBuilding === 'OLD'
                    ? 'Old Building'
                    : teacher?.assignedBuilding === 'NEW'
                    ? 'New Building'
                    : 'Floating / Both'}
                </strong>
              </div>
            </div>

            {/* Classroom Info */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1.5">
                <Building className="w-3.5 h-3.5" />
                <span>Classroom Location</span>
              </div>
              <div className="font-bold text-slate-900 text-xs">
                {classroom?.name || slot.roomId}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {classroom?.building === 'OLD'
                  ? 'Old School Building'
                  : 'New School Building'}
                {classroom?.floor ? ` · Floor ${classroom.floor}` : ''}
              </p>
              <div className="mt-2 text-[10px] text-slate-600 font-medium">
                Seating Capacity:{' '}
                <strong className="text-slate-800">
                  {classroom?.capacity || 70} Recruits
                </strong>
              </div>
            </div>
          </div>

          {/* Substitute or Priority Status */}
          {slot.isSubstitute && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <UserCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Substitute Instructor Engagement:</span>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  {slot.substituteReason || 'Assigned as qualified replacement instructor.'}
                </p>
              </div>
            </div>
          )}

          {slot.isPriority && (
            <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong>Priority Subject:</strong> Marked for accelerated syllabus completion.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            STC, SAP 4th Bn · Official Routine Record
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
