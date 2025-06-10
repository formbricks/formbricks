import HeartIcon from "@/images/heart.png";
import NoteIcon from "@/images/note.png";
import TrophyIcon from "@/images/trophy.png";
import Image from "next/image";

type StatIconType = "heart" | "note" | "trophy";

const icons = {
  heart: HeartIcon,
  note: NoteIcon,
  trophy: TrophyIcon,
};

interface CommunityStatCardProps {
  value: string | number;
  label: string;
  icon: StatIconType;
}

export const CommunityStatCard = ({ value, label, icon: iconType }: CommunityStatCardProps) => {
  return (
    <div className="bg-primary-20 relative flex min-h-[187px] flex-col items-center justify-center gap-2 rounded-2xl pt-10">
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 transform">
        <div className="">
          <Image src={icons[iconType]} alt={`${label} icon`} width={80} height={72} className="h-20" />
        </div>
      </div>

      <div className="text-primary mt-4 text-3xl font-bold">{value}</div>

      <div className="mb-3 text-center">
        <h3 className="text-lg font-medium capitalize">{label}</h3>
      </div>
    </div>
  );
};
