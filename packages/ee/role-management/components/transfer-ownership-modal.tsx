"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { CustomDialog } from "@formbricks/ui/CustomDialog";
import { Input } from "@formbricks/ui/Input";

interface TransferOwnershipModalProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  memberName: string;
  onSubmit: () => void;
  isLoading?: boolean;
}

export function TransferOwnershipModal({
  setOpen,
  open,
  memberName,
  onSubmit,
  isLoading,
}: TransferOwnershipModalProps) {
  const [inputValue, setInputValue] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <CustomDialog
      cancelBtnText="CANCEL"
      disabled={inputValue !== memberName}
      isLoading={isLoading}
      okBtnText="Transfer ownership"
      onOk={onSubmit}
      open={open}
      setOpen={setOpen}
      title="There can only be ONE owner! Are you sure?">
      <div className="py-5">
        <ul className="list-disc pb-6 pl-6">
          <li>
            There can only be one owner of each organization. If you transfer your ownership to{" "}
            <b>{memberName}</b>, you will lose all of your ownership rights.
          </li>
          <li>When you transfer the ownership, you will remain an Admin of the organization.</li>
        </ul>
        <form>
          <label htmlFor="transferOwnershipConfirmation">
            Type in <b>{memberName}</b> to confirm:
          </label>
          <Input
            className="mt-5"
            id="transferOwnershipConfirmation"
            name="transferOwnershipConfirmation"
            onChange={handleInputChange}
            placeholder={memberName}
            type="text"
            value={inputValue}
          />
        </form>
      </div>
    </CustomDialog>
  );
}
