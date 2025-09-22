// apps/web/app/dev/option-card/page.tsx
import { PictureInPicture2Icon, SendIcon } from "lucide-react";
import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";

export default function Page() {
  const options = [
    { title: "Link & Email surveys", description: "Send via link or email", icon: SendIcon, href: "#" },
    {
      title: "In-product surveys",
      description: "Show surveys in your app",
      icon: PictureInPicture2Icon,
      href: "#",
    },
  ];
  return (
    <div className="flex min-h-screen items-center justify-center">
      <OnboardingOptionsContainer options={options} />
    </div>
  );
}
