import Avatar from "boring-avatars";

const colors = ["#00C4B8", "#ccfbf1", "#334155"];

export function PersonAvatar({ personId }: { personId: string }) {
  return <Avatar size={40} name={personId} variant="beam" colors={colors} />;
}

export function ProfileAvatar({ userId }: { userId: string }) {
  return <Avatar size={40} name={userId} variant="bauhaus" colors={colors} />;
}
