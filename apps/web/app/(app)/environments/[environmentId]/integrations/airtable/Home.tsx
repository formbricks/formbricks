import { timeSince } from "@/../../packages/lib/time";
import { TEnvironment } from "@/../../packages/types/v1/environment";
import { TAirTableIntegration } from "@/../../packages/types/v1/integrations";
import { Button } from "@/../../packages/ui";
import { upsertIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/airtable/actions";
import DeleteDialog from "@/components/shared/DeleteDialog";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { useState } from "react";
import { toast } from "react-hot-toast";
interface handleModalProps {
  handleModal: (data: boolean) => void;
  airTableIntegration: TAirTableIntegration;
  environment: TEnvironment;
  environmentId: string;
}

const tableHeaders = ["Survey", "Table Name", "Questions", "Updated At", "Actions"];

export default function Home(props: handleModalProps) {
  const { handleModal, airTableIntegration, environment, environmentId } = props;
  const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const integrationData = airTableIntegration?.config?.data ?? [];

  const handleDeleteIntegration = async () => {
    if (typeof selectedId === "number") {
      setIsDeleting(true);
      try {
        const integrationCopy = { ...airTableIntegration };
        integrationCopy.config.data.splice(selectedId, 1);
        console.log({ integrationCopy });

        await upsertIntegrationAction(environmentId, integrationCopy);

        toast.success(`Integration deleted successfully`);
        setIsDeleteIntegrationModalOpen(false);
        setSelectedId(null);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setIsDeleting(false);
      }
    }
  };
  return (
    <div className="mt-6 flex w-full flex-col items-center justify-center p-6">
      <div className="flex w-full justify-end">
        <Button onClick={() => handleModal(true)} variant="darkCTA">
          Link new table
        </Button>
      </div>

      {!integrationData.length ? (
        <div className="mt-4 w-full">
          <EmptySpaceFiller
            type="table"
            environment={environment}
            noWidgetRequired={true}
            emptyMessage="Your airtable integrations will appear here as soon as you add them. ⏲️"
          />
        </div>
      ) : (
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
              {integrationData &&
                integrationData.map((data, index) => (
                  <tr key={index} className=" border-b transition-colors hover:bg-slate-100">
                    <td className="p-2 align-middle font-medium ">{data.surveyName}</td>
                    <td className="p-2 align-middle">{data.tableName}</td>
                    <td className="p-2 align-middle">{data.questions}</td>
                    <td className="p-2 align-middle">{timeSince(data.createdAt.toString())}</td>
                    <td className="flex gap-x-2 p-2 align-middle">
                      <Button size="sm">Edit</Button>
                      <Button
                        onClick={() => {
                          setIsDeleteIntegrationModalOpen(true);
                          setSelectedId(index);
                        }}
                        variant="alert"
                        size="sm">
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <DeleteDialog
        open={isDeleteIntegrationModalOpen}
        setOpen={setIsDeleteIntegrationModalOpen}
        deleteWhat="Google Connection"
        onDelete={handleDeleteIntegration}
        text="Are you sure? Your integrations will break."
        isDeleting={isDeleting}
      />
    </div>
  );
}
