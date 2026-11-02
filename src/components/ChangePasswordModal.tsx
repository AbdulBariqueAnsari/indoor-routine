/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAdminPassword?: string;
  onSavePassword: (newPassword: string) => Promise<void> | void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentAdminPassword = 'admin123',
  onSavePassword,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleReset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const expectedCurrent = currentAdminPassword || 'admin123';
    if (currentPassword !== expectedCurrent) {
      setError('Current password is incorrect. Please verify and try again.');
      return;
    }

    if (!newPassword || newPassword.trim().length < 4) {
      setError('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation password do not match.');
      return;
    }

    if (newPassword === expectedCurrent) {
      setError('New password cannot be the same as the current password.');
      return;
    }

    try {
      setIsSaving(true);
      await onSavePassword(newPassword.trim());
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to update administrative password. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Change Admin Password</h2>
              <p className="text-[11px] text-slate-500">Update administrative security credentials</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {success ? (
            <div className="py-6 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Password Changed Successfully!</h3>
              <p className="text-xs text-slate-500">
                The new administrative password has been saved to the server and local storage.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Current Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Admin Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    autoFocus
                    placeholder="Enter current password..."
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setError('');
                    }}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 pl-9 pr-9 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="p-1 text-slate-400 hover:text-slate-600 absolute right-2 top-2"
                  >
                    {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Admin Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    placeholder="Enter new password (min. 4 characters)..."
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError('');
                    }}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 pl-9 pr-9 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="p-1 text-slate-400 hover:text-slate-600 absolute right-2 top-2"
                  >
                    {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Admin Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Re-type new password..."
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError('');
                    }}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 pl-9 pr-9 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="p-1 text-slate-400 hover:text-slate-600 absolute right-2 top-2"
                  >
                    {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
