import BaseLayoutManagement from "../../../../components/layout/BaseLayoutManagement";
import Builder from "../../../../components/builder/Builder";
import FormCode from "../../../../components/form/FormCode";
import FullWidth from "../../../../components/layout/FullWidth";
import LimitedWidth from "../../../../components/layout/LimitedWidth";
import Loading from "../../../../components/Loading";
import MessagePage from "../../../../components/MessagePage";
import SecondNavBar from "../../../../components/layout/SecondNavBar";
import { useCodeSecondNavigation } from "../../../../lib/navigation/formCodeSecondNavigation";
import { useForm } from "../../../../lib/forms";
import { useFormMenuSteps } from "../../../../lib/navigation/formMenuSteps";
import { useMemo } from "react";
import { useRouter } from "next/router";
import withAuthentication from "../../../../components/layout/WithAuthentication";

function FormPage() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm, isErrorForm } = useForm(formId);
  const codeSecondNavigation = useCodeSecondNavigation(formId);
  const formMenuSteps = useFormMenuSteps(formId);

  const breadcrumbs = useMemo(() => {
    if (form) {
      return [
        { name: `Admissions`, href: "/forms", current: true },
        { name: form.name, href: "#", current: true },
      ];
    }
  }, [form]);

  if (isLoadingForm) {
    return <Loading />;
  }

  if (isErrorForm) {
    return (
      <MessagePage text="Unable to load this page. Maybe you don't have enough rights." />
    );
  }

  return (
    <>
      {form.formType === "NOCODE" ? (
        <BaseLayoutManagement
          title={`${form.name} - Kadea Sourcing`}
          breadcrumbs={breadcrumbs}
          steps={formMenuSteps}
          currentStep="form"
          bgClass="bg-white"
          limitHeightScreen={true}
        >
          <FullWidth>
            <Builder formId={formId} />
          </FullWidth>
        </BaseLayoutManagement>
      ) : (
        <BaseLayoutManagement
          title={`${form.name} - Kadea Sourcing`}
          breadcrumbs={breadcrumbs}
          steps={formMenuSteps}
          currentStep="form"
        >
          <SecondNavBar
            navItems={codeSecondNavigation}
            currentItemId="formId"
          />

          <LimitedWidth>
            <FormCode formId={formId} />
          </LimitedWidth>
        </BaseLayoutManagement>
      )}
    </>
  );
}

export default withAuthentication(FormPage);
