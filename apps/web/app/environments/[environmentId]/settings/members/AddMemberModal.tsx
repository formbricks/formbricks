"use client";

import Modal from "@/components/shared/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useForm } from "react-hook-form";
import { addMember } from "@/lib/teams";

interface MemberModalProps {
    environmentId: string;
    teamId: string;
    open: boolean;
    setOpen: (v: boolean) => void;
}

export default function AddMemberModal({
    environmentId,
    teamId,
    open,
    setOpen,
}: MemberModalProps) {
    const { register, control, handleSubmit, reset } = useForm();

    const submitEventClass = async (data) => {
        await addMember(teamId, data);
        setOpen(false);
        reset();
    };

    return (
        <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
            <div className="flex h-full flex-col rounded-lg">
                <div className="rounded-t-lg bg-slate-100">
                    <div className="flex items-center justify-between p-6">
                        <div className="flex items-center space-x-2">
                            <div className="text-xl font-medium text-slate-700">Invite Team Member</div>
                        </div>
                    </div>
                </div>
                <form onSubmit={handleSubmit(submitEventClass)}>
                    <div className="flex justify-between rounded-lg p-6">
                        <div className="space-y-4 w-full">
                            <div>
                                <Label>Full Name</Label>
                                <Input placeholder="e.g. Hans Wurst" {...register("name", { required: true })} />
                            </div>
                            <div>
                                <Label>Email Adress</Label>
                                <Input placeholder="hans@wurst.com" {...register("email")} />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end border-t border-slate-200 p-6">
                        <div className="flex space-x-2">
                            <Button
                                type="button"
                                variant="minimal"
                                onClick={() => {
                                    setOpen(false);
                                }}>
                                Cancel
                            </Button>
                            <Button variant="primary" type="submit">
                                Send Invitation
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </Modal>
    );
}
