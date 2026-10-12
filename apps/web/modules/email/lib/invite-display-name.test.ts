import { describe, expect, test } from "vitest";
import { MAX_INVITE_DISPLAY_NAME_LENGTH, toInviteDisplayName } from "./invite-display-name";

const RIGHT_TO_LEFT_OVERRIDE = String.fromCodePoint(0x202e);
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);
const WORD_JOINER = String.fromCodePoint(0x2060);

describe("toInviteDisplayName", () => {
  test("keeps an ordinary name, including non-latin scripts, unchanged", () => {
    expect(toInviteDisplayName("Anna Müller", "Anonymous")).toBe("Anna Müller");
    expect(toInviteDisplayName("宋十八", "Anonymous")).toBe("宋十八");
  });

  test("removes links and email addresses", () => {
    expect(toInviteDisplayName("Win big https://spam.example/claim now", "Anonymous")).toBe("Win big now");
    expect(toInviteDisplayName("Visit www.spam.example today", "Anonymous")).toBe("Visit today");
    expect(toInviteDisplayName("Anna anna@spam.example", "Anonymous")).toBe("Anna");
  });

  test("removes links that hide an invisible character inside the scheme or host", () => {
    expect(toInviteDisplayName(`Win https:${WORD_JOINER}//spam.example now`, "Anonymous")).toBe("Win now");
    expect(toInviteDisplayName(`Visit www${WORD_JOINER}.spam.example today`, "Anonymous")).toBe(
      "Visit today"
    );
  });

  test("removes control and bidirectional override characters and collapses whitespace", () => {
    const name = `Anna${RIGHT_TO_LEFT_OVERRIDE}gnirps\n\tMüller${ZERO_WIDTH_SPACE}`;

    expect(toInviteDisplayName(name, "Anonymous")).toBe("Anna gnirps Müller");
  });

  test("falls back when nothing printable is left", () => {
    expect(toInviteDisplayName("https://spam.example", "Anonymous")).toBe("Anonymous");
    expect(toInviteDisplayName(`  ${RIGHT_TO_LEFT_OVERRIDE}  `, "Anonymous")).toBe("Anonymous");
    expect(toInviteDisplayName("", "")).toBe("");
  });

  test("caps the length by characters, not UTF-16 units", () => {
    const longName = "宋".repeat(MAX_INVITE_DISPLAY_NAME_LENGTH + 20);

    const result = toInviteDisplayName(longName, "Anonymous");

    expect(Array.from(result)).toHaveLength(MAX_INVITE_DISPLAY_NAME_LENGTH);
    expect(result.endsWith("…")).toBe(true);
  });

  test("handles very long names without separators in linear time", () => {
    const longRun = "a".repeat(200_000);

    expect(toInviteDisplayName(`${longRun}@${longRun}.com`, "Anonymous")).toBe("Anonymous");
    expect(Array.from(toInviteDisplayName(`${longRun}@${longRun}`, "Anonymous"))).toHaveLength(
      MAX_INVITE_DISPLAY_NAME_LENGTH
    );
  });

  test("does not touch a name exactly at the limit", () => {
    const name = "a".repeat(MAX_INVITE_DISPLAY_NAME_LENGTH);

    expect(toInviteDisplayName(name, "Anonymous")).toBe(name);
  });
});
