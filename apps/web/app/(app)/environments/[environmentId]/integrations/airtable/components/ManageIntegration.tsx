"use client";

import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import {
  AddIntegrationModal,
  IntegrationModalInputs,
} from "@/app/(app)/environments/[environmentId]/integrations/airtable/components/AddIntegrationModal";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { EmptySpaceFiller } from "@/modules/ui/components/empty-space-filler";
import { useTranslate } from "@tolgee/react";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { timeSince } from "@formbricks/lib/time";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationAirtable } from "@formbricks/types/integration/airtable";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface ManageIntegrationProps {
  airtableIntegration: TIntegrationAirtable;
  environment: TEnvironment;
  environmentId: string;
  setIsConnected: (data: boolean) => void;
  surveys: TSurvey[];
  airtableArray: TIntegrationItem[];
  locale: TUserLocale;
}

const tableHeaders = [
  "common.survey",
  "environments.integrations.airtable.table_name",
  "common.questions",
  "common.updated_at",
];

export const ManageIntegration = (props: ManageIntegrationProps) => {
  const { airtableIntegration, environment, environmentId, setIsConnected, surveys, airtableArray } = props;
  const { t } = useTranslate();
  const [isDeleting, setisDeleting] = useState(false);
  const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false);
  const [defaultValues, setDefaultValues] = useState<(IntegrationModalInputs & { index: number }) | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const integrationData = airtableIntegration?.config?.data ?? [];

  const handleDeleteIntegration = async () => {
    setisDeleting(true);

    const deleteIntegrationActionResult = await deleteIntegrationAction({
      integrationId: airtableIntegration.id,
    });

    if (deleteIntegrationActionResult?.data) {
      toast.success(t("environments.integrations.integration_removed_successfully"));
      setIsConnected(false);
    } else {
      const errorMessage = getFormattedErrorMessage(deleteIntegrationActionResult);
      toast.error(errorMessage);
    }

    setisDeleting(false);
    setIsDeleteIntegrationModalOpen(false);
  };

  const handleModal = (val: boolean) => {
    setIsModalOpen(val);
  };

  const data = defaultValues
    ? { isEditMode: true as const, defaultData: defaultValues }
    : { isEditMode: false as const };
  return (
    <div className="mt-6 flex w-full flex-col items-center justify-center p-6">
      <div className="flex w-full justify-end gap-x-6">
        <div className="flex items-center">
          <span className="mr-4 h-4 w-4 rounded-full bg-green-600"></span>
          <span className="cursor-pointer text-slate-500">
            {t("environments.integrations.connected_with_email", {
              email: airtableIntegration.config.email,
            })}
          </span>
        </div>
        <Button
          onClick={() => {
            setDefaultValues(null);
            handleModal(true);
          }}>
          {t("environments.integrations.airtable.link_new_table")}
        </Button>
      </div>

      {integrationData.length ? (
        <div className="mt-6 w-full rounded-lg border border-slate-200">
          <div className="grid h-12 grid-cols-8 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
            {tableHeaders.map((header, idx) => (
              <div key={idx} className={`col-span-2 hidden text-center sm:block`}>
                {t(header)}
              </div>
            ))}
          </div>

          {integrationData.map((data, index) => (
            <div
              key={index}
              className="m-2 grid h-16 grid-cols-8 content-center rounded-lg hover:bg-slate-100"
              onClick={() => {
                setDefaultValues({
                  base: data.baseId,
                  questions: data.questionIds,
                  survey: data.surveyId,
                  table: data.tableId,
                  includeVariables: !!data.includeVariables,
                  includeHiddenFields: !!data.includeHiddenFields,
                  includeMetadata: !!data.includeMetadata,
                  includeCreatedAt: !!data.includeCreatedAt,
                  index,
                });
                setIsModalOpen(true);
              }}>
              <div className="col-span-2 text-center">{data.surveyName}</div>
              <div className="col-span-2 text-center">{data.tableName}</div>
              <div className="col-span-2 text-center">{data.questions}</div>
              <div className="col-span-2 text-center">
                {timeSince(data.createdAt.toString(), props.locale)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 w-full">
          <EmptySpaceFiller
            type="table"
            environment={environment}
            noWidgetRequired={true}
            emptyMessage={t("environments.integrations.airtable.no_integrations_yet")}
          />
        </div>
      )}

      <Button variant="ghost" onClick={() => setIsDeleteIntegrationModalOpen(true)} className="mt-4">
        <Trash2Icon />
        {t("environments.integrations.delete_integration")}
      </Button>

      <DeleteDialog
        open={isDeleteIntegrationModalOpen}
        setOpen={setIsDeleteIntegrationModalOpen}
        deleteWhat={t("environments.integrations.airtable.airtable_integration")}
        onDelete={handleDeleteIntegration}
        text={t("environments.integrations.delete_integration_confirmation")}
        isDeleting={isDeleting}
      />

      {isModalOpen && (
        <AddIntegrationModal
          airtableArray={airtableArray}
          open={isModalOpen}
          setOpenWithStates={handleModal}
          environmentId={environmentId}
          surveys={surveys}
          airtableIntegration={airtableIntegration}
          {...data}
        />
      )}
    </div>
  );
};
