import BaseLayoutManagement from "../../../../components/layout/BaseLayoutManagement";
import LimitedWidth from "../../../../components/layout/LimitedWidth";
import Loading from "../../../../components/Loading";
import MessagePage from "../../../../components/MessagePage";
import ResultsInsights from "../../../../components/results/ResultsInsights";
import SecondNavBar from "../../../../components/layout/SecondNavBar";
import { useForm } from "../../../../lib/forms";
import { useFormMenuSteps } from "../../../../lib/navigation/formMenuSteps";
import { useFormResultsSecondNavigation } from "../../../../lib/navigation/formResultsSecondNavigation";
import { useRouter } from "next/router";
import withAuthentication from "../../../../components/layout/WithAuthentication";

function ResultsInsightsPage() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm, isErrorForm } = useForm(formId);
  const formMenuSteps = useFormMenuSteps(formId);
  const formResultsSecondNavigation = useFormResultsSecondNavigation(formId);

  if (isLoadingForm) {
    return <Loading />;
  }

  if (isErrorForm) {
    return (
      <MessagePage text="Unable to load this page. Maybe you don't have enough rights." />
    );
  }

  return (
    <BaseLayoutManagement
      title={`${form?.name} - Kadea Sourcing`}
      breadcrumbs={[{ name: form?.name, href: "#", current: true }]}
      steps={formMenuSteps}
      currentStep="results"
      limitHeightScreen={false}
    >
      <SecondNavBar
        navItems={formResultsSecondNavigation}
        currentItemId="insights"
      />

      <LimitedWidth>
        <ResultsInsights formId={formId} />
      </LimitedWidth>
    </BaseLayoutManagement>
  );
}

export default withAuthentication(ResultsInsightsPage);
