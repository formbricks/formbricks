//import { UserRole } from "@prisma/client";
import { UserRoles } from "../../lib/users";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";
import Loading from "../Loading";

const withAuthentication = (Component) =>
  function WithAuth(props) {
    const { status, data: session } = useSession({
      
      required: true,
      onUnauthenticated() {
        // The user is not authenticated, handle it here.
        return signIn();
      },
    });
const router=useRouter()        

    if (status === "loading") {
      return <Loading />;
    }
     if(session.user?.role === UserRoles.Public && router.pathname !== "/sourcings") { 
      router.push('/sourcings') 
    }

    return <Component {...props} />;
  };

export default withAuthentication;
