import { useState } from "preact/hooks";

interface ToolTipProps {
  children: React.ReactNode;
  text: string;
}

export const Tooltip = ({ children, text }: ToolTipProps) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}>
      {children}
      {showTooltip && (
        <div className="absolute bottom-full z-10 mb-2 rounded-md bg-black px-3 py-2 text-xs text-white">
          {text}
        </div>
      )}
    </div>
  );
};
