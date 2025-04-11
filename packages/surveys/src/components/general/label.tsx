interface LabelProps {
  text: string;
}

export function Label({ text }: LabelProps) {
  return <label className="text-subheading text-sm font-normal">{text}</label>;
}
