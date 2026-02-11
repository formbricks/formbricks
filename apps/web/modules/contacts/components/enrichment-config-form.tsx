"use client";

import { PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/modules/ui/components/alert";
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
import { validateEnrichmentConfig } from "../lib/contact-enrichment";
import { TEnrichmentConfig } from "../types/enrichment";

interface EnrichmentConfigFormProps {
  csvColumns: string[];
  onConfigChange: (config: TEnrichmentConfig | null) => void;
  initialConfig?: TEnrichmentConfig;
}

export const EnrichmentConfigForm = ({
  csvColumns,
  onConfigChange,
  initialConfig,
}: EnrichmentConfigFormProps) => {
  const [enabled, setEnabled] = useState(!!initialConfig);
  const [apiUrl, setApiUrl] = useState(initialConfig?.apiUrl ?? "");
  const [apiMethod, setApiMethod] = useState<"GET" | "POST">(initialConfig?.apiMethod ?? "GET");
  const [authType, setAuthType] = useState<"none" | "bearer" | "apiKey" | "basic">(
    initialConfig?.authType ?? "none"
  );
  const [authValue, setAuthValue] = useState(initialConfig?.authValue ?? "");
  const [lookupColumn, setLookupColumn] = useState(initialConfig?.lookupColumn ?? "");
  const [requestBodyTemplate, setRequestBodyTemplate] = useState(initialConfig?.requestBodyTemplate ?? "");
  const [responseMapping, setResponseMapping] = useState<Record<string, string>>(
    initialConfig?.responseMapping ?? {}
  );
  const [errors, setErrors] = useState<string[]>([]);

  const handleEnableToggle = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      onConfigChange(null);
      setErrors([]);
    }
  };

  const handleValidateAndUpdate = () => {
    const config: Partial<TEnrichmentConfig> = {
      apiUrl,
      apiMethod,
      authType,
      authValue: authType === "none" ? undefined : authValue,
      lookupColumn,
      requestBodyTemplate: apiMethod === "POST" ? requestBodyTemplate : undefined,
      responseMapping,
      timeout: 5000,
    };

    const validation = validateEnrichmentConfig(config);
    setErrors(validation.errors);

    if (validation.valid) {
      onConfigChange(config as TEnrichmentConfig);
    } else {
      onConfigChange(null);
    }
  };

  const addMapping = () => {
    setResponseMapping({ ...responseMapping, "": "" });
  };

  const updateMapping = (oldKey: string, newKey: string, value: string) => {
    const newMapping = { ...responseMapping };
    if (oldKey !== newKey && oldKey in newMapping) {
      delete newMapping[oldKey];
    }
    newMapping[newKey] = value;
    setResponseMapping(newMapping);
  };

  const removeMapping = (key: string) => {
    const newMapping = { ...responseMapping };
    delete newMapping[key];
    setResponseMapping(newMapping);
  };

  return (
    <div className="flex flex-col gap-4 rounded-md border border-slate-300 p-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="enable-enrichment"
          checked={enabled}
          onChange={(e) => handleEnableToggle(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="enable-enrichment" className="font-medium">
          Enable Contact Enrichment from External API
        </Label>
      </div>

      {enabled && (
        <>
          {errors.length > 0 && (
            <Alert variant="error" size="small">
              <ul className="list-disc pl-4">
                {errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="api-url">API URL</Label>
              <Input
                id="api-url"
                type="url"
                placeholder="https://api.example.com/enrich"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                onBlur={handleValidateAndUpdate}
              />
            </div>

            <div>
              <Label htmlFor="api-method">HTTP Method</Label>
              <Select value={apiMethod} onValueChange={(value: "GET" | "POST") => setApiMethod(value)}>
                <SelectTrigger id="api-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="lookup-column">Lookup Column</Label>
              <Select value={lookupColumn} onValueChange={setLookupColumn}>
                <SelectTrigger id="lookup-column">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {csvColumns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="auth-type">Authentication Type</Label>
              <Select
                value={authType}
                onValueChange={(value: "none" | "bearer" | "apiKey" | "basic") => setAuthType(value)}>
                <SelectTrigger id="auth-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="apiKey">API Key</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {authType !== "none" && (
              <div>
                <Label htmlFor="auth-value">
                  {authType === "bearer" && "Bearer Token"}
                  {authType === "apiKey" && "API Key"}
                  {authType === "basic" && "Base64 Credentials"}
                </Label>
                <Input
                  id="auth-value"
                  type="password"
                  placeholder={
                    authType === "basic" ? "Base64(username:password)" : "Enter authentication value"
                  }
                  value={authValue}
                  onChange={(e) => setAuthValue(e.target.value)}
                  onBlur={handleValidateAndUpdate}
                />
              </div>
            )}

            {apiMethod === "POST" && (
              <div className="col-span-2">
                <Label htmlFor="request-body">Request Body Template (optional)</Label>
                <textarea
                  id="request-body"
                  placeholder='{"email": "{{lookupValue}}"}'
                  value={requestBodyTemplate}
                  onChange={(e) => setRequestBodyTemplate(e.target.value)}
                  onBlur={handleValidateAndUpdate}
                  className="w-full rounded-md border border-slate-300 p-2 font-mono text-sm"
                  rows={3}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Use {`{{lookupValue}}`} as placeholder for the lookup value
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Response Field Mapping</Label>
              <Button size="sm" variant="secondary" onClick={addMapping}>
                <PlusIcon className="h-4 w-4" />
                Add Mapping
              </Button>
            </div>
            <p className="mb-2 text-xs text-slate-500">
              Map API response fields to contact attributes. Use dot notation for nested fields (e.g.,
              user.name)
            </p>

            <div className="flex flex-col gap-2">
              {Object.entries(responseMapping).map(([apiField, contactAttr], idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder="API field (e.g., data.firstName)"
                    value={apiField}
                    onChange={(e) => updateMapping(apiField, e.target.value, contactAttr)}
                    onBlur={handleValidateAndUpdate}
                    className="flex-1"
                  />
                  <span className="flex items-center px-2">→</span>
                  <Input
                    placeholder="Contact attribute (e.g., firstName)"
                    value={contactAttr}
                    onChange={(e) => updateMapping(apiField, apiField, e.target.value)}
                    onBlur={handleValidateAndUpdate}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      removeMapping(apiField);
                      handleValidateAndUpdate();
                    }}>
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {Object.keys(responseMapping).length === 0 && (
                <p className="text-center text-sm text-slate-500">No mappings configured</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
