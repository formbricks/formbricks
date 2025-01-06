import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface BaseInputProps {
  id: string;
  value: string;
  label?: string;
  placeholder?: string;
  isInvalid?: boolean;
  className?: string;
  maxLength?: number;
  onChange: (value: string, triggerRecall?: boolean) => void; // Modified to include recall trigger
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

export const BaseInput = ({ id, value, onChange, label, className = "", ...props }: BaseInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const lastChar = newValue.slice(-1);

    // Trigger recall if the last character typed was @
    onChange(newValue, lastChar === "@");
  };

  return (
    <div className="w-full">
      {label && (
        <div className="mb-2 mt-3">
          <Label htmlFor={id}>{label}</Label>
        </div>
      )}
      <Input id={id} value={value} onChange={handleChange} className={className} {...props} />
    </div>
  );
};
