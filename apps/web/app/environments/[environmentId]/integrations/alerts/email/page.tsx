"use client";

import { AddAlertButton } from "@/components/integrations/AddAlertButton";
import AlertCard from "@/components/integrations/AlertCard";
import IntegrationPageTitle from "@/components/integrations/IntegrationsPageTitle";
import { EmailIcon } from "@/components/ui/icons/EmailIcon";
import { useState } from "react";
import AddEmailAlertModal from "./AddEmailAlertModal";
import DeleteDialog from "@/components/shared/DeleteDialog";

export default function SlackAlertPage({ params }) {
  const exampleAlert = {
    href: "/",
    title: "Example Alert",
    description: "This is an example alert",
  };

  const [isAlertModalOpen, setAlertModalOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleAddAlertClick = async () => {
    setAlertModalOpen(true);
  };

  const handleDeleteAlertClick = async () => {
    setDeleteDialogOpen(true);
  };

  const deleteEmailAlert = async () => {
    console.log("Delete email alert");
  };

  return (
    <div>
      <IntegrationPageTitle environmentId={params.environmentId} title="Email Alerts" goBackTo="alerts" />
      <div className="grid grid-cols-3 gap-6">
        <AlertCard
          href={exampleAlert.href}
          onDelete={handleDeleteAlertClick}
          onEdit={handleAddAlertClick}
          title={exampleAlert.title}
          description={exampleAlert.description}
          icon={<EmailIcon />}
        />
        <AddAlertButton channel="Email" onClick={() => handleAddAlertClick()} />
      </div>
      <AddEmailAlertModal open={isAlertModalOpen} setOpen={setAlertModalOpen} />
      <DeleteDialog
        deleteWhat="Email Alert"
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={deleteEmailAlert}
      />
    </div>
  );
}
