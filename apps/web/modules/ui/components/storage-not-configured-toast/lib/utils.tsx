import toast from "react-hot-toast";
import { StorageNotConfiguredToast } from "../index";

export const showStorageNotConfiguredToast = () => {
  return toast.error(() => <StorageNotConfiguredToast />, {
    id: "storage-not-configured-toast",
  });
};
