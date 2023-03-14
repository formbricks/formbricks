export type Question = OpenTextQuestion;

export interface OpenTextQuestion {
  id: string;
  type: string;
  title: string;
  description: string;
  required: boolean;
}
