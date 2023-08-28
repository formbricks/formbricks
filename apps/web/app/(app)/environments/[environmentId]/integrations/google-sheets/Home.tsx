"use client"

import { Button } from "@formbricks/ui";
import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/actions";
import { useState } from "react";
import DeleteDialog from "@/components/shared/DeleteDialog";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { timeSince } from "@formbricks/lib/time";
import toast from "react-hot-toast";
import { TGoogleSheetIntegration, TGoogleSheetsConfigData } from "@formbricks/types/v1/integrations";

interface HomeProps {
    environmentId: string;
    googleSheetIntegration: TGoogleSheetIntegration;
    setOpenAddIntegrationModal: (v: boolean) => void;
    setIsConnected: (v: boolean) => void;
    setSelectedIntegration: (v: TGoogleSheetsConfigData & { index: number } | null) => void;
}

export default function Home({ environmentId, googleSheetIntegration, setOpenAddIntegrationModal, setIsConnected, setSelectedIntegration }:HomeProps) {

    const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false)
    const integrationArray = googleSheetIntegration ? googleSheetIntegration.config.data : []
    const [isDeleting, setisDeleting] = useState(false)

    const handleDeleteIntegration = async () => {
        try {
            setisDeleting(true)
            await deleteIntegrationAction(googleSheetIntegration.id)
            setIsConnected(false)
            toast.success("Integration removed successfully")
        } catch (error) {
            toast.error(error.message)
        }
        finally {
            setisDeleting(false)
            setIsDeleteIntegrationModalOpen(false)
        }
    }

    const editIntegration = (index: number) => {
        setSelectedIntegration({
            ...googleSheetIntegration.config.data[index],
            index: index
        });
        setOpenAddIntegrationModal(true)
    }

    return (
        <div className="flex flex-col justify-center items-center p-6 mt-6 w-full">
            <div className="flex justify-end w-full">
                <div className="mr-6 flex items-center">
                    <span className="w-4 h-4 rounded-full bg-green-600 mr-4"></span>
                    <span className="text-slate-500 cursor-pointer" onClick={() => { setIsDeleteIntegrationModalOpen(true) }}>Connected with {googleSheetIntegration.config.email}</span>
                </div>
                <Button variant="darkCTA" onClick={() => {
                    setSelectedIntegration(null)
                    setOpenAddIntegrationModal(true)
                }}>Link new Sheet</Button>
            </div>
            {!integrationArray || integrationArray.length === 0 ? <div className="w-full mt-4">
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
                        {integrationArray && integrationArray.map((data, index) => {
                            return <div key={index} className="m-2 grid h-16  grid-cols-8 content-center rounded-lg hover:bg-slate-100" onClick={() => { editIntegration(index) }}>
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
                deleteWhat="Google Sheet Integration"
                onDelete={handleDeleteIntegration}
                isDeleting={isDeleting}
            />
        </div>
    )
}
