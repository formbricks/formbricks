import BaseLayoutManagement from "../../../../components/layout/BaseLayoutManagement";
import FullWidth from "../../../../components/layout/FullWidth";
import Loading from "../../../../components/Loading";
import MessagePage from "../../../../components/MessagePage";
import ResultsResponses from "../../../../components/results/ResultsResponses";
import SecondNavBar from "../../../../components/layout/SecondNavBar";
import { useForm } from "../../../../lib/forms";
import { useFormMenuSteps } from "../../../../lib/navigation/formMenuSteps";
import { useFormResultsSecondNavigation } from "../../../../lib/navigation/formResultsSecondNavigation";
import { useRouter } from "next/router";
import withAuthentication from "../../../../components/layout/WithAuthentication";
import { useNoCodeForm } from "../../../../lib/noCodeForm";

function ResultsResponsesPage() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm, isErrorForm } = useForm(formId);
  const formMenuSteps = useFormMenuSteps(formId);
  const formResultsSecondNavigation = useFormResultsSecondNavigation(formId);
  const { noCodeForm, isLoadingNoCodeForm } = useNoCodeForm(formId);

  if (isLoadingForm || isLoadingNoCodeForm) {
    return <Loading />;
  }

  if (isErrorForm) {
    return (
      <MessagePage text="Unable to load this page. Maybe you don't have enough rights." />
    );
  }

  return (
    <BaseLayoutManagement
      title={`${form.name} - Kadea Sourcing`}
      breadcrumbs={[{ name: form.name, href: "#", current: true }]}
      steps={formMenuSteps}
      currentStep="results"
      limitHeightScreen={true}
    >
      <SecondNavBar
        navItems={formResultsSecondNavigation}
        currentItemId="responses"
      />

      <FullWidth>
        <ResultsResponses formId={formId} noCodeForm={noCodeForm} />
      </FullWidth>
    </BaseLayoutManagement>
  );
}

export default withAuthentication(ResultsResponsesPage);
