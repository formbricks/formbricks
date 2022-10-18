export interface ClassNames {
  label?: string;
  help?: string;
  element?: string;
  radioOption?: string | ((bag: any) => string) | undefined;
  radioGroup?: string;
  elementLabel?: string;
  button?: string;
}

export interface Option {
  label: string;
  value: string;
}
