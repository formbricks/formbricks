import DeputyBadge from "@/images/formtribe/deputy-batch.png";
import DummyFace from "@/images/formtribe/jojo.jpeg";
import LegendBadge from "@/images/formtribe/legend-batch.png";
import PrimeBadge from "@/images/formtribe/prime-batch.png";
import RookieBadge from "@/images/formtribe/rookie-batch.png";
import Image from "next/image";
import Link from "next/link";

interface RoadmapProps {
  members: Object;
}

export const HallOfFame: React.FC<RoadmapProps> = ({ members }) => {
  return (
    <div className="space-y-12 divide-y-2">
      <div className="group flex items-center space-x-10">
        <Image
          src={LegendBadge}
          alt="rookie batch"
          className="h-32 w-32 transition-all group-hover:scale-105"
        />
        <div className="rounded-xl border-dashed border-green-300 bg-green-100 px-10 py-4 text-green-700">
          No FormTribe Legends yet.
        </div>
      </div>
      <div className="group flex items-center space-x-10 pt-12">
        <Image
          src={PrimeBadge}
          alt="rookie batch"
          className="h-32 w-32 transition-all group-hover:scale-105"
        />
        <div className="">
          <div className="grid grid-cols-3 gap-2">
            {members.map((member) => (
              <Link
                href="1"
                className="flex items-center space-x-3 rounded-xl border border-indigo-200 bg-indigo-100 px-6 py-2 transition-all hover:scale-105 hover:border-indigo-300">
                <Image src={DummyFace} alt={member.githubId} className="mr-3 h-12 w-12 rounded-full" />
                {member.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="group flex items-center space-x-10 pt-12">
        <Image
          src={DeputyBadge}
          alt="rookie batch"
          className="h-32 w-32 transition-all group-hover:scale-105"
        />
        <div className="">
          <div className="grid grid-cols-3 gap-2">
            {members.map((member) => (
              <Link
                href="1"
                className="flex items-center space-x-3 rounded-xl border border-orange-200 bg-orange-100 px-6 py-2 transition-all hover:scale-105 hover:border-orange-300">
                <Image src={DummyFace} alt={member.githubId} className="mr-3 h-12 w-12 rounded-full" />
                {member.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="group flex items-center space-x-10 pt-12">
        <Image
          src={RookieBadge}
          alt="rookie batch"
          className="h-32 w-32 transition-all group-hover:scale-105"
        />
        <div className="">
          <div className="grid grid-cols-3 gap-2">
            {members.map((member) => (
              <Link
                href="1"
                className="flex items-center space-x-3 rounded-xl border border-amber-200 bg-amber-100 px-6 py-2 transition-all hover:scale-105 hover:border-amber-300">
                <Image src={DummyFace} alt={member.githubId} className="mr-3 h-12 w-12 rounded-full" />
                {member.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HallOfFame;
