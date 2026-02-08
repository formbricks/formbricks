"use client";

import { createId } from "@paralleldrive/cuid2";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TIntegrationInput } from "@formbricks/types/integration";
import {
  TIntegrationNotion,
  TIntegrationNotionConfigData,
  TIntegrationNotionDatabase,
} from "@formbricks/types/integration/notion";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { createOrUpdateIntegrationAction } from "@/app/(app)/environments/[environmentId]/workspace/integrations/actions";
import {
  MappingRow,
  TMapping,
  createEmptyMapping,
} from "@/app/(app)/environments/[environmentId]/workspace/integrations/notion/components/MappingRow";
import NotionLogo from "@/images/notion.png";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { recallToHeadline } from "@/lib/utils/recall";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { DropdownSelector } from "@/modules/ui/components/dropdown-selector";
import { Label } from "@/modules/ui/components/label";

interface AddIntegrationModalProps {
  environmentId: string;
  surveys: TSurvey[];
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  notionIntegration: TIntegrationNotion;
  databases: TIntegrationNotionDatabase[];
  selectedIntegration: (TIntegrationNotionConfigData & { index: number }) | null;
}

export const AddIntegrationModal = ({
  environmentId,
  surveys,
  open,
  setOpen,
  notionIntegration,
  databases,
  selectedIntegration,
}: AddIntegrationModalProps) => {
  const { t } = useTranslation();
  const { handleSubmit } = useForm();
  const [selectedDatabase, setSelectedDatabase] = useState<TIntegrationNotionDatabase | null>();
  const [selectedSurvey, setSelectedSurvey] = useState<TSurvey | null>(null);
  const [mapping, setMapping] = useState<TMapping[]>([createEmptyMapping()]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isLinkingDatabase, setIsLinkingDatabase] = useState(false);
  const integrationData = {
    databaseId: "",
    databaseName: "",
    surveyId: "",
    surveyName: "",
    mapping: [
      {
        column: { id: "", name: "", type: "" },
        element: { id: "", name: "", type: "" },
      },
    ],
    createdAt: new Date(),
  };

  const elements = useMemo(
    () => (selectedSurvey ? getElementsFromBlocks(selectedSurvey.blocks) : []),
    [selectedSurvey]
  );

  const notionIntegrationData: TIntegrationInput = {
    type: "notion",
    config: {
      key: notionIntegration?.config?.key,
      data: notionIntegration.config?.data || [],
    },
  };

  const hasMatchingId = notionIntegration.config.data.some((configData) => {
    if (!selectedDatabase) {
      return false;
    }
    return configData.databaseId === selectedDatabase.id;
  });

  const dbItems = useMemo(() => {
    const dbProperties = (selectedDatabase as any)?.properties;
    return (
      Object.keys(dbProperties || {}).map((fieldKey: string) => ({
        id: dbProperties[fieldKey].id,
        name: dbProperties[fieldKey].name,
        type: dbProperties[fieldKey].type,
      })) || []
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatabase?.id]);

  const elementItems = useMemo(() => {
    const mappedElements = selectedSurvey
      ? elements.map((el) => ({
          id: el.id,
          name: getTextContent(recallToHeadline(el.headline, selectedSurvey, false, "default")["default"]),
          type: el.type,
        }))
      : [];

    const variables =
      selectedSurvey?.variables.map((variable) => ({
        id: variable.id,
        name: variable.name,
        type: TSurveyElementTypeEnum.OpenText,
      })) || [];

    const hiddenFields =
      selectedSurvey?.hiddenFields.fieldIds?.map((fId) => ({
        id: fId,
        name: `${t("common.hidden_field")} : ${fId}`,
        type: TSurveyElementTypeEnum.OpenText,
      })) || [];
    const Metadata = [
      {
        id: "metadata",
        name: t("common.metadata"),
        type: TSurveyElementTypeEnum.OpenText,
      },
    ];
    const createdAt = [
      {
        id: "createdAt",
        name: t("common.created_at"),
        type: TSurveyElementTypeEnum.Date,
      },
    ];

    return [...mappedElements, ...variables, ...hiddenFields, ...Metadata, ...createdAt];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSurvey?.id]);

  useEffect(() => {
    if (selectedIntegration) {
      const selectedDB = databases.find((db) => db.id === selectedIntegration.databaseId)!;
      if (selectedDB) {
        setSelectedDatabase({
          id: selectedDB.id,
          name: (selectedDB as any).title?.[0]?.plain_text,
          properties: selectedDB.properties,
        });
      }
      setSelectedSurvey(
        surveys.find((survey) => {
          return survey.id === selectedIntegration.surveyId;
        })!
      );
      setMapping(selectedIntegration.mapping.map((m) => ({ ...m, id: createId() })));
      return;
    }
    resetForm();
  }, [selectedIntegration, surveys, databases]);

  const linkDatabase = async () => {
    try {
      if (!selectedDatabase) {
        throw new Error(t("environments.integrations.notion.please_select_a_database"));
      }
      if (!selectedSurvey) {
        throw new Error(t("environments.integrations.please_select_a_survey_error"));
      }

      if (mapping.length === 1 && (!mapping[0].element.id || !mapping[0].column.id)) {
        throw new Error(t("environments.integrations.notion.please_select_at_least_one_mapping"));
      }

      if (mapping.filter((m) => m.error).length > 0) {
        throw new Error(t("environments.integrations.notion.please_resolve_mapping_errors"));
      }

      if (
        mapping.filter((m) => m.column.id && !m.element.id).length >= 1 ||
        mapping.filter((m) => m.element.id && !m.column.id).length >= 1
      ) {
        throw new Error(
          t("environments.integrations.notion.please_complete_mapping_fields_with_notion_property")
        );
      }

      setIsLinkingDatabase(true);

      integrationData.databaseId = selectedDatabase.id;
      integrationData.databaseName = selectedDatabase.name;
      integrationData.surveyId = selectedSurvey.id;
      integrationData.surveyName = selectedSurvey.name;
      integrationData.mapping = mapping.map((m) => {
        delete m.error;
        return m;
      });
      integrationData.createdAt = new Date();

      if (selectedIntegration) {
        // update action
        notionIntegrationData.config.data[selectedIntegration.index] = integrationData;
      } else {
        // create action
        notionIntegrationData.config.data.push(integrationData);
      }

      const result = await createOrUpdateIntegrationAction({
        environmentId,
        integrationData: notionIntegrationData,
      });
      if (result?.serverError) {
        toast.error(getFormattedErrorMessage(result));
        return;
      }
      if (selectedIntegration) {
        toast.success(t("environments.integrations.integration_updated_successfully"));
      } else {
        toast.success(t("environments.integrations.integration_added_successfully"));
      }
      resetForm();
      setOpen(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsLinkingDatabase(false);
    }
  };

  const deleteLink = async () => {
    notionIntegrationData.config.data.splice(selectedIntegration!.index, 1);
    try {
      setIsDeleting(true);
      const result = await createOrUpdateIntegrationAction({
        environmentId,
        integrationData: notionIntegrationData,
      });
      if (result?.serverError) {
        toast.error(getFormattedErrorMessage(result));
        return;
      }
      toast.success(t("environments.integrations.integration_removed_successfully"));
      setOpen(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setIsLinkingDatabase(false);
    setSelectedDatabase(null);
    setSelectedSurvey(null);
  };
  const getFilteredElementItems = (selectedIdx: number) => {
    const selectedElementIds = new Set(
      mapping.filter((_, idx) => idx !== selectedIdx).map((m) => m.element.id)
    );
    return elementItems.filter((el) => !selectedElementIds.has(el.id));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-4 flex items-start space-x-2">
            <div className="relative size-8">
              <Image
                fill
                className="object-contain object-center"
                src={NotionLogo}
                alt={t("environments.integrations.notion.notion_logo")}
              />
            </div>
            <div className="space-y-0.5">
              <DialogTitle>{t("environments.integrations.notion.link_notion_database")}</DialogTitle>
              <DialogDescription>
                {t("environments.integrations.notion.notion_integration_description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(linkDatabase)} className="contents space-y-4">
          <DialogBody>
            <div className="w-full space-y-4">
              <div>
                <div className="mb-4">
                  <DropdownSelector
                    label={t("environments.integrations.notion.select_a_database")}
                    items={databases.map((d) => ({
                      id: d.id,
                      name: (d as any).title?.[0]?.plain_text,
                      properties: d.properties,
                    }))}
                    selectedItem={selectedDatabase}
                    setSelectedItem={setSelectedDatabase}
                    disabled={databases.length === 0}
                  />
                  {selectedDatabase && hasMatchingId && (
                    <p className="text-xs text-amber-700">
                      <strong>{t("common.warning")}:</strong>{" "}
                      {t("environments.integrations.notion.duplicate_connection_warning")}
                    </p>
                  )}
                  <p className="m-1 text-xs text-slate-500">
                    {databases.length === 0 &&
                      t(
                        "environments.integrations.notion.create_at_least_one_database_to_setup_this_integration"
                      )}
                  </p>
                </div>
                <div className="mb-4">
                  <DropdownSelector
                    label={t("common.select_survey")}
                    items={surveys}
                    selectedItem={selectedSurvey}
                    setSelectedItem={setSelectedSurvey}
                    disabled={surveys.length === 0}
                  />
                  <p className="m-1 text-xs text-slate-500">
                    {surveys.length === 0 && t("environments.integrations.create_survey_warning")}
                  </p>
                </div>
                {selectedDatabase && selectedSurvey && (
                  <div>
                    <Label>
                      {t("environments.integrations.notion.map_formbricks_fields_to_notion_property")}
                    </Label>
                    <div className="mt-1 space-y-2 overflow-y-auto">
                      {mapping.map((m, idx) => (
                        <MappingRow
                          key={m.id}
                          idx={idx}
                          mapping={mapping}
                          setMapping={setMapping}
                          filteredElementItems={getFilteredElementItems(idx)}
                          dbItems={dbItems}
                          elementItems={elementItems}
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            {selectedIntegration ? (
              <Button
                type="button"
                variant="destructive"
                loading={isDeleting}
                onClick={() => {
                  deleteLink();
                }}>
                {t("common.delete")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                  setMapping([]);
                }}>
                {t("common.cancel")}
              </Button>
            )}
            <Button
              type="submit"
              loading={isLinkingDatabase}
              disabled={mapping.filter((m) => m.error).length > 0}>
              {selectedIntegration ? t("common.update") : t("environments.integrations.notion.link_database")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
