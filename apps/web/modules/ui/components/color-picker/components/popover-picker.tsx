import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HexColorPicker } from "react-colorful";

interface PopoverPickerProps {
  color: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export const PopoverPicker = ({ color, onChange, disabled = false }: PopoverPickerProps) => {
  const popover = useRef(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, toggle] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const close = useCallback(() => toggle(false), []);
  useClickOutside(popover, close);

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 240,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const handleScroll = () => updatePosition();
      const handleResize = () => updatePosition();

      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [isOpen, updatePosition]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!disabled) {
      if (!isOpen) {
        updatePosition();
      }
      toggle(!isOpen);
    }
  };

  return (
    <div className="picker relative">
      <button
        ref={buttonRef}
        id="color-picker"
        className="h-6 w-10 cursor-pointer rounded border border-slate-200"
        style={{ backgroundColor: color, opacity: disabled ? 0.5 : 1 }}
        onClick={handleClick}
      />

      {isOpen &&
        createPortal(
          <div
            className="fixed z-50 origin-top-right"
            style={{ top: position.top, left: position.left }}
            ref={popover}>
            <div className="rounded bg-white p-2 shadow-lg">
              <HexColorPicker color={color} onChange={onChange} />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
