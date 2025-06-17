import { useTranslate } from "@tolgee/react";
import Image from "next/image";
import { TCommunityMember } from "@formbricks/types/user";

interface MemberItemProps {
  member: TCommunityMember;
}

export function MemberItem({ member }: MemberItemProps) {
  const { t } = useTranslate();

  return (
    <div className="grid grid-cols-7 items-center gap-3 rounded-md p-2">
      <div className="col-span-4 flex items-center gap-3">
        <div className="h-10 w-10 overflow-hidden">
          {member.imageUrl ? (
            <Image
              src={member.imageUrl}
              alt={member.name || t("common.unnamed_user")}
              width={40}
              height={40}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <div className="bg-quaternary flex h-full w-full items-center justify-center rounded-full" />
          )}
        </div>
        <div className="max-w-[160px] truncate font-medium">{member.name || t("common.unnamed_user")}</div>
      </div>
      <div className="col-span-3 flex items-center gap-8">
        {member.socials?.find((s) => s.provider == "discord") && (
          <div className="flex items-center text-[#5865F2]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="currentColor"
              viewBox="0 0 16 16">
              <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612" />
            </svg>
            <span className="ml-1 max-w-[80px] truncate font-bold">
              {member.socials.find((s) => s.provider === "discord")?.socialName}
            </span>
          </div>
        )}

        {member.socials?.find((s) => s.provider == "twitter") && (
          <div className="flex items-center text-black">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="currentColor"
              viewBox="0 0 16 16">
              <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z" />
            </svg>
            <span className="ml-1 max-w-[80px] truncate font-bold">
              {member.socials.find((s) => s.provider === "twitter")?.socialName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberItem;
