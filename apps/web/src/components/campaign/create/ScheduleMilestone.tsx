"use client";

import { CARD, INPUT, INPUT_ERR, Field, SectionHeader, formatDuration } from "./shared";

export function ScheduleMilestone({
  startTime,
  onStartTimeChange,
  unlockTime,
  onUnlockTimeChange,
  milestoneIdx,
  onMilestoneIdxChange,
  scheduleError,
  milestoneError,
}: {
  startTime: string;
  onStartTimeChange: (value: string) => void;
  unlockTime: string;
  onUnlockTimeChange: (value: string) => void;
  milestoneIdx: string;
  onMilestoneIdxChange: (value: string) => void;
  scheduleError?: string | null;
  milestoneError?: string | null;
}) {
  return (
    <div className={`${CARD} space-y-4 p-5`}>
      <SectionHeader title="Schedule" caption="Full release after a time-gated milestone. Tracked by on-chain bitmap." />
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Start Time"
          input={
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              className={INPUT}
            />
          }
        />
        <Field
          label="Unlock Time"
          input={
            <input
              type="datetime-local"
              value={unlockTime}
              onChange={(e) => onUnlockTimeChange(e.target.value)}
              className={INPUT}
            />
          }
        />
      </div>
      {startTime && unlockTime ? (
        <p className="text-[12px] text-[#6f7c95]">
          Duration until unlock: {formatDuration(startTime, unlockTime) || "—"}
        </p>
      ) : null}
      {scheduleError ? <p className="text-[12px] text-red-400">{scheduleError}</p> : null}
      <Field
        label="Milestone Index"
        input={
          <input
            type="number"
            min="0"
            max="255"
            value={milestoneIdx}
            onChange={(e) => onMilestoneIdxChange(e.target.value)}
            className={`${INPUT} max-w-[160px] ${milestoneError ? INPUT_ERR : ""}`}
          />
        }
        error={milestoneError}
        hint="Index 0–255 in on-chain bitmap. Default 0 for single milestones."
      />
    </div>
  );
}
