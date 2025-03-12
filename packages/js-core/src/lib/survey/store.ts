import type { TEnvironmentStateSurvey } from "@/types/config";

type Listener = (state: TEnvironmentStateSurvey | null, prevSurvey: TEnvironmentStateSurvey | null) => void;

export class SurveyStore {
  private static instance: SurveyStore | undefined;
  private survey: TEnvironmentStateSurvey | null = null;
  private listeners = new Set<Listener>();

  static getInstance(): SurveyStore {
    if (!SurveyStore.instance) {
      SurveyStore.instance = new SurveyStore();
    }
    return SurveyStore.instance;
  }

  public getSurvey(): TEnvironmentStateSurvey | null {
    return this.survey;
  }

  public setSurvey(survey: TEnvironmentStateSurvey): void {
    const prevSurvey = this.survey;
    if (prevSurvey?.id !== survey.id) {
      this.survey = survey;
      this.listeners.forEach((listener) => {
        listener(this.survey, prevSurvey);
      });
    }
  }

  public resetSurvey(): void {
    const prevSurvey = this.survey;
    if (prevSurvey !== null) {
      this.survey = null;
      this.listeners.forEach((listener) => {
        listener(this.survey, prevSurvey);
      });
    }
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    // Unsubscribe
    return () => this.listeners.delete(listener);
  }
}
