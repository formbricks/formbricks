import { SignIn } from "./SignIn";

interface VerifyProps {
  searchParams?: {
    token?: string;
  };
}

export default function Verify({ searchParams }: VerifyProps) {
  return (
    <>
      <p className="text-center">{!searchParams.token ? "No Token provided" : "Verifying..."}</p>
      <SignIn token={searchParams.token} />
    </>
  );
}
