export type Form = {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  finishedOnboarding: boolean;
  published: boolean;
  colorPrimary: string;
  owner: string;
  elements: [Element];
  elementsDraft: [Element];
};

export type AnswerSession = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  answers: Answer[];
};

export type Answer = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  elementId: string;
  data: AnswerData;
};

export type AnswerData = {
  value: string | string[];
};

export type Schema = {
  pages: SchemaPage[];
};

export type SchemaPage = {
  type: "form" | "thankyou";
  name: string;
  elements: SchemaElement[];
};

export type SchemaElement = {
  name: string;
  type: "checkbox" | "radio" | "text" | "textarea" | "submit";
  label?: string;
  options?: SchemaOption[];
};

export type SchemaOption = {
  label: string;
  value: string;
};

export type pageSubmissionData = {
  type: "pageSubmission";
  data: {
    submissionSessionId: string;
    pageName: string;
    submission: { [key: string]: string };
  };
};

export type submissionCompletedEvent = {
  type: "submissionCompleted";
  data: { [key: string]: string };
};

export type updateSchemaEvent = { type: "updateSchema"; data: Schema };

export type ApiEvent =
  | pageSubmissionData
  | submissionCompletedEvent
  | updateSchemaEvent;

export type WebhookEvent = Event & { formId: string; timestamp: string };
