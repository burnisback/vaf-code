/**
 * Modal Components
 *
 * Reusable modal dialogs for:
 * - Action preview before execution
 * - Confirmation dialogs
 * - Error details
 */

'use client';

import React, { useEffect, useCallback } from 'react';
import { X, AlertTriangle, FileCode, Terminal, Check, Trash2 } from 'lucide-react';
import type { BoltAction } from '@/lib/bolt/types';

// =============================================================================
// BASE MODAL
// =============================================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full ${sizeClasses[size]} bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// =============================================================================
// CONFIRMATION DIALOG
// =============================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  isLoading = false,
}: ConfirmDialogProps) {
  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const confirmStyles = {
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    primary: 'bg-violet-500 hover:bg-violet-600 text-white',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-zinc-400 text-sm">{message}</p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 ${confirmStyles[confirmVariant]}`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================================
// ACTION PREVIEW MODAL
// =============================================================================

interface ActionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onSkipAction: (index: number) => void;
  actions: BoltAction[];
  skippedIndices: Set<number>;
}

export function ActionPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  onSkipAction,
  actions,
  skippedIndices,
}: ActionPreviewModalProps) {
  const activeActions = actions.filter((_, i) => !skippedIndices.has(i));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Preview Actions" size="lg">
      <div className="space-y-4">
        <p className="text-zinc-400 text-sm">
          The following actions will be executed. Click on an action to skip it.
        </p>

        {/* Actions List */}
        <div className="max-h-[300px] overflow-auto space-y-2">
          {actions.map((action, index) => {
            const isSkipped = skippedIndices.has(index);
            const isFile = action.type === 'file';

            return (
              <div
                key={index}
                onClick={() => onSkipAction(index)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                  isSkipped
                    ? 'bg-zinc-800/30 opacity-50'
                    : 'bg-zinc-800/50 hover:bg-zinc-800'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isSkipped
                      ? 'bg-zinc-700'
                      : isFile
                      ? 'bg-blue-500/20'
                      : 'bg-amber-500/20'
                  }`}
                >
                  {isFile ? (
                    <FileCode
                      className={`w-4 h-4 ${
                        isSkipped ? 'text-zinc-500' : 'text-blue-400'
                      }`}
                    />
                  ) : (
                    <Terminal
                      className={`w-4 h-4 ${
                        isSkipped ? 'text-zinc-500' : 'text-amber-400'
                      }`}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isSkipped ? 'text-zinc-500 line-through' : 'text-white'
                      }`}
                    >
                      {isFile ? action.filePath : 'Shell Command'}
                    </span>
                    {isSkipped && (
                      <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                        Skipped
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">
                    {isFile
                      ? `${action.content.split('\n').length} lines`
                      : action.content}
                  </p>
                </div>

                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center ${
                    isSkipped
                      ? 'border-zinc-600 bg-zinc-700'
                      : 'border-emerald-500 bg-emerald-500'
                  }`}
                >
                  {!isSkipped && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <div className="text-sm text-zinc-500">
            {activeActions.length} of {actions.length} actions will be executed
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={activeActions.length === 0}
              className="px-4 py-2 text-sm bg-violet-500 hover:bg-violet-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Execute {activeActions.length} Action{activeActions.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================================
// UNDO ALL CONFIRMATION
// =============================================================================

interface UndoConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  actionCount: number;
  actions: Array<{ type: string; path?: string; content?: string }>;
  isLoading?: boolean;
}

export function UndoConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  actionCount,
  actions,
  isLoading = false,
}: UndoConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Undo All Changes" size="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-200 text-sm font-medium">
              This will undo {actionCount} action{actionCount !== 1 ? 's' : ''}
            </p>
            <p className="text-amber-200/70 text-xs mt-1">
              Files will be restored to their previous state or deleted if they were newly created.
            </p>
          </div>
        </div>

        {/* Actions to undo */}
        <div className="max-h-[200px] overflow-auto space-y-1">
          {actions.slice(0, 10).map((action, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 rounded text-sm"
            >
              {action.type === 'file' ? (
                <FileCode className="w-4 h-4 text-blue-400" />
              ) : (
                <Terminal className="w-4 h-4 text-amber-400" />
              )}
              <span className="text-zinc-300 truncate">
                {action.path || action.content?.slice(0, 40)}
              </span>
              <Trash2 className="w-3 h-3 text-red-400 ml-auto" />
            </div>
          ))}
          {actions.length > 10 && (
            <p className="text-xs text-zinc-500 text-center py-2">
              ...and {actions.length - 10} more
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Undoing...' : `Undo ${actionCount} Action${actionCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
