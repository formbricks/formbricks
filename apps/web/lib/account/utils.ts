import { TAccountInput, ZAccountInput } from "@formbricks/types/account";

export const filterAccountInputData = (account: any) => {
  const supportedProps = Object.keys(ZAccountInput.shape);
  return supportedProps.reduce((acc: Record<string, unknown>, prop) => {
    if (account.hasOwnProperty(prop)) {
      acc[prop] = account[prop];
    }
    return acc;
  }, {}) as TAccountInput;
};
