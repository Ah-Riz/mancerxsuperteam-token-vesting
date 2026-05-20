// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { TriggerMilestoneButton } from "@/components/campaign/TriggerMilestoneButton";

function renderButton(overrides = {}) {
  const props = {
    isCreator: true,
    isMilestoneType: true,
    alreadyTriggered: false,
    milestoneIdx: 0,
    ...overrides,
  };
  return render(createElement(TriggerMilestoneButton, props));
}

describe("TriggerMilestoneButton", () => {
  afterEach(() => cleanup());

  it("renders nothing when not creator", () => {
    const { container } = renderButton({ isCreator: false });
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when not milestone type", () => {
    const { container } = renderButton({ isMilestoneType: false });
    expect(container.innerHTML).toBe("");
  });

  it("shows triggered state when already triggered", () => {
    renderButton({ alreadyTriggered: true });
    expect(screen.getByText(/triggered/i)).toBeTruthy();
  });

  it("shows coming soon when feature flag disabled", () => {
    renderButton();
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
  });

  it("includes milestone index in triggered message", () => {
    renderButton({ alreadyTriggered: true, milestoneIdx: 5 });
    expect(screen.getByText(/Milestone #5 triggered/)).toBeTruthy();
  });
});
