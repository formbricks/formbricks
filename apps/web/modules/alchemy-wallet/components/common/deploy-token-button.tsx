"use client";
import { useDeployERC20 } from "@/modules/alchemy-wallet/hooks/useDeployERC20";
import { cn } from "@formbricks/lib/cn";

interface DeployTokenButtonProps {
  onClick: () => void;
  backButtonLabel?: string;
  tabIndex?: number;
}

export function DeployTokenButton({ backButtonLabel, tabIndex = 2 }: DeployTokenButtonProps) {
  const { deploy } = useDeployERC20();
 
  return (
    <button
      dir="auto"
      tabIndex={tabIndex}
      type="button"
      className={cn(
        "fb-border-back-button-border fb-text-heading focus:fb-ring-focus fb-rounded-custom fb-flex fb-items-center fb-border fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2"
      )}
      onClick={() => deploy("Token Name", "TKN", 1000000)}>
      {backButtonLabel || "Deploy"}
    </button>
  );
}
