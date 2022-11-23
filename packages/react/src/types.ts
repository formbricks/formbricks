export type SVGComponent = React.FunctionComponent<React.SVGProps<SVGSVGElement>>;

export interface UniversalInputProps {
  id?: string;
  help?: string;
  name?: string;
  label?: string;
  validation?: string;
  labelClassName?: string;
  outerClassName?: string;
  wrapperClassName?: string;
  innerClassName?: string;
  inputClassName?: string;
  helpClassName?: string;
  messagesClassName?: string;
  messageClassName?: string;
}

export interface NameRequired {
  name: string;
}

export type OptionsArray = string[];

export interface OptionsObject {
  label: string;
  value: string;
  config?: {
    validation?: string;
    disabled?: boolean;
  };
}

export type OptionsObjectArray = OptionsObject[];
