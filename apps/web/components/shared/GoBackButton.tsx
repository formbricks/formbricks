import { BackIcon } from "@formbricks/ui/icons";
import { useRouter } from "next/navigation";

export default function GoBackButton() {
  const router = useRouter();
  return (
    <button className="inline-flex pt-5 text-sm text-slate-500" onClick={() => router.back()}>
      <BackIcon className="mr-2 h-5 w-5" />
      Back
    </button>
  );
}
