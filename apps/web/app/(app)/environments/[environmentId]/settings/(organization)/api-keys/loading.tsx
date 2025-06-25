import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import Loading from "@/modules/organization/settings/api-keys/loading";

export default function LoadingPage() {
  return <Loading isFormbricksCloud={IS_FORMBRICKS_CLOUD} />;
}
