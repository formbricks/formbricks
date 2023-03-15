export type Question = OpenTextQuestion;

export interface OpenTextQuestion {
  id: string;
  type: "openText";
  headline: string;
  subheader?: string;
  placeholder?: string;
  buttonLabel?: string;
  required: boolean;
}
