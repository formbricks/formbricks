"use client";

import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Modal } from "@/modules/ui/components/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { useTranslate } from "@tolgee/react";
import { TokenBalance } from "@wonderchain/sdk/dist/blockscout-client";
import { formatUnits } from "ethers";
import { ArrowRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useSendERC20 } from "@formbricks/web3/src/hooks/useSendERC20";

type FormValues = {
  tokenAddress: string;
  address: string;
  amount: number;
};

type Props = {
  balances: TokenBalance[];
  onSelectBalance: (TokenBalance) => void;
  balance: TokenBalance | null;
  onClose: () => void;
  contractAddress?: string;
  address?: string;
  amount?: number;
};

export function SendModal({
  balances,
  balance,
  onSelectBalance,
  onClose,
  contractAddress,
  address,
  amount,
}: Props) {
  const { t } = useTranslate();
  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      tokenAddress: contractAddress,
      address: address,
      amount: amount,
    },
  });
  const tokenAddress = watch("tokenAddress");
  const { send } = useSendERC20({ address: tokenAddress });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    const { address, amount } = data;
    try {
      await send(address, amount);
      toast.success(`Tokens sent successfully!`);
    } catch (err) {
      console.error("Send failed", err);
      toast.error(`Tokens failed to send`);
    }
    setLoading(false);
    onClose();
  };

  useEffect(() => {
    if (balance?.token.address) {
      setValue("tokenAddress", balance.token.address);
    }
  }, [balance, setValue]);

  return (
    <>
      <Modal open={!!balance} setOpen={onClose}>
        <div className="flex h-full flex-col rounded-lg">
          <div className="flex inline-flex items-center justify-start gap-4">
            <div className="text-xl font-medium text-slate-700">
              {t("environments.wallet.modal.send_funds")}
            </div>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 pt-6">
            <div className="flex w-full flex-col gap-2 rounded-lg">
              <Label>{t("environments.wallet.form.token")}</Label>
              <Controller
                name="tokenAddress"
                control={control}
                rules={{
                  required: t("environments.wallet.form.error.address_required"),
                  pattern: {
                    value: /^0x[a-fA-F0-9]{40}$/,
                    message: t("environments.wallet.form.error.invalid_eth_address"),
                  },
                }}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    disabled={loading || !!contractAddress}
                    onValueChange={(address) => {
                      field.onChange(address);
                      const selected = balances.find((b) => b.token.address === address);
                      if (selected) onSelectBalance(selected);
                    }}>
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          balance
                            ? `${balance.token.symbol} — ${formatUnits(balance.value, parseInt(balance.token.decimals, 10))}`
                            : "Select a token address"
                        }
                      />
                    </SelectTrigger>

                    <SelectContent className="bg-white">
                      {balances?.map((balance) => (
                        <SelectItem
                          key={balance.token.address}
                          value={balance.token.address}
                          className="group font-normal hover:text-slate-900">
                          <div className="flex w-full items-center justify-start gap-2">
                            {balance.token.name} —{" "}
                            {formatUnits(balance.value, parseInt(balance.token.decimals, 10))}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex w-full flex-col gap-2 rounded-lg">
              <Label>{t("environments.wallet.form.recipient_address")}</Label>
              <Input
                autoFocus
                type="text"
                disabled={loading || !!address}
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
              <Label>{t("environments.wallet.form.amount")}</Label>
              <Input
                autoFocus
                type="number"
                disabled={loading || !!amount}
                placeholder={"0.00"}
                step="any"
                {...register("amount", {
                  required: t("environments.wallet.form.error.amount_required"),
                  min: {
                    value: 0.01,
                    message: t("environments.wallet.form.error.min_amount"),
                  },
                  max: {
                    value: balance ? formatUnits(balance.value, parseInt(balance.token.decimals, 10)) : 0,
                    message: t("environments.wallet.form.error.max_amount"),
                  },
                  validate: (value) => value > 0 || t("environments.wallet.form.error.positive_amount"),
                })}
              />
              {errors.amount && <Label className="font-normal text-red-500">{errors.amount.message}</Label>}
            </div>
            {/* Send and Cancel Buttons */}
            <div className="flex justify-end">
              <div className="flex space-x-2">
                <Button disabled={loading} type="button" variant="ghost" onClick={onClose}>
                  {t("common.cancel")}
                </Button>
                <Button
                  className="ring-offset-background focus-visible:ring-ring group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  type="submit"
                  loading={loading}>
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
