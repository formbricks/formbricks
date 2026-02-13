"use client";

import { createId } from "@paralleldrive/cuid2";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  InfoIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  TExternalDataSource,
  TExternalDataSourceAuth,
  TExternalDataSourceFieldMapping,
  TSurveyVariable,
} from "@formbricks/types/surveys/types";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface QueryConfigItem {
  id: string;
  name: string;
  description?: string;
  sql: string;
  parameters: string[];
  fields: Record<string, string>;
  cache?: { enabled: boolean; ttl?: number };
}

interface ExternalDataConfigProps {
  externalDataSources: TExternalDataSource[];
  variables: TSurveyVariable[];
  onUpdate: (externalDataSources: TExternalDataSource[]) => void;
  environmentId: string;
}

type SourceMode = "custom" | "snowflake";

async function testConnection(
  source: TExternalDataSource
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    let url = source.url;
    const headers: Record<string, string> = { "Content-Type": "application/json", ...source.headers };

    if (source.auth.type === "bearer") {
      headers["Authorization"] = `Bearer ${source.auth.token}`;
    } else if (source.auth.type === "apiKey") {
      if (source.auth.in === "header") {
        headers[source.auth.key] = source.auth.value;
      } else {
        const urlObj = new URL(url);
        urlObj.searchParams.append(source.auth.key, source.auth.value);
        url = urlObj.toString();
      }
    }

    const response = await fetch(url, { method: source.method, headers });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractSqlParams(sql: string): string[] {
  const matches = sql.match(/:([a-zA-Z_]\w*)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

export function ExternalDataConfig({
  externalDataSources,
  variables,
  onUpdate,
  environmentId,
}: ExternalDataConfigProps) {
  const [editingSource, setEditingSource] = useState<TExternalDataSource | null>(null);
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; data?: any } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Snowflake query mode state
  const [sourceMode, setSourceMode] = useState<SourceMode>("custom");
  const [availableQueries, setAvailableQueries] = useState<QueryConfigItem[]>([]);
  const [loadingQueries, setLoadingQueries] = useState(false);
  const [selectedQueryId, setSelectedQueryId] = useState<string>("");
  const [showCreateQuery, setShowCreateQuery] = useState(false);
  const [newQuery, setNewQuery] = useState({
    id: "",
    name: "",
    description: "",
    sql: "",
    fields: {} as Record<string, string>,
  });
  const [newQueryFieldKey, setNewQueryFieldKey] = useState("");
  const [newQueryFieldValue, setNewQueryFieldValue] = useState("");
  const [savingQuery, setSavingQuery] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const fetchQueries = useCallback(async (apiKey: string) => {
    setLoadingQueries(true);
    try {
      const response = await fetch("/api/query/config", {
        headers: { "X-API-Key": apiKey },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAvailableQueries(data.queries);
        }
      }
    } catch {
      // Queries not available - user may not have Snowflake configured
    } finally {
      setLoadingQueries(false);
    }
  }, []);

  // When switching to snowflake mode, try to fetch queries using the current auth key
  const authValue = editingSource?.auth.type === "apiKey" ? editingSource.auth.value : null;
  useEffect(() => {
    if (sourceMode === "snowflake" && authValue) {
      fetchQueries(authValue);
    }
  }, [sourceMode, authValue, fetchQueries]);

  const handleAddSource = () => {
    const newSource: TExternalDataSource = {
      id: createId(),
      url: "",
      method: "GET",
      auth: { type: "none" },
      fieldMappings: [],
    };
    setEditingSource(newSource);
    setSourceMode("custom");
    setSelectedQueryId("");
    setShowCreateQuery(false);
    setQueryError(null);
  };

  const handleAddSnowflakeSource = () => {
    const newSource: TExternalDataSource = {
      id: createId(),
      url: "",
      method: "GET",
      auth: { type: "apiKey", key: "X-API-Key", value: "", in: "header" },
      fieldMappings: [],
    };
    setEditingSource(newSource);
    setSourceMode("snowflake");
    setSelectedQueryId("");
    setShowCreateQuery(false);
    setQueryError(null);
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
    setSourceMode("custom");
  };

  const handleCancelEdit = () => {
    setEditingSource(null);
    setTestResult(null);
    setSourceMode("custom");
    setShowCreateQuery(false);
    setQueryError(null);
  };

  const handleDeleteSource = (sourceId: string) => {
    onUpdate(externalDataSources.filter((s) => s.id !== sourceId));
  };

  const handleTestConnection = async (source: TExternalDataSource) => {
    setTestingSourceId(source.id);
    setTestResult(null);

    try {
      const result = await testConnection(source);
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

  const handleSelectQuery = (queryId: string) => {
    if (!editingSource) return;

    const query = availableQueries.find((q) => q.id === queryId);
    if (!query) return;

    setSelectedQueryId(queryId);
    applyQueryToSource(query);
  };

  const applyQueryToSource = (query: QueryConfigItem) => {
    if (!editingSource) return;

    // Auto-generate field mappings from the query's fields config
    const fieldMappings: TExternalDataSourceFieldMapping[] = Object.entries(query.fields).map(
      ([friendlyName]) => {
        // Try to match to an existing variable by name
        const matchingVariable = variables.find((v) => v.name.toLowerCase() === friendlyName.toLowerCase());
        return {
          responseField: `data.${friendlyName}`,
          variableId: matchingVariable?.id || variables[0]?.id || "",
        };
      }
    );

    // Build the URL - use the origin from window.location for the base
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${baseUrl}/api/query/${query.id}`;

    setEditingSource({
      ...editingSource,
      url,
      method: "GET",
      auth:
        editingSource.auth.type === "apiKey"
          ? editingSource.auth
          : { type: "apiKey", key: "X-API-Key", value: "", in: "header" },
      fieldMappings,
      queryId: query.id,
    });
  };

  const handleCreateQuery = async () => {
    if (!editingSource || editingSource.auth.type !== "apiKey") return;

    const params = extractSqlParams(newQuery.sql);

    if (!newQuery.id || !newQuery.name || !newQuery.sql || Object.keys(newQuery.fields).length === 0) {
      setQueryError("Please fill in all required fields: ID, Name, SQL, and at least one output field.");
      return;
    }

    setSavingQuery(true);
    setQueryError(null);

    try {
      const response = await fetch("/api/query/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": editingSource.auth.value,
        },
        body: JSON.stringify({
          id: newQuery.id,
          name: newQuery.name,
          description: newQuery.description,
          sql: newQuery.sql,
          parameters: params,
          fields: newQuery.fields,
          cache: { enabled: true, ttl: 300 },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setQueryError(data.error || "Failed to create query");
        if (data.details) {
          setQueryError(`${data.error}: ${data.details.join(", ")}`);
        }
        return;
      }

      // Refresh queries list and select the new one
      await fetchQueries(editingSource.auth.value);
      setSelectedQueryId(newQuery.id);
      setShowCreateQuery(false);

      // Apply the new query config to the source
      applyQueryToSource({
        id: newQuery.id,
        name: newQuery.name,
        description: newQuery.description,
        sql: newQuery.sql,
        parameters: params,
        fields: newQuery.fields,
        cache: { enabled: true, ttl: 300 },
      });

      // Reset form
      setNewQuery({ id: "", name: "", description: "", sql: "", fields: {} });
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : "Failed to create query");
    } finally {
      setSavingQuery(false);
    }
  };

  const handleAddOutputField = () => {
    if (!newQueryFieldKey || !newQueryFieldValue) return;
    setNewQuery({
      ...newQuery,
      fields: { ...newQuery.fields, [newQueryFieldKey]: newQueryFieldValue },
    });
    setNewQueryFieldKey("");
    setNewQueryFieldValue("");
  };

  const handleRemoveOutputField = (key: string) => {
    const { [key]: _, ...rest } = newQuery.fields;
    setNewQuery({ ...newQuery, fields: rest });
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

  const renderSnowflakeQuerySelector = () => {
    if (!editingSource) return null;

    return (
      <div className="space-y-4">
        <div>
          <Label>API Key (MEMBER_LOOKUP_API_KEY)</Label>
          <Input
            type="password"
            value={editingSource.auth.type === "apiKey" ? editingSource.auth.value : ""}
            onChange={(e) => {
              setEditingSource({
                ...editingSource,
                auth: { type: "apiKey", key: "X-API-Key", value: e.target.value, in: "header" },
              });
              if (e.target.value) {
                fetchQueries(e.target.value);
              }
            }}
            placeholder="Enter your MEMBER_LOOKUP_API_KEY"
          />
          <p className="mt-1 text-xs text-slate-500">
            This is the same key set as the MEMBER_LOOKUP_API_KEY environment variable.
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Select Query</Label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowCreateQuery(!showCreateQuery)}>
              <PlusIcon className="mr-1 h-4 w-4" />
              Create New Query
            </Button>
          </div>

          {loadingQueries ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Loading available queries...
            </div>
          ) : availableQueries.length > 0 ? (
            <Select value={selectedQueryId} onValueChange={handleSelectQuery}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a Snowflake query..." />
              </SelectTrigger>
              <SelectContent>
                {availableQueries.map((query) => (
                  <SelectItem key={query.id} value={query.id}>
                    <span className="font-medium">{query.name}</span>
                    {query.description && (
                      <span className="ml-2 text-xs text-slate-500">- {query.description}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-slate-500">
              {editingSource.auth.type === "apiKey" && editingSource.auth.value
                ? "No queries found. Create one below or check your API key."
                : "Enter your API key above to load available queries."}
            </p>
          )}
        </div>

        {showCreateQuery && renderCreateQueryForm()}
      </div>
    );
  };

  const renderCreateQueryForm = () => {
    return (
      <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
        <h4 className="font-medium">Create New Snowflake Query</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Query Name</Label>
            <Input
              value={newQuery.name}
              onChange={(e) => {
                setNewQuery({
                  ...newQuery,
                  name: e.target.value,
                  id: generateSlug(e.target.value),
                });
              }}
              placeholder="e.g., Member Lookup"
            />
          </div>
          <div>
            <Label>Query ID (slug)</Label>
            <Input
              value={newQuery.id}
              onChange={(e) =>
                setNewQuery({ ...newQuery, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
              }
              placeholder="e.g., member-lookup"
            />
          </div>
        </div>

        <div>
          <Label>Description (optional)</Label>
          <Input
            value={newQuery.description}
            onChange={(e) => setNewQuery({ ...newQuery, description: e.target.value })}
            placeholder="Brief description of what this query does"
          />
        </div>

        <div>
          <Label>SQL Template</Label>
          <textarea
            className="w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
            rows={4}
            value={newQuery.sql}
            onChange={(e) => setNewQuery({ ...newQuery, sql: e.target.value })}
            placeholder="SELECT first_name, last_name, email FROM members WHERE record_number = :recordNumber LIMIT 1"
          />
          <p className="mt-1 text-xs text-slate-500">
            Use <code className="rounded bg-slate-200 px-1">:paramName</code> syntax for parameters (e.g.,{" "}
            <code className="rounded bg-slate-200 px-1">:recordNumber</code>).
            {newQuery.sql && (
              <>
                {" "}
                Detected parameters: <strong>{extractSqlParams(newQuery.sql).join(", ") || "none"}</strong>
              </>
            )}
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Output Fields</Label>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Map friendly field names to SQL column names. These will be available in field mappings.
          </p>

          {Object.entries(newQuery.fields).map(([key, value]) => (
            <div key={key} className="mb-2 flex items-center gap-2">
              <span className="flex-1 rounded border bg-white px-2 py-1.5 text-sm">{key}</span>
              <span className="text-slate-400">&rarr;</span>
              <span className="flex-1 rounded border bg-white px-2 py-1.5 font-mono text-sm">{value}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveOutputField(key)}>
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Friendly Name</Label>
              <Input
                value={newQueryFieldKey}
                onChange={(e) => setNewQueryFieldKey(e.target.value)}
                placeholder="e.g., firstName"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">SQL Column</Label>
              <Input
                value={newQueryFieldValue}
                onChange={(e) => setNewQueryFieldValue(e.target.value)}
                placeholder="e.g., first_name"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddOutputField}
              disabled={!newQueryFieldKey || !newQueryFieldValue}>
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {queryError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{queryError}</div>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowCreateQuery(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleCreateQuery} disabled={savingQuery}>
            {savingQuery ? (
              <>
                <Loader2Icon className="mr-1 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Create Query"
            )}
          </Button>
        </div>
      </div>
    );
  };

  const renderFieldMappings = () => {
    if (!editingSource) return null;

    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Field Mappings</Label>
          <Button type="button" variant="secondary" size="sm" onClick={handleAddFieldMapping}>
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
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Map to Variable</Label>
                <Select
                  value={mapping.variableId}
                  onValueChange={(value) => handleUpdateFieldMapping(index, "variableId", value)}>
                  <SelectTrigger>
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
              <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveFieldMapping(index)}>
                <Trash2Icon className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {editingSource.fieldMappings.length === 0 && (
          <p className="text-sm text-gray-500">No field mappings configured</p>
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

        {/* Source type toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={sourceMode === "custom" ? "default" : "secondary"}
            size="sm"
            onClick={() => setSourceMode("custom")}>
            Custom URL
          </Button>
          <Button
            type="button"
            variant={sourceMode === "snowflake" ? "default" : "secondary"}
            size="sm"
            onClick={() => {
              setSourceMode("snowflake");
              // Pre-fill API key auth if not already set
              if (editingSource.auth.type !== "apiKey") {
                setEditingSource({
                  ...editingSource,
                  auth: { type: "apiKey", key: "X-API-Key", value: "", in: "header" },
                });
              }
            }}>
            <DatabaseIcon className="mr-1 h-4 w-4" />
            Snowflake Query
          </Button>
        </div>

        <div className="space-y-4">
          {sourceMode === "snowflake" ? (
            <>
              {renderSnowflakeQuerySelector()}

              {/* Show auto-configured URL (read-only when in Snowflake mode) */}
              {editingSource.url && (
                <div>
                  <Label>Auto-configured URL</Label>
                  <Input value={editingSource.url} readOnly className="bg-slate-50 text-slate-600" />
                </div>
              )}

              {renderFieldMappings()}
            </>
          ) : (
            <>
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
              {renderFieldMappings()}
            </>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
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
          <Button type="button" variant="secondary" onClick={handleCancelEdit}>
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
      {/* Inline help section */}
      <Alert variant="info">
        <AlertTitle>
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setShowHelp(!showHelp)}>
            <span className="flex items-center gap-1">
              <InfoIcon className="h-4 w-4" />
              External Data Sources - Quick Start
            </span>
            {showHelp ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </button>
        </AlertTitle>
        {showHelp && (
          <AlertDescription>
            <div className="mt-2 space-y-2 text-sm">
              <p>
                External data sources let you fetch data from APIs mid-survey and map responses to variables.
              </p>
              <p className="font-medium">For Snowflake queries:</p>
              <ol className="ml-4 list-decimal space-y-1">
                <li>
                  Set environment variables:{" "}
                  <code className="rounded bg-slate-100 px-1">SNOWFLAKE_ACCOUNT</code>,{" "}
                  <code className="rounded bg-slate-100 px-1">SNOWFLAKE_USERNAME</code>,{" "}
                  <code className="rounded bg-slate-100 px-1">SNOWFLAKE_PASSWORD</code>,{" "}
                  <code className="rounded bg-slate-100 px-1">MEMBER_LOOKUP_API_KEY</code>
                </li>
                <li>Click &quot;Add Snowflake Source&quot; below</li>
                <li>Select an existing query or create a new one</li>
                <li>Map output fields to your survey variables</li>
                <li>Add a logic action to trigger the API call</li>
              </ol>
              <Link
                href={`/environments/${environmentId}/settings/snowflake-guide`}
                className="mt-2 inline-flex items-center gap-1 font-medium text-blue-600 hover:underline">
                View full setup guide
                <ExternalLinkIcon className="h-3 w-3" />
              </Link>
            </div>
          </AlertDescription>
        )}
      </Alert>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">External Data Sources</h3>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleAddSource}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Custom Source
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={handleAddSnowflakeSource}>
            <DatabaseIcon className="mr-1 h-4 w-4" />
            Add Snowflake Source
          </Button>
        </div>
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
                <div className="flex items-center gap-2 font-medium">
                  {source.queryId && <DatabaseIcon className="h-4 w-4 text-slate-500" />}
                  {source.queryId ? `Snowflake: ${source.queryId}` : source.url}
                </div>
                <div className="text-sm text-gray-500">
                  {source.method} • {source.auth.type} auth • {source.fieldMappings.length} field mappings
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditingSource(source);
                    setSourceMode(source.queryId ? "snowflake" : "custom");
                    setSelectedQueryId(source.queryId || "");
                  }}>
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
