import { describe, it, expect } from "vitest";
import {
  assertTransition,
  canTransition,
  isTerminalStatus,
  nextStatusAfterSignature,
} from "./transitions.js";

describe("payment request state machine", () => {
  it("allows DRAFT → AWAITING_SIGNATURES", () => {
    expect(canTransition("DRAFT", "AWAITING_SIGNATURES")).toBe(true);
  });

  it("rejects editing after signatures started", () => {
    expect(canTransition("PARTIALLY_SIGNED", "DRAFT")).toBe(false);
    expect(canTransition("AWAITING_SIGNATURES", "DRAFT")).toBe(false);
  });

  it("assertTransition throws on invalid transition", () => {
    expect(() => assertTransition("CONFIRMED", "BROADCASTING")).toThrow(
      /Invalid status transition/,
    );
  });

  it("marks terminal statuses", () => {
    expect(isTerminalStatus("CONFIRMED")).toBe(true);
    expect(isTerminalStatus("AWAITING_SIGNATURES")).toBe(false);
  });

  it("moves to PARTIALLY_SIGNED when weight insufficient", () => {
    expect(nextStatusAfterSignature("AWAITING_SIGNATURES", false)).toBe(
      "PARTIALLY_SIGNED",
    );
  });

  it("moves to READY_TO_BROADCAST when weight sufficient", () => {
    expect(nextStatusAfterSignature("PARTIALLY_SIGNED", true)).toBe(
      "READY_TO_BROADCAST",
    );
  });

  it("allows broadcast flow transitions", () => {
    expect(canTransition("READY_TO_BROADCAST", "BROADCASTING")).toBe(true);
    expect(canTransition("BROADCASTING", "BROADCASTED")).toBe(true);
    expect(canTransition("BROADCASTED", "CONFIRMED")).toBe(true);
  });

  it("allows expiration from signing states", () => {
    expect(canTransition("AWAITING_SIGNATURES", "EXPIRED")).toBe(true);
    expect(canTransition("READY_TO_BROADCAST", "EXPIRED")).toBe(true);
  });
});
