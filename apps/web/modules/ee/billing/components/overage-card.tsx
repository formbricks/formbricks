"use client";

import { PencilIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { TabToggle } from "@/modules/ui/components/tab-toggle";
import { SettingsId } from "./settings-id";

type OverageMode = "allow" | "blocked";

interface OverageUsage {
  responses: number;
  responseCost: number;
  contacts: number;
  contactsCost: number;
}

interface OverageCardProps {
  currentMode: OverageMode;
  spendingLimit: number | null;
  overageUsage: OverageUsage;
  onModeChange: (mode: OverageMode) => void | Promise<void>;
  onSpendingLimitChange: (limit: number | null) => void | Promise<void>;
}

const OVERAGE_MODE_CONFIG: Record<
  OverageMode,
  {
    label: string;
    tooltip: string;
  }
> = {
  allow: {
    label: "Allow",
    tooltip:
      "You're currently allowing additional responses over your included response volumes. This is good to keep your surveys running and contacts identified.",
  },
  blocked: {
    label: "Blocked",
    tooltip:
      "Overage is blocked. When you reach your included limits, surveys will stop collecting responses and contacts won't be identified until the next billing cycle.",
  },
};

const MIN_SPENDING_LIMIT = 10;

export const OverageCard = ({
  currentMode,
  spendingLimit,
  overageUsage,
  onModeChange,
  onSpendingLimitChange,
}: OverageCardProps) => {
  const [isChanging, setIsChanging] = useState(false);
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState(spendingLimit?.toString() ?? "");
  const [limitError, setLimitError] = useState<string | null>(null);
  const [showBlockConfirmation, setShowBlockConfirmation] = useState(false);

  const totalOverageCost = overageUsage.responseCost + overageUsage.contactsCost;

  const handleModeChange = (newMode: OverageMode) => {
    if (newMode === currentMode) return;

    // Show confirmation when switching to blocked with outstanding overage
    if (newMode === "blocked" && currentMode === "allow" && totalOverageCost > 0) {
      setShowBlockConfirmation(true);
      return;
    }

    executeModeChange(newMode);
  };

  const executeModeChange = (newMode: OverageMode) => {
    setIsChanging(true);
    Promise.resolve(onModeChange(newMode)).finally(() => {
      setIsChanging(false);
      setShowBlockConfirmation(false);
    });
  };

  const handleSaveLimit = () => {
    const value = Number.parseFloat(limitInput);

    if (limitInput === "" || Number.isNaN(value)) {
      setLimitError("Please enter a valid amount");
      return;
    }

    if (value < MIN_SPENDING_LIMIT) {
      setLimitError(`Minimum spending limit is $${MIN_SPENDING_LIMIT}`);
      return;
    }

    setLimitError(null);
    setIsChanging(true);
    Promise.resolve(onSpendingLimitChange(value)).finally(() => {
      setIsChanging(false);
      setIsEditingLimit(false);
    });
  };

  const handleRemoveLimit = () => {
    setIsChanging(true);
    Promise.resolve(onSpendingLimitChange(null)).finally(() => {
      setIsChanging(false);
      setLimitInput("");
    });
  };

  const handleCancelEdit = () => {
    setIsEditingLimit(false);
    setLimitInput(spendingLimit?.toString() ?? "");
    setLimitError(null);
  };

  const handleStartEdit = () => {
    setLimitInput(spendingLimit?.toString() ?? "");
    setIsEditingLimit(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <SettingsId
          label="Overage Mode"
          value={OVERAGE_MODE_CONFIG[currentMode].label}
          tooltip={OVERAGE_MODE_CONFIG[currentMode].tooltip}
        />

        <div className="w-48">
          <TabToggle
            id="overage-mode"
            options={[
              { value: "allow", label: "Allow" },
              { value: "blocked", label: "Blocked" },
            ]}
            defaultSelected={currentMode}
            onChange={(value) => handleModeChange(value as OverageMode)}
            disabled={isChanging}
          />
        </div>
      </div>

      {/* Overage Usage Meters (only when Allow mode) */}
      {currentMode === "allow" && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          {/* Responses Overage */}
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-500">Responses</p>
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                Overage
              </span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {overageUsage.responses.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-slate-500">${overageUsage.responseCost.toFixed(2)} this month</p>
          </div>

          {/* Contacts Overage */}
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-500">Identified Contacts</p>
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                Overage
              </span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {overageUsage.contacts.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-slate-500">${overageUsage.contactsCost.toFixed(2)} this month</p>
          </div>
        </div>
      )}

      {/* Total Overage Cost & Spending Limit Section (only when Allow mode) */}
      {currentMode === "allow" && (
        <div className="mt-6">
          {/* Spending Stats Header */}
          <div className="flex items-start justify-between">
            <SettingsId
              label="Total overage this month"
              value={`$${totalOverageCost.toFixed(2)}`}
              tooltip="Billed on Feb 1, 2025"
            />
            {spendingLimit && (
              <SettingsId
                label="Spending limit"
                value={`$${spendingLimit.toLocaleString()} / month`}
                align="right"
              />
            )}
          </div>

          {/* Spending Limit Progress Bar (if limit is set) */}
          {spendingLimit && (
            <div className="mt-5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    totalOverageCost / spendingLimit > 0.9 ? "bg-red-500" : "bg-teal-500"
                  )}
                  style={{ width: `${Math.min((totalOverageCost / spendingLimit) * 100, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {((totalOverageCost / spendingLimit) * 100).toFixed(0)}% of spending limit used
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex items-center gap-3">
            {isEditingLimit && (
              <div className="flex flex-col gap-3">
                <Label className="text-sm font-medium text-slate-700">Monthly Spending Limit</Label>
                <div className="flex items-center gap-3">
                  <div className="relative w-32">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">$</span>
                    <Input
                      type="number"
                      min={MIN_SPENDING_LIMIT}
                      step="1"
                      value={limitInput}
                      onChange={(e) => {
                        setLimitInput(e.target.value);
                        setLimitError(null);
                      }}
                      placeholder={`${MIN_SPENDING_LIMIT}`}
                      className="pl-7"
                      isInvalid={!!limitError}
                    />
                  </div>
                  <Button size="sm" onClick={handleSaveLimit} loading={isChanging} disabled={isChanging}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={isChanging}>
                    Cancel
                  </Button>
                </div>
                {limitError && <p className="text-sm text-red-500">{limitError}</p>}
              </div>
            )}

            {!isEditingLimit && spendingLimit && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={handleStartEdit} disabled={isChanging}>
                  <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
                  Edit limit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleRemoveLimit}
                  disabled={isChanging}
                  loading={isChanging}>
                  <TrashIcon className="mr-1.5 h-3.5 w-3.5" />
                  Remove limit
                </Button>
              </div>
            )}

            {!isEditingLimit && !spendingLimit && (
              <Button size="sm" variant="secondary" onClick={handleStartEdit} disabled={isChanging}>
                Set spending limit
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for blocking with outstanding overage */}
      <ConfirmationModal
        open={showBlockConfirmation}
        setOpen={setShowBlockConfirmation}
        title="Outstanding overage will be billed"
        description={`You have $${totalOverageCost.toFixed(2)} in outstanding overage charges.`}
        body="By blocking overage, this amount will be billed immediately to your payment method on file. After blocking, your surveys will stop collecting responses and contacts won't be identified once you reach your included limits."
        buttonText="Block overage & bill now"
        buttonVariant="destructive"
        onConfirm={() => executeModeChange("blocked")}
      />
    </div>
  );
};
