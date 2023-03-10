import { JSXElementConstructor, ReactElement, ReactFragment } from "react";
import { User } from "next-auth";
import { Form as PrismaForm } from "@prisma/client";

export type Form = {
  id: string;
  title: string;
  finishedOnboarding: boolean;
  published: boolean;
  colorPrimary: string;
  owner: string;
  elements: [Element];
  elementsDraft: [Element];
  createdAt: Date;
  updatedAt: Date;
};

export type Page = {
  id: string;
  blocks: PageBlock[];
};

export type PageBlock = {
  id: string;
  type: string;
  level?: number;
  data: PageBlockData;
};

export type PageBlockData = {
  caption: string;
  file: any;
  text:
    | string
    | number
    | boolean
    | ReactElement<any, string | JSXElementConstructor<any>>
    | ReactFragment;

  level: number;
  label: string;
  help: string;
  placeholder: string;
  required: boolean;
  multipleChoice: any;
  options: any[];
  submitLabel: string;
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

export type pageSubmissionEvent = {
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

export type submissionCompletedEvent = {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: "submissionCompleted";
  data: { [key: string]: string };
};
export type openFormEvent = {
  id?: string;
  type: "formOpened";
  createdAt?: Date;
  updatedAt?: Date;
  data: {
    form: PrismaForm;
    user: User;
    roll: number;
  };
};

export type updateSchemaEvent = {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: "updateSchema";
  data: Schema;
};

export type ApiEvent =
  | pageSubmissionEvent
  | submissionCompletedEvent
  | updateSchemaEvent
  | openFormEvent;

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

export type FormWhereClause = {
  noCodeForm?: any;
  dueDate?: any;
};

type SubmissionPage = {
  name: string;
  type: string;
  elements: SubmissionPageElement[];
};

type SubmissionPageElement = SchemaElement & { value: string };
