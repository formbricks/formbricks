import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { canUserAccessProduct } from "@formbricks/lib/product/auth";
import { getProduct } from "@formbricks/lib/product/service";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
import { Header } from "@formbricks/ui/Header";

interface OnboardingPendingPageProps {
  searchParams: {
    productId?: string;
  };
}

const Page = async ({ searchParams }: OnboardingPendingPageProps) => {
  if (!searchParams.productId) return notFound();
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not Authenticated");
  }
  const isAuthorized = await canUserAccessProduct(session.user.id, searchParams.productId);
  if (!isAuthorized) {
    throw new AuthorizationError("Not Authorized");
  }
  const product = await getProduct(searchParams.productId);
  if (!product) {
    throw new Error("Product not found");
  }

  if (product.config.isOnboardingCompleted === undefined || product.config.isOnboardingCompleted) {
    return notFound();
  }
  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header
        title="Onboarding Pending! 🙁"
        subtitle="Please wait until the product onboarding was finished by the team."
      />
    </div>
  );
};

export default Page;
