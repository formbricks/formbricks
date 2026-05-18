import type { TWorkspaceStateSurvey } from "@/types/config";

type Listener = (state: TWorkspaceStateSurvey | null, prevSurvey: TWorkspaceStateSurvey | null) => void;

export class SurveyStore {
  private static instance: SurveyStore | undefined;
  private survey: TWorkspaceStateSurvey | null = null;
  private listeners = new Set<Listener>();

  static getInstance(): SurveyStore {
    if (!SurveyStore.instance) {
      SurveyStore.instance = new SurveyStore();
    }
    return SurveyStore.instance;
  }

  public getSurvey(): TWorkspaceStateSurvey | null {
    return this.survey;
  }

  public setSurvey(survey: TWorkspaceStateSurvey): void {
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
