"use client";

import { useTranslations } from "next-intl";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { CustomDialog } from "@formbricks/ui/components/CustomDialog";
import { Input } from "@formbricks/ui/components/Input";

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
  const t = useTranslations();
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
            {t("ee.role_management.there_can_only_be_one_owner_of_each_organization")}
            <b>{memberName}</b>, {t("ee.role_management.you_will_lose_all_of_your_ownership_rights")}
          </li>
          <li>
            {t(
              "ee.role_management.when_you_transfer_the_ownership_you_will_remain_an_admin_of_the_organization"
            )}
          </li>
        </ul>
        <form>
          <label htmlFor="transferOwnershipConfirmation">
            {t("ee.role_management.type_in")} <b>{memberName}</b> {t("ee.role_management.to_confirm")}:
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
