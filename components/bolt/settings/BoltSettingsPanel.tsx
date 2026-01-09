'use client';

/**
 * BoltSettingsPanel
 *
 * Settings UI for Bolt Playground configuration.
 * Provides toggles and inputs for all configuration options.
 */

import React from 'react';
import {
  Settings,
  GitBranch,
  Eye,
  Zap,
  RotateCcw,
  X,
  Play,
} from 'lucide-react';
import { useBoltConfig } from '@/lib/bolt/config/context';

// =============================================================================
// TYPES
// =============================================================================

interface BoltSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// TOGGLE COMPONENT
// =============================================================================

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function Toggle({ label, description, checked, onChange, disabled = false }: ToggleProps) {
  return (
    <label className={`flex items-start gap-3 group ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <div
          className={`w-9 h-5 rounded-full transition-colors ${
            checked ? 'bg-violet-500' : 'bg-zinc-700'
          } ${disabled ? '' : 'group-hover:opacity-80'}`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              checked ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-sm text-zinc-200 ${!disabled && 'group-hover:text-white'}`}>
          {label}
        </span>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}

// =============================================================================
// NUMBER INPUT
// =============================================================================

interface NumberInputProps {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

function NumberInput({
  label,
  description,
  value,
  onChange,
  min = 1,
  max = 10,
  disabled = false,
}: NumberInputProps) {
  return (
    <div className={`flex items-start justify-between gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-zinc-300">{label}</span>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        )}
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
        min={min}
        max={max}
        disabled={disabled}
        className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 text-center disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-violet-500"
      />
    </div>
  );
}

// =============================================================================
// SECTION HEADER
// =============================================================================

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  color?: string;
}

function SectionHeader({ icon, title, color = 'text-violet-400' }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={color}>{icon}</span>
      <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function BoltSettingsPanel({ isOpen, onClose }: BoltSettingsPanelProps) {
  const {
    config,
    updateComplexMode,
    updateClassification,
    updateExecution,
    updateUI,
    resetToDefaults,
  } = useBoltConfig();

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 max-h-[60vh] overflow-y-auto overflow-x-hidden scrollbar-thin">
          {/* Complex Mode Section */}
          <section>
            <SectionHeader
              icon={<GitBranch className="w-4 h-4" />}
              title="Complex Mode"
              color="text-violet-400"
            />
            <div className="space-y-4 pl-6">
              <Toggle
                label="Enable Complex Mode"
                description="Handle multi-file requests with planning"
                checked={config.complexMode.enabled}
                onChange={(v) => updateComplexMode({ enabled: v })}
              />
              <Toggle
                label="Auto-detect Complex Requests"
                description="Automatically detect when planning is needed"
                checked={config.complexMode.autoDetect}
                onChange={(v) => updateComplexMode({ autoDetect: v })}
                disabled={!config.complexMode.enabled}
              />
              <Toggle
                label="Require Plan Approval"
                description="Show plan for review before executing"
                checked={config.complexMode.requireApproval}
                onChange={(v) => updateComplexMode({ requireApproval: v })}
                disabled={!config.complexMode.enabled}
              />
              <Toggle
                label="Auto-fix Build Errors"
                description="Automatically attempt to fix verification errors"
                checked={config.complexMode.autoFix}
                onChange={(v) => updateComplexMode({ autoFix: v })}
                disabled={!config.complexMode.enabled}
              />
              <NumberInput
                label="Max Refinement Iterations"
                description="Maximum auto-fix attempts"
                value={config.complexMode.maxIterations}
                onChange={(v) => updateComplexMode({ maxIterations: v })}
                min={1}
                max={5}
                disabled={!config.complexMode.enabled}
              />
            </div>
          </section>

          {/* Classification Section */}
          <section>
            <SectionHeader
              icon={<Zap className="w-4 h-4" />}
              title="Classification"
              color="text-amber-400"
            />
            <div className="space-y-4 pl-6">
              <NumberInput
                label="Simple Threshold"
                description="Max files for simple mode"
                value={config.classification.simpleThreshold}
                onChange={(v) => updateClassification({ simpleThreshold: v })}
                min={1}
                max={5}
              />
              <NumberInput
                label="Moderate Threshold"
                description="Max files for moderate mode"
                value={config.classification.moderateThreshold}
                onChange={(v) => updateClassification({ moderateThreshold: v })}
                min={3}
                max={10}
              />
              <Toggle
                label="Allow Mode Override"
                description="Let users change detected mode"
                checked={config.classification.allowOverride}
                onChange={(v) => updateClassification({ allowOverride: v })}
              />
            </div>
          </section>

          {/* Execution Section */}
          <section>
            <SectionHeader
              icon={<Play className="w-4 h-4" />}
              title="Execution"
              color="text-emerald-400"
            />
            <div className="space-y-4 pl-6">
              <Toggle
                label="Stop on First Error"
                description="Halt execution when a task fails"
                checked={config.execution.stopOnError}
                onChange={(v) => updateExecution({ stopOnError: v })}
              />
              <NumberInput
                label="Verification Delay (ms)"
                description="Wait time before checking for errors"
                value={config.execution.verificationDelay}
                onChange={(v) => updateExecution({ verificationDelay: v })}
                min={500}
                max={5000}
              />
            </div>
          </section>

          {/* UI Section */}
          <section>
            <SectionHeader
              icon={<Eye className="w-4 h-4" />}
              title="Display"
              color="text-blue-400"
            />
            <div className="space-y-4 pl-6">
              <Toggle
                label="Show Classification Badge"
                description="Display mode indicator on messages"
                checked={config.ui.showClassificationBadge}
                onChange={(v) => updateUI({ showClassificationBadge: v })}
              />
              <Toggle
                label="Show Detailed Plan"
                description="Display full task list in plan preview"
                checked={config.ui.showDetailedPlan}
                onChange={(v) => updateUI({ showDetailedPlan: v })}
              />
              <Toggle
                label="Show Task Progress"
                description="Display real-time task execution progress"
                checked={config.ui.showTaskProgress}
                onChange={(v) => updateUI({ showTaskProgress: v })}
              />
              <Toggle
                label="Show Iteration Badge"
                description="Display refinement iteration progress"
                checked={config.ui.showIterationBadge}
                onChange={(v) => updateUI({ showIterationBadge: v })}
              />
              <Toggle
                label="Expand Errors by Default"
                description="Auto-expand error lists in verification"
                checked={config.ui.expandErrors}
                onChange={(v) => updateUI({ expandErrors: v })}
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default BoltSettingsPanel;
