import Avatar from "boring-avatars";
import Image from "next/image";

const colors = ["#00C4B8", "#ccfbf1", "#334155"];

interface PersonAvatarProps {
  personId: string;
}

export const PersonAvatar: React.FC<PersonAvatarProps> = ({ personId }) => {
  return <Avatar size={40} name={personId} variant="beam" colors={colors} />;
};

interface ProfileAvatar {
  userId: string;
  imageUrl?: string | null;
}

export const ProfileAvatar: React.FC<ProfileAvatar> = ({ userId, imageUrl }) => {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        width="40"
        height="40"
        className="h-10 w-10 rounded-full object-cover"
        alt="Avatar placeholder"
      />
    );
  }
  return <Avatar size={40} name={userId} variant="bauhaus" colors={colors} />;
};
