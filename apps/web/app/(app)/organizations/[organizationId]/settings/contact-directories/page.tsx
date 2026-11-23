import { ContactDirectoriesPage } from "@/modules/ee/contacts/directories/page";

const Page = (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  return ContactDirectoriesPage(props);
};

export default Page;
