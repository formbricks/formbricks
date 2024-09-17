import { XMTemplateList } from "@/app/(app)/(onboarding)/environments/[environmentId]/xm-templates/components/XMTemplateList";
import { XIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getUser } from "@formbricks/lib/user/service";
import { Button } from "@formbricks/ui/Button";
import { Header } from "@formbricks/ui/Header";

interface XMTemplatePageProps {
  params: {
    environmentId: string;
  };
}

const Page = async ({ params }: XMTemplatePageProps) => {
  const session = await getServerSession(authOptions);
  const environment = await getEnvironment(params.environmentId);

  if (!session) {
    throw new Error("Session not found");
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error("User not found");
  }

  if (!environment) {
    throw new Error("Environment not found");
  }

  const product = await getProductByEnvironmentId(environment.id);
  if (!product) {
    throw new Error("Product not found");
  }

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header title="What kind of feedback would you like to get?" />
      <XMTemplateList product={product} user={user} environmentId={environment.id} />
      <Button
        className="absolute right-5 top-5 !mt-0 text-slate-500 hover:text-slate-700"
        variant="minimal"
        href={`/environments/${environment.id}/surveys`}>
        <XIcon className="h-7 w-7" strokeWidth={1.5} />
      </Button>
    </div>
  );
};

export default Page;
