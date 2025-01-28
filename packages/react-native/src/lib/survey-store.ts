import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";

type Listener = (
  state: TJsEnvironmentStateSurvey | null,
  prevSurvey: TJsEnvironmentStateSurvey | null
) => void;

export class SurveyStore {
  private static instance: SurveyStore | undefined;
  private survey: TJsEnvironmentStateSurvey | null = null;
  private listeners = new Set<Listener>();

  static getInstance(): SurveyStore {
    if (!SurveyStore.instance) {
      SurveyStore.instance = new SurveyStore();
    }
    return SurveyStore.instance;
  }

  public getSurvey(): TJsEnvironmentStateSurvey | null {
    return this.survey;
  }

  public setSurvey(survey: TJsEnvironmentStateSurvey): void {
    const prevSurvey = this.survey;
    if (prevSurvey !== survey) {
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
