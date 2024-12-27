import Link from "next/link";

export default function AboutPage() {
  return (
    <div>
      <h1>About</h1>
      <Link href="/search?formbricksDebug=true">Search</Link>
      <Link href="/?formbricksDebug=true">Home</Link>
    </div>
  );
}
