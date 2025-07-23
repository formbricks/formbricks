import { beforeEach, describe, expect, test, vi } from "vitest";
import { SurveyStore } from "@/lib/survey/store";
import { mockSurveyId, mockSurveyName } from "@/lib/survey/tests/__mocks__/store.mock";
import type { TEnvironmentStateSurvey } from "@/types/config";

describe("SurveyStore", () => {
  let store: SurveyStore;

  beforeEach(() => {
    // Reset the singleton instance before each test
    // @ts-expect-error accessing private static property
    SurveyStore.instance = undefined;
    store = SurveyStore.getInstance();
  });

  describe("getInstance", () => {
    test("returns singleton instance", () => {
      const instance1 = SurveyStore.getInstance();
      const instance2 = SurveyStore.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("getSurvey", () => {
    test("returns null when no survey is set", () => {
      expect(store.getSurvey()).toBeNull();
    });

    test("returns current survey when set", () => {
      const mockSurvey: TEnvironmentStateSurvey = {
        id: mockSurveyId,
        name: mockSurveyName,
      } as TEnvironmentStateSurvey;

      store.setSurvey(mockSurvey);
      expect(store.getSurvey()).toBe(mockSurvey);
    });
  });

  describe("setSurvey", () => {
    test("updates survey and notifies listeners when survey changes", () => {
      const listener = vi.fn();
      const mockSurvey: TEnvironmentStateSurvey = {
        id: mockSurveyId,
        name: mockSurveyName,
      } as TEnvironmentStateSurvey;

      store.subscribe(listener);
      store.setSurvey(mockSurvey);

      expect(listener).toHaveBeenCalledWith(mockSurvey, null);
      expect(store.getSurvey()).toBe(mockSurvey);
    });

    test("does not notify listeners when setting same survey", () => {
      const listener = vi.fn();
      const mockSurvey: TEnvironmentStateSurvey = {
        id: mockSurveyId,
        name: mockSurveyName,
      } as TEnvironmentStateSurvey;

      store.setSurvey(mockSurvey);
      store.subscribe(listener);
      store.setSurvey(mockSurvey);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("resetSurvey", () => {
    test("resets survey to null and notifies listeners", () => {
      const listener = vi.fn();
      const mockSurvey: TEnvironmentStateSurvey = {
        id: mockSurveyId,
        name: mockSurveyName,
      } as TEnvironmentStateSurvey;

      store.setSurvey(mockSurvey);
      store.subscribe(listener);
      store.resetSurvey();

      expect(listener).toHaveBeenCalledWith(null, mockSurvey);
      expect(store.getSurvey()).toBeNull();
    });

    test("does not notify listeners when already null", () => {
      const listener = vi.fn();
      store.subscribe(listener);
      store.resetSurvey();

      expect(listener).not.toHaveBeenCalled();
      expect(store.getSurvey()).toBeNull();
    });
  });

  describe("subscribe", () => {
    test("adds listener and returns unsubscribe function", () => {
      const listener = vi.fn();
      const mockSurvey: TEnvironmentStateSurvey = {
        id: mockSurveyId,
        name: mockSurveyName,
      } as TEnvironmentStateSurvey;

      const unsubscribe = store.subscribe(listener);
      store.setSurvey(mockSurvey);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      store.setSurvey({ ...mockSurvey, name: "Updated Survey" } as TEnvironmentStateSurvey);
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called after unsubscribe
    });

    test("multiple listeners receive updates", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const mockSurvey: TEnvironmentStateSurvey = {
        id: mockSurveyId,
        name: mockSurveyName,
      } as TEnvironmentStateSurvey;

      store.subscribe(listener1);
      store.subscribe(listener2);
      store.setSurvey(mockSurvey);

      expect(listener1).toHaveBeenCalledWith(mockSurvey, null);
      expect(listener2).toHaveBeenCalledWith(mockSurvey, null);
    });
  });
});
