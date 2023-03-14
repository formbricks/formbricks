"use client";

import { AddAlertButton } from "@/components/integrations/AddAlertButton";
import AlertCard from "@/components/integrations/AlertCard";
import IntegrationPageTitle from "@/components/integrations/IntegrationsPageTitle";
import SlackLogo from "@/images/slacklogo.png";
import Image from "next/image";
import AddSlackAlertModal from "./AddSlackAlertModal";
import DeleteDialog from "@/components/shared/DeleteDialog";
import { useState } from "react";

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
    setDeleteDialogOpen(false);
  };

  return (
    <div>
      <IntegrationPageTitle environmentId={params.environmentId} title="Slack Alerts" goBackTo="alerts" />
      <div className="grid grid-cols-3 gap-6">
        <AlertCard
          onDelete={handleDeleteAlertClick}
          onEdit={handleAddAlertClick}
          title={exampleAlert.title}
          description={exampleAlert.description}
          icon={<Image src={SlackLogo} alt="Slack Logo" />}
        />
        <AddAlertButton channel="Slack" onClick={() => handleAddAlertClick()} />
      </div>
      <AddSlackAlertModal open={isAlertModalOpen} setOpen={setAlertModalOpen} />
      <DeleteDialog
        deleteWhat="Email Alert"
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={deleteEmailAlert}
      />
    </div>
  );
}
