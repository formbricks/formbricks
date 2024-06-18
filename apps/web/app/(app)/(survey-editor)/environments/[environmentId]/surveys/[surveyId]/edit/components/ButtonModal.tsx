"use client";

import { isFunction } from "lodash";
import React, { useState } from "react";
import { Button, ButtonProps } from "@formbricks/ui/Button";
import { Modal } from "@formbricks/ui/Modal";

type ChildrenFunction = (props: { isOpen: boolean; setOpen: (v: boolean) => void }) => React.ReactNode;

interface ButtonModalProps {
  button?: ButtonProps;
  children?: React.ReactNode | ChildrenFunction;
}

export const ButtonModal: React.FC<ButtonModalProps> = ({ button, children }) => {
  const [isOpen, setOpen] = useState(false);

  const content = isFunction(children) ? children({ isOpen, setOpen }) : children;
  return (
    <>
      <Button
        {...button}
        onClick={(e) => {
          setOpen(true);
          e.preventDefault();
        }}></Button>

      <Modal open={isOpen} setOpen={setOpen} closeOnOutsideClick={true} restrictOverflow>
        {content}
      </Modal>
    </>
  );
};
