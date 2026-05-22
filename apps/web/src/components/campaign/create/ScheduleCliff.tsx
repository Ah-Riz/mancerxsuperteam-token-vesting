"use client";

import { CARD, INPUT, Field, SectionHeader, formatDuration } from "./shared";

export function ScheduleCliff({
  startTime,
  onStartTimeChange,
  cliffTime,
  onCliffTimeChange,
  scheduleError,
}: {
  startTime: string;
  onStartTimeChange: (value: string) => void;
  cliffTime: string;
  onCliffTimeChange: (value: string) => void;
  scheduleError?: string | null;
}) {
  return (
    <div className={`${CARD} space-y-4 p-5`}>
      <SectionHeader title="Schedule" caption="All tokens unlock at the cliff date. Nothing before, everything after." />
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
          label="Unlock Time (Cliff)"
          input={
            <input
              type="datetime-local"
              value={cliffTime}
              onChange={(e) => onCliffTimeChange(e.target.value)}
              className={INPUT}
            />
          }
        />
      </div>
      {startTime && cliffTime ? (
        <p className="text-[12px] text-[#6f7c95]">
          Duration until unlock: {formatDuration(startTime, cliffTime) || "—"}
        </p>
      ) : null}
      {scheduleError ? <p className="text-[12px] text-red-400">{scheduleError}</p> : null}
    </div>
  );
}
