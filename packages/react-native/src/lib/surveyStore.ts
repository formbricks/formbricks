import { TSurvey } from "@formbricks/types/surveys";

type Listener = (state: TSurvey | null, prevSurvey: TSurvey | null) => void;

export class SurveyStore {
  private static instance: SurveyStore | undefined;
  private survey: TSurvey | null = null;
  private listeners: Set<Listener> = new Set();

  constructor() {}

  static getInstance(): SurveyStore {
    if (!SurveyStore.instance) {
      SurveyStore.instance = new SurveyStore();
    }
    return SurveyStore.instance;
  }

  public getSurvey() {
    return this.survey;
  }

  public setSurvey(survey: TSurvey) {
    const prevSurvey = this.survey;
    if (prevSurvey !== survey) {
      this.survey = survey;
      this.listeners.forEach((listener) => listener(this.survey, prevSurvey));
    }
  }

  public resetSurvey() {
    const prevSurvey = this.survey;
    if (prevSurvey !== null) {
      this.survey = null;
      this.listeners.forEach((listener) => listener(this.survey, prevSurvey));
    }
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    // Unsubscribe
    return () => this.listeners.delete(listener);
  }
}
