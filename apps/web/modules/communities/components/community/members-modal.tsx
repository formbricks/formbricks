"use client";

import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import Image from "next/image";
import { useState } from "react";

type Member = {
  id: string;
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
};

interface MembersModalProps {
  members: Member[];
}

export function MembersModal({ members }: MembersModalProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslate();

  return (
    <>
      <span onClick={() => setOpen(true)} className="text-primary text-sm hover:underline">
        {t("common.view_all")}
      </span>

      <Modal open={open} setOpen={setOpen}>
        <div className="flex flex-col">
          <div className="mb-6">
            <h3 className="text-xl font-medium">
              {t("common.members")} ({members.length})
            </h3>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-slate-50">
                  <div className="h-10 w-10">
                    {member.imageUrl ? (
                      <Image
                        src={member.imageUrl}
                        alt={member.name || "Member"}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-200"></div>
                    )}
                  </div>
                  <div className="font-medium">{member.name || t("common.unnamed_user")}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default MembersModal;
