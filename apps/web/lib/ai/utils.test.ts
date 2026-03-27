import { describe, expect, test } from "vitest";
import { getDisplayedOrganizationAISettingValue, getOrganizationAIEnablementState } from "./utils";

describe("getOrganizationAIEnablementState", () => {
  test("blocks enabling when instance AI is not configured", () => {
    expect(
      getOrganizationAIEnablementState({
        isInstanceConfigured: false,
      })
    ).toMatchObject({
      canEnableFeatures: false,
      blockReason: "instanceNotConfigured",
    });
  });

  test("allows enabling when instance AI is configured", () => {
    expect(
      getOrganizationAIEnablementState({
        isInstanceConfigured: true,
      })
    ).toMatchObject({
      canEnableFeatures: true,
    });
  });
});

describe("getDisplayedOrganizationAISettingValue", () => {
  test("renders enabled settings as off when instance AI is not configured", () => {
    expect(
      getDisplayedOrganizationAISettingValue({
        currentValue: true,
        isInstanceConfigured: false,
      })
    ).toBe(false);
  });

  test("renders the stored setting value when instance AI is configured", () => {
    expect(
      getDisplayedOrganizationAISettingValue({
        currentValue: true,
        isInstanceConfigured: true,
      })
    ).toBe(true);
  });

  test("renders false when the stored setting is false and instance AI is configured", () => {
    expect(
      getDisplayedOrganizationAISettingValue({
        currentValue: false,
        isInstanceConfigured: true,
      })
    ).toBe(false);
  });
});
