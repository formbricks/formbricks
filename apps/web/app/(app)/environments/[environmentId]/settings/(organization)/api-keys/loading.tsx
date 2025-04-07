import Loading from "@/modules/organization/settings/api-keys/loading";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";

export default function LoadingPage() {
  return <Loading isFormbricksCloud={IS_FORMBRICKS_CLOUD} />;
}
