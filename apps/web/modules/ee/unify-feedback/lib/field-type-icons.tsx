import {
  CalendarDaysIcon,
  GaugeIcon,
  HashIcon,
  type LucideIcon,
  MessageSquareTextIcon,
  PresentationIcon,
  Rows3Icon,
  SmilePlusIcon,
  StarIcon,
  ToggleLeftIcon,
} from "lucide-react";

/**
 * Icon per feedback field type. Deliberately mirrors the survey editor's element icons
 * (see `modules/survey/lib/elements.tsx`) so the same kind of question reads the same
 * way wherever it is listed — records table, filter pick-lists, chart builder.
 */
export const FIELD_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  text: MessageSquareTextIcon,
  categorical: Rows3Icon,
  nps: PresentationIcon,
  csat: SmilePlusIcon,
  ces: GaugeIcon,
  rating: StarIcon,
  number: HashIcon,
  boolean: ToggleLeftIcon,
  date: CalendarDaysIcon,
};

interface FieldTypeIconProps {
  fieldType: string | null | undefined;
  className?: string;
  "aria-label"?: string;
}

/** Field-type icon, falling back to the neutral text icon for types the map does not know yet. */
export const FieldTypeIcon = ({
  fieldType,
  className,
  "aria-label": ariaLabel,
}: Readonly<FieldTypeIconProps>) => {
  const Icon = FIELD_TYPE_ICON_MAP[fieldType ?? ""] ?? MessageSquareTextIcon;
  return <Icon className={className} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true} />;
};
