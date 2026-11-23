"use client";

import { GripVerticalIcon, SettingsIcon, XIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  MAX_IMAGE_BLOCK_ALT_LENGTH,
  MAX_TEXT_BLOCK_DESCRIPTION_LENGTH,
  MAX_TEXT_BLOCK_HEADLINE_LENGTH,
  type TDashboardImageContent,
  type TDashboardTextContent,
} from "@formbricks/types/analysis";
import { cn } from "@/lib/cn";
import { getChartApiErrorMessage, uploadDashboardImage } from "@/modules/ee/analysis/lib/api-client";
import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { FileDropZone } from "@/modules/ui/components/file-drop-zone";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { Separator } from "@/modules/ui/components/separator";
import { TabToggle } from "@/modules/ui/components/tab-toggle";

/** The image types an image block takes, as the file picker offers them. */
const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.svg,.webp,.gif";

/**
 * The card's own height outside its content: the 1px border on both sides and the 16px padding. What a
 * block reports for auto-height is its content plus this, the height its grid cell must have.
 */
const CARD_CHROME_PX = 2 + 32;

/**
 * Reports the height `ref`'s element needs whenever it changes: its content's size depends on the
 * block's width (text wraps, an image scales), never on its height, so measuring cannot feed back.
 */
const useReportHeight = (onMeasure: ((px: number) => void) | undefined) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !onMeasure || typeof ResizeObserver === "undefined") return;
    const report = () => onMeasure(element.offsetHeight + CARD_CHROME_PX);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onMeasure]);
  return ref;
};

interface BlockFrameProps {
  isEditing: boolean;
  /** The card frame (white, bordered, rounded) is drawn always, or only while editing (a separator). */
  frame: "always" | "editing";
  controls?: ReactNode;
  children: ReactNode;
}

/** The chart card's frame without its header: a grip and controls float over it while editing. */
function BlockFrame({ isEditing, frame, controls, children }: Readonly<BlockFrameProps>) {
  const { t } = useTranslation();
  const framed = frame === "always" || isEditing;
  return (
    <div
      className={cn(
        "group relative h-full rounded-lg",
        framed && "border border-gray-200 bg-white shadow-xs",
        isEditing && "ring-2 ring-brand-dark/20 transition-shadow hover:ring-brand-dark/40"
      )}>
      {isEditing && (
        <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5 rounded-md bg-white/90 opacity-0 shadow-xs transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            aria-label={t("workspace.analysis.dashboards.move_block")}
            className="rgl-drag-handle flex cursor-grab items-center rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing">
            <GripVerticalIcon className="size-4" />
          </button>
          {controls}
        </div>
      )}
      {children}
    </div>
  );
}

const RemoveBlockButton = ({ onClick }: Readonly<{ onClick: () => void }>) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-label={t("workspace.analysis.dashboards.remove_block")}
      className="flex items-center rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}>
      <XIcon className="size-4" />
    </button>
  );
};

/** × on a block with something in it: removing it asks first. */
function ConfirmRemoveBlock({ onRemove }: Readonly<{ onRemove: () => void }>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <RemoveBlockButton onClick={() => setOpen(true)} />
      <ConfirmationModal
        open={open}
        setOpen={setOpen}
        title={t("workspace.analysis.dashboards.remove_block_title")}
        body={t("workspace.analysis.dashboards.remove_block_confirmation")}
        buttonText={t("common.remove")}
        cancelButtonText={t("common.cancel")}
        onConfirm={() => {
          setOpen(false);
          onRemove();
        }}
      />
    </>
  );
}

// ── Image ───────────────────────────────────────────────────────────────────────────────────────

const IMAGE_POSITION_CLASS: Record<TDashboardImageContent["position"], string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

function ImageSettings({
  content,
  onChange,
}: Readonly<{ content: TDashboardImageContent; onChange: (content: TDashboardImageContent) => void }>) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("workspace.analysis.dashboards.image_settings")}
          className="flex items-center rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          onPointerDown={(event) => event.stopPropagation()}>
          <SettingsIcon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div>
          <Label id="image-size-toggle-label">{t("workspace.analysis.dashboards.image_size")}</Label>
          <TabToggle
            id="image-size"
            value={content.fit}
            options={[
              { value: "fit", label: t("workspace.analysis.dashboards.image_fit") },
              { value: "fill", label: t("workspace.analysis.dashboards.image_fill") },
            ]}
            onChange={(fit) => onChange({ ...content, fit })}
          />
        </div>
        <div>
          <Label id="image-position-toggle-label">{t("workspace.analysis.dashboards.image_position")}</Label>
          <TabToggle
            id="image-position"
            value={content.position}
            options={[
              { value: "left", label: t("workspace.analysis.dashboards.image_position_left") },
              { value: "center", label: t("workspace.analysis.dashboards.image_position_center") },
              { value: "right", label: t("workspace.analysis.dashboards.image_position_right") },
            ]}
            onChange={(position) => onChange({ ...content, position })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="image-alt">{t("workspace.analysis.dashboards.image_alt_text")}</Label>
          <Input
            id="image-alt"
            value={content.alt}
            maxLength={MAX_IMAGE_BLOCK_ALT_LENGTH}
            onChange={(event) => onChange({ ...content, alt: event.target.value })}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ImageBlockProps {
  dashboardId: string;
  widgetId: string;
  content: TDashboardImageContent;
  isEditing: boolean;
  onChange: (content: TDashboardImageContent) => void;
  onRemove: () => void;
  onMeasure?: (px: number) => void;
}

/**
 * An image block (ENG-7249). Empty, it is an upload zone; with an image, it shows it fitted or filling
 * the block's width, placed left, centre or right. The file is a private upload of the workspace, served
 * from `/storage/...` to whoever may read it, so the browser fetches it with the viewer's session.
 */
function ImageBlock({
  dashboardId,
  widgetId,
  content,
  isEditing,
  onChange,
  onRemove,
  onMeasure,
}: Readonly<ImageBlockProps>) {
  const { t } = useTranslation();
  const ref = useReportHeight(onMeasure);
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (file: File) => {
    setIsUploading(true);
    try {
      const fileUrl = await uploadDashboardImage(dashboardId, file);
      onChange({ ...content, fileUrl });
    } catch (error) {
      toast.error(getChartApiErrorMessage(error, t("workspace.analysis.dashboards.image_upload_failed")));
    } finally {
      setIsUploading(false);
    }
  };

  const hasImage = content.fileUrl !== null;
  return (
    <BlockFrame
      isEditing={isEditing}
      frame="always"
      controls={
        hasImage ? (
          <>
            <ImageSettings content={content} onChange={onChange} />
            <ConfirmRemoveBlock onRemove={onRemove} />
          </>
        ) : (
          // An empty block has nothing to lose: × removes it without asking.
          <RemoveBlockButton onClick={onRemove} />
        )
      }>
      <div ref={ref} className="p-4">
        {hasImage ? (
          <div
            className={cn("flex", IMAGE_POSITION_CLASS[content.position])}
            // Dropping a new file on an image replaces it.
            onDragOver={(event) => {
              if (isEditing) event.preventDefault();
            }}
            onDrop={(event) => {
              if (!isEditing) return;
              event.preventDefault();
              const file = event.dataTransfer.files[0];
              if (file) void upload(file);
            }}>
            {/* A private storage file: next/image cannot proxy it with the viewer's session. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.fileUrl ?? undefined}
              alt={content.alt}
              className={cn(
                "block max-h-[720px] rounded-md",
                content.fit === "fill" ? "h-auto w-full object-cover" : "h-auto max-w-full object-contain",
                isUploading && "opacity-50"
              )}
            />
          </div>
        ) : null}
        {/* Empty: an upload zone while editing, nothing while viewing. */}
        {!hasImage && isEditing ? (
          <FileDropZone
            id={`image-block-${widgetId}`}
            accept={IMAGE_ACCEPT}
            isLoading={isUploading}
            onFileSelect={upload}
            primaryText={t("workspace.analysis.dashboards.upload_image")}
            helpText={t("workspace.analysis.dashboards.image_types")}
          />
        ) : null}
      </div>
    </BlockFrame>
  );
}

// ── Text ────────────────────────────────────────────────────────────────────────────────────────

/** A textarea as tall as its text, so the block grows with what is typed instead of scrolling. */
function AutoGrowTextarea(props: Readonly<React.TextareaHTMLAttributes<HTMLTextAreaElement>>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

const DASHED_FIELD =
  "w-full resize-none rounded-md border border-dashed border-slate-300 bg-transparent px-2 py-1 focus:border-brand-dark focus:ring-0 focus:outline-hidden";

interface TextBlockProps {
  content: TDashboardTextContent;
  isEditing: boolean;
  onChange: (content: TDashboardTextContent) => void;
  onRemove: () => void;
  onMeasure?: (px: number) => void;
}

/**
 * A text block (ENG-7250): a headline and a description, plain text with line breaks kept. Edited in
 * place, in dashed fields like the dashboard's title; it cannot be saved with both empty.
 */
function TextBlock({ content, isEditing, onChange, onRemove, onMeasure }: Readonly<TextBlockProps>) {
  const { t } = useTranslation();
  const ref = useReportHeight(onMeasure);
  return (
    <BlockFrame isEditing={isEditing} frame="always" controls={<ConfirmRemoveBlock onRemove={onRemove} />}>
      <div ref={ref} className="space-y-1 p-4">
        {isEditing ? (
          <>
            <input
              type="text"
              value={content.headline}
              maxLength={MAX_TEXT_BLOCK_HEADLINE_LENGTH}
              placeholder={t("workspace.analysis.dashboards.text_block_headline_placeholder")}
              aria-label={t("workspace.analysis.dashboards.text_block_headline")}
              className={cn(DASHED_FIELD, "text-lg font-medium text-slate-800")}
              onChange={(event) => onChange({ ...content, headline: event.target.value })}
            />
            <AutoGrowTextarea
              value={content.description}
              maxLength={MAX_TEXT_BLOCK_DESCRIPTION_LENGTH}
              placeholder={t("workspace.analysis.dashboards.text_block_description_placeholder")}
              aria-label={t("workspace.analysis.dashboards.text_block_description")}
              className={cn(DASHED_FIELD, "text-muted-foreground text-sm")}
              onChange={(event) => onChange({ ...content, description: event.target.value })}
            />
          </>
        ) : (
          <>
            {content.headline.trim() && (
              <h3 className="text-lg font-medium break-words text-slate-800">{content.headline}</h3>
            )}
            {content.description.trim() && (
              <p className="text-muted-foreground text-sm break-words whitespace-pre-line">
                {content.description}
              </p>
            )}
          </>
        )}
      </div>
    </BlockFrame>
  );
}

// ── Separator ───────────────────────────────────────────────────────────────────────────────────

/** A separator (ENG-7251): a horizontal line, centred in its row; only the line shows outside editing. */
function SeparatorBlock({ isEditing, onRemove }: Readonly<{ isEditing: boolean; onRemove: () => void }>) {
  return (
    <BlockFrame isEditing={isEditing} frame="editing" controls={<ConfirmRemoveBlock onRemove={onRemove} />}>
      <div className="flex h-full items-center px-4">
        <Separator className="bg-slate-200" />
      </div>
    </BlockFrame>
  );
}

// ── Any block ───────────────────────────────────────────────────────────────────────────────────

export interface DashboardLayoutBlockProps {
  dashboardId: string;
  widget: Exclude<TDashboardWidget, { kind: "chart" }>;
  isEditing: boolean;
  onContentChange: (widgetId: string, content: TDashboardImageContent | TDashboardTextContent) => void;
  onRemove: (widgetId: string) => void;
  /** The pixels the block's content needs, for its auto-height; image and text blocks report it. */
  onMeasure?: (widgetId: string, px: number) => void;
}

export function DashboardLayoutBlock({
  dashboardId,
  widget,
  isEditing,
  onContentChange,
  onRemove,
  onMeasure,
}: Readonly<DashboardLayoutBlockProps>) {
  const remove = () => onRemove(widget.id);
  const widgetId = widget.id;
  const report = useCallback((px: number) => onMeasure?.(widgetId, px), [onMeasure, widgetId]);

  if (widget.kind === "separator") return <SeparatorBlock isEditing={isEditing} onRemove={remove} />;
  if (widget.kind === "text") {
    return (
      <TextBlock
        content={widget.content}
        isEditing={isEditing}
        onChange={(content) => onContentChange(widget.id, content)}
        onRemove={remove}
        onMeasure={report}
      />
    );
  }
  return (
    <ImageBlock
      dashboardId={dashboardId}
      widgetId={widget.id}
      content={widget.content}
      isEditing={isEditing}
      onChange={(content) => onContentChange(widget.id, content)}
      onRemove={remove}
      onMeasure={report}
    />
  );
}
