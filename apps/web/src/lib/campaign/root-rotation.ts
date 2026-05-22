import {
  createRootVersionRequestSchema,
  type CreateRootVersionRequest,
} from "@/lib/api/validators";

export type RootRotationParseResult =
  | { ok: true; payload: CreateRootVersionRequest }
  | { ok: false; error: string };

export function parsePreparedRootRotationPayload(
  input: string,
): RootRotationParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Prepared root payload is required." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(trimmed);
  } catch {
    return {
      ok: false,
      error: "Payload must be valid JSON exported from the Merkle prepare flow.",
    };
  }

  const parsed = createRootVersionRequestSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid prepared root payload.";
    return { ok: false, error: message };
  }

  return { ok: true, payload: parsed.data };
}

export function formatRootRotationPreview(
  payload: CreateRootVersionRequest,
): Array<{ label: string; value: string }> {
  return [
    { label: "New Root", value: payload.merkleRoot },
    { label: "Leaf Count", value: String(payload.leafCount) },
    { label: "Leaves In Payload", value: String(payload.leaves.length) },
    { label: "IPFS CID", value: payload.ipfsCid ?? "None" },
  ];
}
