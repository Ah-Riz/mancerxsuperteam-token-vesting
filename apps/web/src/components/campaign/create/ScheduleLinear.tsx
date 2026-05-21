"use client";

import { CARD, INPUT, Field, SectionHeader, formatDuration } from "./shared";

export function ScheduleLinear({
  startTime,
  onStartTimeChange,
  cliffTime,
  onCliffTimeChange,
  endTime,
  onEndTimeChange,
  scheduleError,
}: {
  startTime: string;
  onStartTimeChange: (value: string) => void;
  cliffTime: string;
  onCliffTimeChange: (value: string) => void;
  endTime: string;
  onEndTimeChange: (value: string) => void;
  scheduleError?: string | null;
}) {
  return (
    <div className={`${CARD} space-y-4 p-5`}>
      <SectionHeader title="Schedule" caption="Tokens unlock gradually from cliff to end. Proportional, smooth release." />
      <div className="grid gap-4 md:grid-cols-3">
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
          label="Cliff Time"
          input={
            <input
              type="datetime-local"
              value={cliffTime}
              onChange={(e) => onCliffTimeChange(e.target.value)}
              className={INPUT}
            />
          }
        />
        <Field
          label="End Time"
          input={
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => onEndTimeChange(e.target.value)}
              className={INPUT}
            />
          }
        />
      </div>
      {startTime && endTime ? (
        <p className="text-[12px] text-[#6f7c95]">
          Total vesting duration: {formatDuration(startTime, endTime) || "—"}
          {cliffTime && startTime ? ` · Cliff after ${formatDuration(startTime, cliffTime) || "—"}` : ""}
        </p>
      ) : null}
      {scheduleError ? <p className="text-[12px] text-red-400">{scheduleError}</p> : null}
    </div>
  );
}
