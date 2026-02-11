"use client";

import { createId } from "@paralleldrive/cuid2";
import { CheckIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { testExternalAPIConnection } from "@formbricks/surveys/lib/external-api-client";
import type {
  TExternalDataSource,
  TExternalDataSourceAuth,
  TExternalDataSourceFieldMapping,
  TSurveyVariable,
} from "@formbricks/types/surveys/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ExternalDataConfigProps {
  externalDataSources: TExternalDataSource[];
  variables: TSurveyVariable[];
  onUpdate: (externalDataSources: TExternalDataSource[]) => void;
}

export function ExternalDataConfig({ externalDataSources, variables, onUpdate }: ExternalDataConfigProps) {
  const [editingSource, setEditingSource] = useState<TExternalDataSource | null>(null);
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; data?: any } | null>(null);

  const handleAddSource = () => {
    const newSource: TExternalDataSource = {
      id: createId(),
      url: "",
      method: "GET",
      auth: { type: "none" },
      fieldMappings: [],
    };
    setEditingSource(newSource);
  };

  const handleSaveSource = () => {
    if (!editingSource) return;

    const existingIndex = externalDataSources.findIndex((s) => s.id === editingSource.id);
    if (existingIndex >= 0) {
      const updated = [...externalDataSources];
      updated[existingIndex] = editingSource;
      onUpdate(updated);
    } else {
      onUpdate([...externalDataSources, editingSource]);
    }
    setEditingSource(null);
    setTestResult(null);
  };

  const handleCancelEdit = () => {
    setEditingSource(null);
    setTestResult(null);
  };

  const handleDeleteSource = (sourceId: string) => {
    onUpdate(externalDataSources.filter((s) => s.id !== sourceId));
  };

  const handleTestConnection = async (source: TExternalDataSource) => {
    setTestingSourceId(source.id);
    setTestResult(null);

    try {
      const result = await testExternalAPIConnection(source, {});
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setTestingSourceId(null);
    }
  };

  const handleAddFieldMapping = () => {
    if (!editingSource) return;

    const newMapping: TExternalDataSourceFieldMapping = {
      responseField: "",
      variableId: variables[0]?.id || "",
    };

    setEditingSource({
      ...editingSource,
      fieldMappings: [...editingSource.fieldMappings, newMapping],
    });
  };

  const handleRemoveFieldMapping = (index: number) => {
    if (!editingSource) return;

    setEditingSource({
      ...editingSource,
      fieldMappings: editingSource.fieldMappings.filter((_, i) => i !== index),
    });
  };

  const handleUpdateFieldMapping = (
    index: number,
    field: keyof TExternalDataSourceFieldMapping,
    value: string
  ) => {
    if (!editingSource) return;

    const updated = [...editingSource.fieldMappings];
    updated[index] = { ...updated[index], [field]: value };

    setEditingSource({
      ...editingSource,
      fieldMappings: updated,
    });
  };

  const renderAuthConfig = () => {
    if (!editingSource) return null;

    return (
      <div className="space-y-4">
        <div>
          <Label>Authentication Type</Label>
          <Select
            value={editingSource.auth.type}
            onValueChange={(value) => {
              if (value === "none") {
                setEditingSource({ ...editingSource, auth: { type: "none" } });
              } else if (value === "bearer") {
                setEditingSource({ ...editingSource, auth: { type: "bearer", token: "" } });
              } else if (value === "apiKey") {
                setEditingSource({
                  ...editingSource,
                  auth: { type: "apiKey", key: "", value: "", in: "header" },
                });
              }
            }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="bearer">Bearer Token</SelectItem>
              <SelectItem value="apiKey">API Key</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {editingSource.auth.type === "bearer" && (
          <div>
            <Label>Bearer Token</Label>
            <Input
              type="password"
              value={editingSource.auth.token}
              onChange={(e) =>
                setEditingSource({
                  ...editingSource,
                  auth: { type: "bearer", token: e.target.value },
                })
              }
              placeholder="Enter bearer token"
            />
          </div>
        )}

        {editingSource.auth.type === "apiKey" && (
          <>
            <div>
              <Label>API Key Name</Label>
              <Input
                value={editingSource.auth.key}
                onChange={(e) =>
                  setEditingSource({
                    ...editingSource,
                    auth: { ...editingSource.auth, key: e.target.value } as TExternalDataSourceAuth,
                  })
                }
                placeholder="e.g., X-API-Key"
              />
            </div>
            <div>
              <Label>API Key Value</Label>
              <Input
                type="password"
                value={editingSource.auth.value}
                onChange={(e) =>
                  setEditingSource({
                    ...editingSource,
                    auth: { ...editingSource.auth, value: e.target.value } as TExternalDataSourceAuth,
                  })
                }
                placeholder="Enter API key value"
              />
            </div>
            <div>
              <Label>Send Key In</Label>
              <Select
                value={editingSource.auth.in}
                onValueChange={(value: "header" | "query") =>
                  setEditingSource({
                    ...editingSource,
                    auth: { ...editingSource.auth, in: value } as TExternalDataSourceAuth,
                  })
                }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="header">Header</SelectItem>
                  <SelectItem value="query">Query String</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    );
  };

  if (editingSource) {
    return (
      <div className="space-y-6 rounded-lg border p-6">
        <h3 className="text-lg font-medium">
          {externalDataSources.find((s) => s.id === editingSource.id)
            ? "Edit External Data Source"
            : "Add External Data Source"}
        </h3>

        <div className="space-y-4">
          <div>
            <Label>URL</Label>
            <Input
              value={editingSource.url}
              onChange={(e) => setEditingSource({ ...editingSource, url: e.target.value })}
              placeholder="https://api.example.com/data"
            />
          </div>

          <div>
            <Label>HTTP Method</Label>
            <Select
              value={editingSource.method}
              onValueChange={(value: "GET" | "POST") =>
                setEditingSource({ ...editingSource, method: value })
              }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {renderAuthConfig()}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Field Mappings</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddFieldMapping}>
                <PlusIcon className="mr-1 h-4 w-4" />
                Add Mapping
              </Button>
            </div>

            <div className="space-y-2">
              {editingSource.fieldMappings.map((mapping, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Response Field Path</Label>
                    <Input
                      value={mapping.responseField}
                      onChange={(e) => handleUpdateFieldMapping(index, "responseField", e.target.value)}
                      placeholder="e.g., data.user.name"
                      size="sm"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Map to Variable</Label>
                    <Select
                      value={mapping.variableId}
                      onValueChange={(value) => handleUpdateFieldMapping(index, "variableId", value)}>
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {variables.map((variable) => (
                          <SelectItem key={variable.id} value={variable.id}>
                            {variable.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFieldMapping(index)}>
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {editingSource.fieldMappings.length === 0 && (
              <p className="text-sm text-gray-500">No field mappings configured</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleTestConnection(editingSource)}
              disabled={!editingSource.url || testingSourceId === editingSource.id}>
              {testingSourceId === editingSource.id ? "Testing..." : "Test Connection"}
            </Button>

            {testResult && (
              <div className="flex items-center gap-1">
                {testResult.success ? (
                  <>
                    <CheckIcon className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">Connection successful</span>
                  </>
                ) : (
                  <>
                    <XIcon className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-600">{testResult.error}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCancelEdit}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSaveSource}
            disabled={!editingSource.url || editingSource.fieldMappings.length === 0}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">External Data Sources</h3>
        <Button type="button" variant="outline" size="sm" onClick={handleAddSource}>
          <PlusIcon className="mr-1 h-4 w-4" />
          Add Data Source
        </Button>
      </div>

      {externalDataSources.length === 0 ? (
        <p className="text-sm text-gray-500">
          No external data sources configured. Add one to enable mid-survey API lookups.
        </p>
      ) : (
        <div className="space-y-2">
          {externalDataSources.map((source) => (
            <div key={source.id} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <div className="font-medium">{source.url}</div>
                <div className="text-sm text-gray-500">
                  {source.method} • {source.auth.type} auth • {source.fieldMappings.length} field mappings
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingSource(source)}>
                  Edit
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteSource(source.id)}>
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
