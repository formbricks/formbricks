export interface ResponseCreateRequest {
  surveyId: string;
  personId: string;
  response: {
    finished?: boolean;
    data: {
      [name: string]: string | number | string[] | number[] | undefined;
    };
  };
}

export interface ResponseUpdateRequest {
  response: {
    finished?: boolean;
    data: {
      [name: string]: string | number | string[] | number[] | undefined;
    };
  };
}

export interface DisplayCreateRequest {
  surveyId: string;
  personId: string;
}

export interface Response {
  id: string;
  createdAt: string;
  updatedAt: string;
  organisationId: string;
  formId: string;
  customerId: string;
  data: {
    [name: string]: string | number | string[] | number[] | undefined;
  };
}

export interface InitConfig {
  environmentId: string;
  apiHost: string;
  logLevel?: "debug" | "error";
}

export interface Settings {
  surveys?: Survey[];
  noCodeEvents?: any[];
  brandColor?: string;
}

export interface JsConfig {
  environmentId: string;
  apiHost: string;
  person?: Person;
  session?: Session;
  settings?: Settings;
}

export interface Session {
  id: string;
  expiresAt?: number;
}

export interface Person {
  id: string;
  attributes?: any;
  environmentId: string;
}

export interface Survey {
  id: string;
  questions: Question[];
  triggers: Trigger[];
  thankYouCard: ThankYouCard;
}

export interface ThankYouCard {
  enabled: boolean;
  headline?: string;
  subheader?: string;
}

export type Question = OpenTextQuestion | MultipleChoiceSingleQuestion;

export interface OpenTextQuestion {
  id: string;
  type: "openText";
  headline: string;
  subheader?: string;
  placeholder?: string;
  buttonLabel?: string;
  required: boolean;
}

export interface MultipleChoiceSingleQuestion {
  id: string;
  type: "multipleChoiceSingle";
  headline: string;
  subheader?: string;
  required: boolean;
  buttonLabel?: string;
  choices?: Choice[];
}

export interface Choice {
  id: string;
  label: string;
}

export interface Trigger {
  id: string;
  eventClass: {
    id: string;
    name: string;
  };
}

export type MatchType = "exactMatch" | "contains" | "startsWith" | "endsWith" | "notMatch" | "notContains";
