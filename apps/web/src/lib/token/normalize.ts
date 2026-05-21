export type WalletTokenOption = {
  mintAddress: string;
  balanceRaw: string;
  decimals: number | null;
  uiAmount: string;
};

type ParsedTokenAmount = {
  amount?: string;
  decimals?: number;
};

type ParsedTokenAccountInfo = {
  mint?: string;
  tokenAmount?: ParsedTokenAmount;
};

type ParsedTokenAccount = {
  account?: {
    data?: {
      parsed?: {
        info?: ParsedTokenAccountInfo;
      };
    };
  };
};

function parseRawAmount(rawAmount: string | undefined) {
  if (!rawAmount) return 0n;

  try {
    return BigInt(rawAmount);
  } catch {
    return 0n;
  }
}

function formatUiAmount(balanceRaw: string, decimals: number | null) {
  if (decimals === null) return balanceRaw;

  const amount = parseRawAmount(balanceRaw);
  if (decimals === 0) return amount.toString();

  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");

  return fractionText ? `${whole.toString()}.${fractionText}` : whole.toString();
}

export function normalizeWalletTokens(accounts: ParsedTokenAccount[]): WalletTokenOption[] {
  const deduped = new Map<string, { balanceRaw: bigint; decimals: number | null }>();

  for (const account of accounts) {
    const info = account.account?.data?.parsed?.info;
    const mintAddress = info?.mint;
    if (!mintAddress) continue;

    const nextAmount = parseRawAmount(info.tokenAmount?.amount);
    const nextDecimals = typeof info.tokenAmount?.decimals === "number" ? info.tokenAmount.decimals : null;
    const current = deduped.get(mintAddress);

    if (!current) {
      deduped.set(mintAddress, { balanceRaw: nextAmount, decimals: nextDecimals });
      continue;
    }

    deduped.set(mintAddress, {
      balanceRaw: current.balanceRaw + nextAmount,
      decimals: current.decimals ?? nextDecimals,
    });
  }

  return Array.from(deduped.entries())
    .map(([mintAddress, value]) => {
      const balanceRaw = value.balanceRaw.toString();

      return {
        mintAddress,
        balanceRaw,
        decimals: value.decimals,
        uiAmount: formatUiAmount(balanceRaw, value.decimals),
      };
    })
    .sort((left, right) => {
      const leftBalance = parseRawAmount(left.balanceRaw);
      const rightBalance = parseRawAmount(right.balanceRaw);
      const leftHasBalance = leftBalance > 0n;
      const rightHasBalance = rightBalance > 0n;

      if (leftHasBalance !== rightHasBalance) {
        return leftHasBalance ? -1 : 1;
      }

      if (leftBalance !== rightBalance) {
        return leftBalance > rightBalance ? -1 : 1;
      }

      return left.mintAddress.localeCompare(right.mintAddress);
    });
}
