"use client"

import { Button } from "@formbricks/ui";
import { authorization } from "@formbricks/lib/client/google"
import { TrashIcon } from "@heroicons/react/24/outline";
import { upsertIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/actions";
import { useState } from "react";
import DeleteDialog from "@/components/shared/DeleteDialog";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { timeSince } from "@formbricks/lib/time";

export default function Home({ environmentId, setShowSurveySelect, integrations,setOpenAddIntegrationModal }) {

    const googleSheetIntegrations = integrations.find((integration) => { return integration.type === "googleSheets" })
    const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false)
    const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
    const [integrationArray, setIntegrationArray] = useState(googleSheetIntegrations ? googleSheetIntegrations.config.data : [])

    const handleDeleteIntegration = () => {
        if (deleteIndex !== null) {
            integrationArray.splice(deleteIndex, 1);
            upsertIntegrationAction(environmentId, {
                type: "googleSheets",
                environment: environmentId,
                config: {
                    data: integrationArray
                }
            })
            setIntegrationArray(integrationArray)
            setIsDeleteIntegrationModalOpen(false)
        }
    }

    return (
        <div className="flex flex-col justify-center items-center p-6 mt-6 w-full">
            <div className="flex justify-end w-full">
                <div className="mr-6 flex items-center">
                    <span className="w-4 h-4 rounded-full bg-green-600 mr-4"></span>
                    <span className="text-slate-500">Connected with dhruwangajariwala18@gmail.com</span>
                </div>
                <Button variant="darkCTA" onClick={()=>{setOpenAddIntegrationModal(true)}}>Link new Sheet</Button>
            </div>
            {integrationArray.length === 0 ?<div className="w-full mt-4">
                <EmptySpaceFiller
                    type="table"
                    environmentId={environmentId}
                    noWidgetRequired={true}
                    emptyMessage="Your google sheet integrations will appear here as soon as you add them. ⏲️"
                />
            </div> : 
            <div className="flex flex-col items-center justify-center w-full mt-4">
            <div className="rounded-lg border border-slate-200 w-full mt-6">
                <div className="grid h-12 grid-cols-8 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
                    <div className="col-span-2 pl-6 ">Survey</div>
                    <div className="col-span-2 text-center hidden sm:block">Google Sheet Name</div>
                    <div className="col-span-2 text-center hidden sm:block">Questions</div>
                    <div className="col-span-2 text-center hidden sm:block">Updated At</div>
                </div>
                {integrationArray?.length === 0 &&
                    <div className="flex h-12 items-center justify-center whitespace-nowrap px-6 text-sm font-medium text-slate-400 ">
                        You dont have any active google sheet integrations
                    </div>}
                {integrations?.length > 0 && integrationArray.map((data) => {
                    return <div className="m-2 grid h-16  grid-cols-8 content-center rounded-lg hover:bg-slate-100">
                        <div className="col-span-2 text-center">{data.surveyName}</div>
                        <div className="col-span-2 text-center">{data.spreadsheetName}</div>
                        <div className="col-span-2 text-center">
                            {data.questions}
                        </div>
                        <div className="col-span-2 text-center">
                            {timeSince(data.createdAt.toString())}
                        </div>
                    </div>
                })}
            </div>
        </div>}

            
            <DeleteDialog
                open={isDeleteIntegrationModalOpen}
                setOpen={setIsDeleteIntegrationModalOpen}
                deleteWhat="Integration"
                onDelete={handleDeleteIntegration}
            />
        </div>
    )
}
