export interface SubmissionRequest {
  customer?: {
    email: string;
    [name: string]: string | number | string[] | number[] | undefined;
  };
  data: {
    [name: string]: string | number | string[] | number[] | undefined;
  };
}

export interface Submission {
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

export interface Config {
  environmentId: string;
  apiHost: string;
  person?: Person;
  session?: Session;
}

export interface Session {
  id: string;
  expiresAt: number;
}

export interface Person {
  id: string;
  userId?: string;
  email?: string;
  attributes?: any;
}
