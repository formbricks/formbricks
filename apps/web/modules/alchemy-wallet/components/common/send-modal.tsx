"use client";

import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import { TokenBalance } from "@wonderchain/sdk/dist/blockscout-client";
import { ArrowRightIcon } from "lucide-react";
import { useForm } from "react-hook-form";

type FormValues = {
  tokenAddress: string;
  address: string;
  amount: number;
};

type Props = {
  address?: string;
  // balances: TokenBalance[] | null;
  balance: TokenBalance | null;
  onClose: () => void;
};

export function SendModal({ address, balance, onClose }: Props) {
  const { t } = useTranslate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>();

  const submitSend = () => {
    console.log("Wahooo Money is sent");
  };

  return (
    <>
      <Modal open={!!balance} setOpen={onClose}>
        <div className="flex h-full flex-col rounded-lg">
          <div className="flex inline-flex items-center justify-start gap-4">
            <div className="text-xl font-medium text-slate-700">
              {t("environments.wallet.modal.send_funds")}
            </div>
          </div>
          <form onSubmit={handleSubmit(submitSend)} className="flex flex-col gap-6 pt-6">
            <div className="flex w-full flex-col gap-2 rounded-lg">
              {/* Dropdown here */}
              Dropdown
            </div>
            <div className="flex w-full flex-col gap-2 rounded-lg">
              <Label>{t("environments.wallet.form.token_address")}</Label>
              <Input
                autoFocus
                type="text"
                value={balance?.token.address}
                disabled
                placeholder={"0x..."}
                {...register("tokenAddress", {
                  required: t("environments.wallet.form.error.address_required"),
                  pattern: {
                    value: /^0x[a-fA-F0-9]{40}$/,
                    message: t("environments.wallet.form.error.invalid_eth_address"),
                  },
                })}
              />
            </div>
            <div className="flex w-full flex-col gap-2 rounded-lg">
              <Label>{t("environments.wallet.form.recipient_address")}</Label>
              <Input
                autoFocus
                type="text"
                placeholder={"0x..."}
                {...register("address", {
                  required: t("environments.wallet.form.error.address_required"),
                  pattern: {
                    value: /^0x[a-fA-F0-9]{40}$/,
                    message: t("environments.wallet.form.error.invalid_eth_address"),
                  },
                })}
              />
              {errors.address && <Label className="font-normal text-red-500">{errors.address.message}</Label>}
            </div>
            <div className="flex w-full flex-col gap-2 rounded-lg">
              <Label>{t("environments.wallet.form.amount_usdc")}</Label>
              <Input
                autoFocus
                type="number"
                placeholder={"0.00"}
                step="any"
                {...register("amount", {
                  required: t("environments.wallet.form.error.amount_required"),
                  min: {
                    value: 0.01,
                    message: t("environments.wallet.form.error.min_amount"),
                  },
                  max: {
                    value: 1_000_000,
                    message: t("environments.wallet.form.error.max_amount"),
                  },
                  validate: (value) => value > 0 || t("environments.wallet.form.error.positive_amount"),
                })}
              />
              {errors.amount && <Label className="font-normal text-red-500">{errors.amount.message}</Label>}
            </div>
            <div className="flex justify-end">
              <div className="flex space-x-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  {t("common.cancel")}
                </Button>
                <Button
                  className="ring-offset-background focus-visible:ring-ring group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  type="submit"
                  loading={false}>
                  {t("common.send")}
                  <ArrowRightIcon
                    className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    strokeWidth={2}
                  />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}

export default SendModal;
