export interface Template {
  name: string;
  icon: any;
  description: string;
  preset: {
    name: string;
    questions: any[];
    audience: any;
  };
}
