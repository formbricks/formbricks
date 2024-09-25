import Avatar from "boring-avatars";
import { sha256 } from "js-sha256";
import Image from "next/image";

const colors = ["#00C4B8", "#ccfbf1", "#334155"];

interface PersonAvatarProps {
  personId: string;
}

export const PersonAvatar: React.FC<PersonAvatarProps> = ({ personId }) => {
  return <Avatar size={40} name={personId} variant="beam" colors={colors} />;
};

interface ProfileAvatar {
  imageUrl?: string | null;
  email: string;
}

export const ProfileAvatar: React.FC<ProfileAvatar> = ({ imageUrl, email }) => {
  const imageSrc = imageUrl || `https://www.gravatar.com/avatar/${sha256(email)}?d=retro`;

  return (
    <Image
      src={imageSrc}
      width="40"
      height="40"
      className="h-10 w-10 rounded-full object-cover"
      alt="Avatar placeholder"
    />
  );
};
