"use client";

type Props = {
  isCreator: boolean;
  isMilestoneType: boolean;
  alreadyTriggered: boolean;
  milestoneIdx: number;
  onTrigger?: () => void;
  isLoading?: boolean;
};

export function TriggerMilestoneButton({
  isCreator,
  isMilestoneType,
  alreadyTriggered,
  milestoneIdx,
  onTrigger,
  isLoading,
}: Props) {
  if (!isCreator || !isMilestoneType) return null;

  if (alreadyTriggered) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-900/30 border border-green-700 rounded-lg text-sm text-green-400">
        <span>Milestone #{milestoneIdx} triggered</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onTrigger}
      disabled={isLoading || true}
      className="w-full py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
    >
      {isLoading ? "Triggering..." : "Trigger Milestone (coming soon)"}
    </button>
  );
}
