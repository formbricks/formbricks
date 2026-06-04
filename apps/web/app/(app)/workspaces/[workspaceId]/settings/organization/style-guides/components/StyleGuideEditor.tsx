"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import z from "zod";
import { StyleGuide, ZStyleGuideUpdate } from "@formbricks/types/style-guide";
import { Button } from "@formbricks/ui/components/Button";
import { Label } from "@formbricks/ui/components/Label";
import { Input } from "@formbricks/ui/components/input";
import { updateStyleGuideAction } from "../actions";

interface StyleGuideEditorProps {
  styleGuide: StyleGuide;
  workspaceId: string;
  isOwner: boolean;
}

export function StyleGuideEditor({ styleGuide, workspaceId, isOwner }: StyleGuideEditorProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: styleGuide.name,
    brandColor: styleGuide.brandColor || "#000000",
    accentColor: styleGuide.accentColor || "",
    borderRadius: styleGuide.borderRadius || "8px",
    fontSize: styleGuide.fontSize || "16px",
    fontFamily: styleGuide.fontFamily || "sans-serif",
    version: styleGuide.version || "",
    authors: styleGuide.authors || "",
    externalDocumentation: styleGuide.externalDocumentation || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updateData = ZStyleGuideUpdate.parse({
        name: formData.name,
        brandColor: formData.brandColor || undefined,
        accentColor: formData.accentColor || undefined,
        borderRadius: formData.borderRadius || undefined,
        fontSize: formData.fontSize || undefined,
        fontFamily: formData.fontFamily || undefined,
        version: formData.version || undefined,
        authors: formData.authors || undefined,
        externalDocumentation: formData.externalDocumentation || undefined,
      });

      await updateStyleGuideAction(styleGuide.id, updateData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    } catch (err) {
      const errorMessage =
        err instanceof z.ZodError
          ? err.errors.map((e) => e.message).join(", ")
          : err instanceof Error
            ? err.message
            : "Failed to save style guide";
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/workspaces/${workspaceId}/settings/organization/style-guides`}>
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Edit Style Guide</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main editing area */}
        <div className="space-y-6 lg:col-span-2">
          {/* Basic Info */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Basic Information</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Style Guide Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  disabled={!isOwner || isSaving}
                  placeholder="e.g., Brand Kit 2024"
                />
              </div>

              <div>
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => handleChange("version", e.target.value)}
                  disabled={!isOwner || isSaving}
                  placeholder="e.g., 1.0.0"
                />
              </div>

              <div>
                <Label htmlFor="authors">Authors</Label>
                <Input
                  id="authors"
                  value={formData.authors}
                  onChange={(e) => handleChange("authors", e.target.value)}
                  disabled={!isOwner || isSaving}
                  placeholder="e.g., Design Team"
                />
              </div>

              <div>
                <Label htmlFor="documentation">External Documentation</Label>
                <Input
                  id="documentation"
                  type="url"
                  value={formData.externalDocumentation}
                  onChange={(e) => handleChange("externalDocumentation", e.target.value)}
                  disabled={!isOwner || isSaving}
                  placeholder="https://example.com/docs"
                />
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Colors</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="brandColor">Brand Color</Label>
                <div className="flex gap-2">
                  <input
                    id="brandColor"
                    type="color"
                    value={formData.brandColor}
                    onChange={(e) => handleChange("brandColor", e.target.value)}
                    disabled={!isOwner || isSaving}
                    className="h-10 w-20 rounded border border-slate-300"
                  />
                  <Input
                    value={formData.brandColor}
                    onChange={(e) => handleChange("brandColor", e.target.value)}
                    disabled={!isOwner || isSaving}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="accentColor">Accent Color (Optional)</Label>
                <div className="flex gap-2">
                  <input
                    id="accentColor"
                    type="color"
                    value={formData.accentColor}
                    onChange={(e) => handleChange("accentColor", e.target.value)}
                    disabled={!isOwner || isSaving}
                    className="h-10 w-20 rounded border border-slate-300"
                  />
                  <Input
                    value={formData.accentColor}
                    onChange={(e) => handleChange("accentColor", e.target.value)}
                    disabled={!isOwner || isSaving}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Typography */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Typography</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="fontFamily">Font Family</Label>
                <Input
                  id="fontFamily"
                  value={formData.fontFamily}
                  onChange={(e) => handleChange("fontFamily", e.target.value)}
                  disabled={!isOwner || isSaving}
                  placeholder="e.g., Helvetica, Arial"
                />
              </div>

              <div>
                <Label htmlFor="fontSize">Font Size</Label>
                <Input
                  id="fontSize"
                  value={formData.fontSize}
                  onChange={(e) => handleChange("fontSize", e.target.value)}
                  disabled={!isOwner || isSaving}
                  placeholder="e.g., 16px"
                />
              </div>
            </div>
          </div>

          {/* Spacing */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Spacing & Sizing</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="borderRadius">Border Radius</Label>
                <Input
                  id="borderRadius"
                  value={formData.borderRadius}
                  onChange={(e) => handleChange("borderRadius", e.target.value)}
                  disabled={!isOwner || isSaving}
                  placeholder="e.g., 8px"
                />
              </div>
            </div>
          </div>

          {/* Messages */}
          {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          {success && (
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
              Style guide saved successfully
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Preview</h2>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Brand Color
                </p>
                <div
                  className="h-12 rounded border border-slate-200"
                  style={{ backgroundColor: formData.brandColor }}
                />
                <p className="mt-1 text-xs text-slate-600">{formData.brandColor}</p>
              </div>

              {formData.accentColor && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Accent Color
                  </p>
                  <div
                    className="h-12 rounded border border-slate-200"
                    style={{ backgroundColor: formData.accentColor }}
                  />
                  <p className="mt-1 text-xs text-slate-600">{formData.accentColor}</p>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Typography Sample
                </p>
                <p
                  style={{
                    fontFamily: formData.fontFamily,
                    fontSize: formData.fontSize,
                  }}
                  className="text-slate-900">
                  The quick brown fox
                </p>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Button Sample
                </p>
                <button
                  style={{
                    backgroundColor: formData.brandColor,
                    borderRadius: formData.borderRadius,
                    fontFamily: formData.fontFamily,
                    fontSize: formData.fontSize,
                  }}
                  className="w-full px-4 py-2 font-semibold text-white">
                  Sample Button
                </button>
              </div>
            </div>
          </div>

          {isOwner && (
            <div className="mt-6">
              <Button onClick={handleSave} disabled={isSaving} className="w-full">
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
