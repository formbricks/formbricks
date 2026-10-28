import type { ButtonHTMLAttributes, ReactNode } from "react";
import { classNames } from "./class-names";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const BADGE_CLASS: Record<Tone, string> = {
  neutral: "fb-badge",
  info: "fb-badge fb-badge-info",
  success: "fb-badge fb-badge-success",
  warning: "fb-badge fb-badge-warning",
  danger: "fb-badge fb-badge-danger",
};

export const Badge = ({ tone = "neutral", children }: Readonly<{ tone?: Tone; children: ReactNode }>) => (
  <span className={BADGE_CLASS[tone]}>{children}</span>
);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "danger";
}

export const Button = ({
  variant = "default",
  className,
  type = "button",
  ...props
}: Readonly<ButtonProps>) => (
  <button
    type={type}
    className={classNames(
      "fb-btn",
      variant === "primary" && "fb-btn-primary",
      variant === "danger" && "fb-btn-danger",
      className
    )}
    {...props}
  />
);

export const Card = ({ children, className }: Readonly<{ children: ReactNode; className?: string }>) => (
  <div className={classNames("fb-card", className)}>{children}</div>
);

export const Notice = ({
  tone = "neutral",
  children,
}: Readonly<{ tone?: "neutral" | "warning" | "danger"; children: ReactNode }>) => (
  <div
    className={classNames(
      "fb-notice",
      tone === "danger" && "fb-notice-danger",
      tone === "warning" && "fb-notice-warning"
    )}
    role={tone === "neutral" ? "status" : "alert"}>
    {children}
  </div>
);

export const Loading = ({ label }: Readonly<{ label: string }>) => (
  <div className="fb-row" role="status">
    <span className="fb-spinner" aria-hidden="true" />
    <span className="fb-muted">{label}</span>
  </div>
);

interface TabsProps<T extends string> {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}

export const Tabs = <T extends string>({ tabs, active, onChange, label }: Readonly<TabsProps<T>>) => (
  <div className="fb-tabs" role="tablist" aria-label={label}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        className="fb-tab"
        aria-selected={tab.id === active}
        onClick={() => onChange(tab.id)}>
        {tab.label}
      </button>
    ))}
  </div>
);
