import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import Builder from "../../../../components/builder/Builder";
import FormCode from "../../../../components/form/FormCode";
import BaseLayoutAuthorized from "../../../../components/layout/BaseLayoutAuthorized";
import FullWidth from "../../../../components/layout/FullWidth";
import LimitedWidth from "../../../../components/layout/LimitedWidth";
import SecondNavBar from "../../../../components/layout/SecondNavBar";
import Loading from "../../../../components/Loading";
import { useForm } from "../../../../lib/forms";
import { useCodeSecondNavigation } from "../../../../lib/navigation/formCodeSecondNavigation";
import { useFormMenuSteps } from "../../../../lib/navigation/formMenuSteps";

export default function FormPage() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm } = useForm(router.query.id);
  const codeSecondNavigation = useCodeSecondNavigation(formId);
  const formMenuSteps = useFormMenuSteps(formId);

  if (isLoadingForm) {
    return <Loading />;
  }

  const breadcrumbs = [{ name: form.name, href: "#", current: true }];

  if (form.formType === "NOCODE") {
    return (
      <>
        <BaseLayoutAuthorized
          title={`${form.name} - snoopForms`}
          breadcrumbs={breadcrumbs}
          steps={formMenuSteps}
          currentStep="form"
        >
          <FullWidth>
            <Builder formId={formId} />
          </FullWidth>
        </BaseLayoutAuthorized>
      </>
    );
  } else {
    return (
      <BaseLayoutAuthorized
        title={`${form.name} - snoopForms`}
        breadcrumbs={breadcrumbs}
        steps={formMenuSteps}
        currentStep="form"
      >
        <SecondNavBar navItems={codeSecondNavigation} currentItemId="formId" />

        <LimitedWidth>
          <FormCode formId={formId} />
        </LimitedWidth>
      </BaseLayoutAuthorized>
    );
  }
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession({ req });
  if (!session) {
    res.statusCode = 403;
  }
  return { props: {} };
};
