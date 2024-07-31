import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";

const Page = async ({ params }) => {
  const session = await getServerSession(authOptions);

  return (
    <div>
      <div>iframe Survey Summary Page Sample</div>
      <pre>{JSON.stringify(params, null, 2)}</pre>
      <pre>{JSON.stringify(session, null, 2)}</pre>
    </div>
  );
};

export default Page;
