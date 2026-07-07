import { APIKeysPage } from "@/modules/organization/settings/api-keys/page";

const Page = (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  return APIKeysPage(props);
};

export default Page;
