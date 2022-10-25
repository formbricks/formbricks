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

export type SnoopType =
  | "checkbox"
  | "email"
  | "number"
  | "phone"
  | "radio"
  | "submit"
  | "text"
  | "textarea"
  | "website";

export type SchemaElement = {
  name: string;
  type: SnoopType;
  label?: string;
  options?: SchemaOption[];
};

export type SchemaOption = {
  label: string;
  value: string;
};

export type SubmissionSummary = {
  pages: SubmissionSummaryPage[];
};

export type SubmissionSummaryPage = {
  type: "form" | "thankyou";
  name: string;
  elements: SubmissionSummaryElement[];
};

export type SubmissionSummaryElement = {
  name: string;
  type: SnoopType;
  label?: string;
  summary?: string[];
  options?: SubmissionSummaryOption[];
};

export type SubmissionSummaryOption = {
  label: string;
  value: string;
  summary: number;
};

export type submissionEvent = {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: "pageSubmission";
  data: {
    submissionSessionId: string;
    pageName: string;
    submission: { [key: string]: string };
  };
};

export type formCompletedEvent = {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: "formCompleted";
  data: {
    submissionSessionId: string;
  };
};

export type updateSchemaEvent = {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: "updateSchema";
  data: Schema;
};

export type ApiEvent = submissionEvent | formCompletedEvent | updateSchemaEvent;

export type WebhookEvent = Event & { formId: string; timestamp: string };

export type SubmissionSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  form?: any;
  userFingerprint: string;
  events: ApiEvent[];
};

export type Submission = {
  id?: string;
  createdAt?: string;
  pages?: SubmissionPage[];
};

type SubmissionPage = {
  name: string;
  type: string;
  elements: SubmissionPageElement[];
};

type SubmissionPageElement = SchemaElement & { value: string };
