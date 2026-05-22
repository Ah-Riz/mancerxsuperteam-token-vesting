import { describe, it, expect } from "vitest";
import { isMilestoneTriggered } from "@/lib/vesting/milestone";

describe("isMilestoneTriggered", () => {
  it("returns false for all-zeros bitmap", () => {
    const bitmap = new Uint8Array(32);
    expect(isMilestoneTriggered(bitmap, 0)).toBe(false);
    expect(isMilestoneTriggered(bitmap, 7)).toBe(false);
    expect(isMilestoneTriggered(bitmap, 255)).toBe(false);
  });

  it("detects bit 0 set", () => {
    const bitmap = new Uint8Array(32);
    bitmap[0] = 0b00000001;
    expect(isMilestoneTriggered(bitmap, 0)).toBe(true);
    expect(isMilestoneTriggered(bitmap, 1)).toBe(false);
  });

  it("detects bit 7 set", () => {
    const bitmap = new Uint8Array(32);
    bitmap[0] = 0b10000000;
    expect(isMilestoneTriggered(bitmap, 7)).toBe(true);
    expect(isMilestoneTriggered(bitmap, 6)).toBe(false);
  });

  it("detects bit 8 set (second byte)", () => {
    const bitmap = new Uint8Array(32);
    bitmap[1] = 0b00000001;
    expect(isMilestoneTriggered(bitmap, 8)).toBe(true);
    expect(isMilestoneTriggered(bitmap, 0)).toBe(false);
  });

  it("detects bit 255 set (last bit)", () => {
    const bitmap = new Uint8Array(32);
    bitmap[31] = 0b10000000;
    expect(isMilestoneTriggered(bitmap, 255)).toBe(true);
    expect(isMilestoneTriggered(bitmap, 254)).toBe(false);
  });

  it("handles multiple bits set", () => {
    const bitmap = new Uint8Array(32);
    bitmap[0] = 0b00001010; // bits 1 and 3
    expect(isMilestoneTriggered(bitmap, 0)).toBe(false);
    expect(isMilestoneTriggered(bitmap, 1)).toBe(true);
    expect(isMilestoneTriggered(bitmap, 2)).toBe(false);
    expect(isMilestoneTriggered(bitmap, 3)).toBe(true);
  });

  it("returns false for negative index", () => {
    const bitmap = new Uint8Array(32);
    bitmap[0] = 0xff;
    expect(isMilestoneTriggered(bitmap, -1)).toBe(false);
  });

  it("returns false for index > 255", () => {
    const bitmap = new Uint8Array(32);
    bitmap[0] = 0xff;
    expect(isMilestoneTriggered(bitmap, 256)).toBe(false);
  });
});
