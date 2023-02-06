export interface FormOption {
  label: string;
  value: string;
  frontend?: any;
}

export interface FormPage {
  id: string;
  endScreen?: boolean;
  elements: FormElement[];
  config?: {
    addFieldsToCustomer?: string[];
    autoSubmit?: boolean;
    allowSkip?: boolean;
  };
  branchingRules?: {
    type: "value";
    name: string;
    value: string;
    nextPageId: string;
  }[];
}

export interface FormElement {
  id: string;
  name?: string;
  label?: string;
  help?: string;
  type: "radio" | "text" | "checkbox" | "html";
  options?: FormOption[];
  component: React.FC<any>;
  frontend?: any;
}

export interface Form {
  pages: FormPage[];
  config?: {
    progressBar?: boolean;
  };
}
