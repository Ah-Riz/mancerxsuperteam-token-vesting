"use client";

type Props = {
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
  isLoading: boolean;
  totalSupply: bigint;
  totalClaimed: bigint;
  vestedAmount: bigint;
};

export function CancelConfirmDialog({
  isOpen,
  onConfirm,
  onClose,
  isLoading,
  totalSupply,
  totalClaimed,
  vestedAmount,
}: Props) {
  if (!isOpen) return null;

  const unclaimedVested = vestedAmount > totalClaimed ? vestedAmount - totalClaimed : 0n;
  const returnedToCreator = totalSupply > vestedAmount ? totalSupply - vestedAmount : 0n;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 space-y-5">
        <h3 className="text-lg font-semibold text-red-400">
          Are you sure you want to cancel this stream?
        </h3>

        <p className="text-sm text-gray-400">
          This action is irreversible. Tokens will be distributed as follows:
        </p>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Already claimed by recipient</span>
            <span className="font-medium">{totalClaimed.toString()} tokens</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Unclaimed vested (to recipient)</span>
            <span className="font-medium text-green-400">~{unclaimedVested.toString()} tokens</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Returned to creator</span>
            <span className="font-medium text-amber-400">~{returnedToCreator.toString()} tokens</span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition disabled:opacity-50"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
          >
            {isLoading ? "Cancelling..." : "Cancel Stream"}
          </button>
        </div>
      </div>
    </div>
  );
}
