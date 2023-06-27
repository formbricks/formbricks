import { Question } from "./questions";
import { ThankYouCard } from "./surveys";

export interface ResponseCreateRequest {
  surveyId: string;
  personId?: string;
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
  personId?: string;
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
  errorHandler?: ErrorHandler;
}

//TODO: add type to error
export type ErrorHandler = (error: any) => void;

export interface Settings {
  surveys?: Survey[];
  noCodeEvents?: any[];
  brandColor?: string;
  formbricksSignature?: boolean;
  placement?: PlacementType;
  clickOutsideClose?: boolean;
  darkOverlay?: boolean;
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
  autoClose?: number | null;
  delay: number;
}

export interface Trigger {
  id: string;
  eventClass: {
    id: string;
    name: string;
  };
}

export type MatchType = "exactMatch" | "contains" | "startsWith" | "endsWith" | "notMatch" | "notContains";
export type PlacementType = "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center";
