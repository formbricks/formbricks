import CustomDialog from "@/app/components/shared/CustomDialog";
import { Input } from "@formbricks/ui/Input";
import { Dispatch, SetStateAction, useState } from "react";

interface TransferOwnershipModalProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  memberName: string;
  onSubmit: () => void;
  isLoading?: boolean;
}

export default function TransferOwnershipModal({
  setOpen,
  open,
  memberName,
  onSubmit,
  isLoading,
}: TransferOwnershipModalProps) {
  const [inputValue, setInputValue] = useState("");

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  return (
    <CustomDialog
      open={open}
      setOpen={setOpen}
      onOk={onSubmit}
      okBtnText="Transfer ownership"
      title="There can only be ONE owner! Are you sure?"
      cancelBtnText="CANCEL"
      disabled={inputValue !== memberName}
      isLoading={isLoading}>
      <div className="py-5">
        <ul className="list-disc pb-6 pl-6">
          <li>
            There can only be one owner of each team. If you transfer your ownership to <b>{memberName}</b>,
            you will lose all of your ownership rights.
          </li>
          <li>When you transfer the ownership, you will remain an Admin of the team.</li>
        </ul>
        <form>
          <label htmlFor="transferOwnershipConfirmation">
            Type in <b>{memberName}</b> to confirm:
          </label>
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder={memberName}
            className="mt-5"
            type="text"
            id="transferOwnershipConfirmation"
            name="transferOwnershipConfirmation"
          />
        </form>
      </div>
    </CustomDialog>
  );
}
