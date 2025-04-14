interface LabelProps {
  text: string;
}

export function Label({ text }: Readonly<LabelProps>) {
  return <label className="fb:text-subheading fb:font-normal fb:text-sm">{text}</label>;
}
