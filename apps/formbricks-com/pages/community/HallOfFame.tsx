import DeputyBadge from "@/images/formtribe/deputy-batch.png";
import LegendBadge from "@/images/formtribe/legend-batch.png";
import PrimeBadge from "@/images/formtribe/prime-batch.png";
import RookieBadge from "@/images/formtribe/rookie-batch.png";
import Image from "next/image";
import Link from "next/link";

interface Member {
  name: string;
  githubId: string;
  level: string;
  imgUrl: string;
}

interface RoadmapProps {
  members: Member[];
}

interface BadgeSectionProps {
  badgeImage: any;
  level: string;
  members: Member[];
  className: string; // New property for styling
}

const BadgeSection: React.FC<BadgeSectionProps> = ({ badgeImage, level, members, className }) => {
  const filteredMembers = members?.filter((member) => member.level === level);

  return (
    <div className="group flex flex-col items-center space-y-6 pt-12 md:flex-row md:space-x-10 md:px-4">
      <Image
        src={badgeImage}
        alt={`${level} badge`}
        className="h-32 w-32 transition-all delay-100 duration-300 group-hover:-rotate-6 group-hover:scale-110"
      />
      <div className="grid w-full gap-2 md:grid-cols-3">
        {filteredMembers?.length > 0 ? (
          filteredMembers?.map((member) => (
            <Link
              key={member.githubId}
              href={`https://github.com/formbricks/formbricks/pulls?q=is:pr+author:${member.githubId}`}
              target="_blank"
              className={`flex w-full items-center space-x-3 rounded-xl border px-4 py-1 transition-all hover:scale-105 md:px-5 md:py-2 ${className}`}>
              <Image
                src={member.imgUrl}
                alt={member.githubId}
                className="mr-3 h-8 w-8 rounded-full md:h-12 md:w-12"
                width={100}
                height={100}
              />
              {member.name}
            </Link>
          ))
        ) : (
          <div className="text-center text-slate-700">No Legends around yet 👀</div>
        )}
      </div>
    </div>
  );
};

export const HallOfFame: React.FC<RoadmapProps> = ({ members }) => {
  return (
    <div className="mx-auto space-y-12 divide-y-2">
      <BadgeSection
        badgeImage={LegendBadge}
        level="legend"
        members={members}
        className="border-green-300 bg-green-100 text-green-700"
      />
      <BadgeSection
        badgeImage={PrimeBadge}
        level="prime"
        members={members}
        className="border-indigo-200 bg-indigo-100 text-indigo-700"
      />
      <BadgeSection
        badgeImage={DeputyBadge}
        level="deputy"
        members={members}
        className="border-orange-200 bg-orange-100 text-orange-700"
      />
      <BadgeSection
        badgeImage={RookieBadge}
        level="rookie"
        members={members}
        className="border-amber-200 bg-amber-100 text-amber-700"
      />
    </div>
  );
};

export default HallOfFame;
