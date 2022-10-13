import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";

export default function Verify() {
  const router = useRouter();
  const token = router.query.token?.toString();
  useEffect(() => {
    if (token) {
      signIn("token", {
        token,
        callbackUrl: `/forms`,
      });
    }
  }, [token]);
  return (
    <BaseLayoutUnauthorized title="Verifying your email">
      <div className="bg-ui-gray-light flex min-h-screen">
        <div className="mx-auto flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="shadow-cont mx-auto w-full max-w-sm rounded-xl bg-white p-8 lg:w-96">
            <p className="text-center">{!token ? "No Token provided" : "Verifying..."}</p>
          </div>
        </div>
      </div>
    </BaseLayoutUnauthorized>
  );
}
