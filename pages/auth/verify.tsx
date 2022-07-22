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
      <div className="flex min-h-screen bg-ui-gray-light">
        <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="w-full max-w-sm p-8 mx-auto bg-white rounded-xl shadow-cont lg:w-96">
            <p className="text-center">
              {!token ? "No Token provided" : "Verifying..."}
            </p>
          </div>
        </div>
      </div>
    </BaseLayoutUnauthorized>
  );
}
