import { useTranslation } from "react-i18next";
import { TConnectorWithMappings } from "@formbricks/types/connector";
import { ConnectorsTableDataRow } from "@/app/(app)/environments/[environmentId]/workspace/unify/sources/components/connectors-table-data-row";

interface ConnectorsTableRowsContainerProps {
  connectors: TConnectorWithMappings[];
  onConnectorClick: (connector: TConnectorWithMappings) => void;
  onDuplicate: (connector: TConnectorWithMappings) => Promise<void>;
  onToggleStatus: (connector: TConnectorWithMappings) => Promise<void>;
  onDelete: (connectorId: string) => Promise<void>;
}

export const ConnectorsTableRowsContainer = ({
  connectors,
  onConnectorClick,
  onDuplicate,
  onToggleStatus,
  onDelete,
}: ConnectorsTableRowsContainerProps) => {
  const { t } = useTranslation();

  if (connectors.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-slate-500">{t("environments.unify.no_sources_connected")}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {connectors.map((connector) => (
        <ConnectorsTableDataRow
          key={connector.id}
          connector={connector}
          onEdit={() => onConnectorClick(connector)}
          onDuplicate={() => onDuplicate(connector)}
          onToggleStatus={() => onToggleStatus(connector)}
          onDelete={() => onDelete(connector.id)}
        />
      ))}
    </div>
  );
};
