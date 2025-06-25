interface LabelProps {
  text: string;
  htmlForId?: string;
}

export function Label({ text, htmlForId }: Readonly<LabelProps>) {
  return (
    <label htmlFor={htmlForId} className="fb-text-subheading fb-font-normal fb-text-sm fb-block" dir="auto">
      {text}
    </label>
  );
}
