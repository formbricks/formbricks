import { redirect } from "next/navigation";
import { getIsFreshInstance } from "@/lib/instance/service";

const Page = async () => {
  // Only a fresh instance has anything to set up: the administrator signs up, and sign-up creates the
  // organization. Everywhere else `/` decides where a person belongs.
  if (await getIsFreshInstance()) {
    return redirect("/setup/intro");
  }

  return redirect("/");
};

export default Page;
