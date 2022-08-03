import { useRouter } from "next/router";
import { useMemo } from "react";
import Builder from "../../../../components/builder/Builder";
import FormCode from "../../../../components/form/FormCode";
import BaseLayoutManagement from "../../../../components/layout/BaseLayoutManagement";
import FullWidth from "../../../../components/layout/FullWidth";
import LimitedWidth from "../../../../components/layout/LimitedWidth";
import SecondNavBar from "../../../../components/layout/SecondNavBar";
import withAuthentication from "../../../../components/layout/WithAuthentication";
import Loading from "../../../../components/Loading";
import { useForm } from "../../../../lib/forms";
import { useCodeSecondNavigation } from "../../../../lib/navigation/formCodeSecondNavigation";
import { useFormMenuSteps } from "../../../../lib/navigation/formMenuSteps";

function FormPage() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm } = useForm(router.query.id);
  const codeSecondNavigation = useCodeSecondNavigation(formId);
  const formMenuSteps = useFormMenuSteps(formId);

  const breadcrumbs = useMemo(() => {
    if (form) {
      return [{ name: form.name, href: "#", current: true }];
    }
  }, [form]);

  if (isLoadingForm) {
    return <Loading />;
  }

  return (
    <>
      {form.formType === "NOCODE" ? (
        <BaseLayoutManagement
          title={`${form.name} - snoopForms`}
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
          title={`${form.name} - snoopForms`}
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
