import React from "react";
import { Button } from "./Button";

interface BackButtonProps {
  onClick?: (event: React.MouseEvent<HTMLElement, MouseEvent>) => void;
}

export const BackButton: React.FC<BackButtonProps> = ({ onClick }: BackButtonProps) => (
  <Button
    type="button"
    variant="minimal"
    className="mr-auto px-3 py-3 text-base font-medium leading-4 focus:ring-offset-2"
    onClick={onClick}>
    Back
  </Button>
);
