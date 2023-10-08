"use client";

import { timeSince } from "@/../../packages/lib/time";
import { TEnvironment } from "@/../../packages/types/v1/environment";
import { TAirTableIntegration, TAirtable } from "@/../../packages/types/v1/integrations";
import { TSurvey } from "@/../../packages/types/v1/surveys";
import { Button } from "@/../../packages/ui";
import AddIntegrationModal, {
  IntegrationModalInputs,
} from "@/app/(app)/environments/[environmentId]/integrations/airtable/AddIntegrationModal";
import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/airtable/actions";
import DeleteDialog from "@/components/shared/DeleteDialog";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { useState } from "react";
import { toast } from "react-hot-toast";
interface handleModalProps {
  airTableIntegration: TAirTableIntegration;
  environment: TEnvironment;
  environmentId: string;
  setIsConnected: (data: boolean) => void;
  surveys: TSurvey[];
  airTableArray: TAirtable[];
}

const tableHeaders = ["Survey", "Table Name", "Questions", "Updated At"];

export default function Home(props: handleModalProps) {
  const { airTableIntegration, environment, environmentId, setIsConnected, surveys, airTableArray } = props;
  const [isDeleting, setisDeleting] = useState(false);
  const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false);
  const [defaultValues, setDefaultValues] = useState<(IntegrationModalInputs & { index: number }) | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const integrationData = airTableIntegration?.config?.data ?? [];

  const handleDeleteIntegration = async () => {
    try {
      setisDeleting(true);
      await deleteIntegrationAction(airTableIntegration.id);
      setIsConnected(false);
      toast.success("Integration removed successfully");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setisDeleting(false);
      setIsDeleteIntegrationModalOpen(false);
    }
  };

  const handleModal = (val: boolean) => {
    setIsModalOpen(val);
  };

  const isEditMode = defaultValues ? true : false;
  return (
    <div className="mt-6 flex w-full flex-col items-center justify-center p-6">
      <div className="flex w-full justify-end gap-x-6">
        <div className=" flex items-center">
          <span className="mr-4 h-4 w-4 rounded-full bg-green-600"></span>
          <span
            className="cursor-pointer text-slate-500"
            onClick={() => {
              setIsDeleteIntegrationModalOpen(true);
            }}>
            Connected with {airTableIntegration.config.email}
          </span>
        </div>
        <Button
          onClick={() => {
            setDefaultValues(null);
            handleModal(true);
          }}
          variant="darkCTA">
          Link new table
        </Button>
      </div>

      {integrationData.length ? (
        <div className="relative w-full overflow-auto pt-10">
          <table className="w-full border border-slate-200 text-sm">
            <thead className="rounded-lg  [&_tr]:border-b">
              <tr className="border-b bg-slate-100  transition-colors ">
                {tableHeaders.map((item) => (
                  <th
                    key={item}
                    className="h-10 w-[100px] px-2 text-left align-middle font-medium text-slate-900 ">
                    {item}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="[&_tr:last-child]:border-0">
              {integrationData.map((data, index) => (
                <tr
                  tabIndex={0}
                  aria-label={`edit ${data.tableName} integration`}
                  onClick={() => {
                    setDefaultValues({
                      base: data.baseId,
                      questions: data.questionIds,
                      survey: data.surveyId,
                      table: data.tableId,
                      index,
                    });
                    setIsModalOpen(true);
                  }}
                  key={index}
                  className="cursor-pointer border-b transition-colors hover:bg-slate-100">
                  <td className="p-2 align-middle font-medium ">{data.surveyName}</td>
                  <td className="p-2 align-middle">{data.tableName}</td>
                  <td className="p-2 align-middle">{data.questions}</td>
                  <td className="p-2 align-middle">{timeSince(data.createdAt.toString())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 w-full">
          <EmptySpaceFiller
            type="table"
            environment={environment}
            noWidgetRequired={true}
            emptyMessage="Your airtable integrations will appear here as soon as you add them. ⏲️"
          />
        </div>
      )}

      <DeleteDialog
        open={isDeleteIntegrationModalOpen}
        setOpen={setIsDeleteIntegrationModalOpen}
        deleteWhat="airtable connection"
        onDelete={handleDeleteIntegration}
        text="Are you sure? Your integrations will break."
        isDeleting={isDeleting}
      />

      <AddIntegrationModal
        key={String(isEditMode)}
        airTableArray={airTableArray}
        open={isModalOpen}
        setOpenWithStates={handleModal}
        environmentId={environmentId}
        surveys={surveys}
        airtableIntegration={airTableIntegration}
        {...(defaultValues ? { isEditMode: true, defaultData: defaultValues } : { isEditMode: false })}
      />
    </div>
  );
}
