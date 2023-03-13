import Avatar from "boring-avatars";

const colors = ["#00e6ca", "#c4f0eb", "#334155"];

export function PersonAvatar({ personId }) {
  return <Avatar size={40} name={personId} variant="beam" colors={colors} />;
}

export function ProfileAvatar({ userId }) {
  return <Avatar size={40} name={userId} variant="beam" colors={colors} />;
}
