import { Card } from "@/modules/ui/components/card";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import QRCodeStyling from "qr-code-styling";
import { useEffect, useRef } from "react";

interface WalletModalProps {
  address: string;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const WalletModal = ({ address, open, setOpen }: WalletModalProps) => {
  const { t } = useTranslate();

  const qrCodeRef = useRef<HTMLDivElement | null>(null);
  const cardClasses = "w-full min-h-[360px] p-6";

  useEffect(() => {
    if (!open || !address) return;

    const timer = setTimeout(() => {
      if (qrCodeRef.current) {
        qrCodeRef.current.innerHTML = "";
        try {
          const qrCode = new QRCodeStyling({
            width: 150,
            height: 150,
            type: "svg",
            data: address,
            dotsOptions: {
              color: "#4267b2",
              type: "rounded",
            },
            backgroundOptions: {
              color: "#e9ebee",
            },
          });
          qrCode.append(qrCodeRef.current);
        } catch (error) {
          console.error("Error generating QR: ", error);
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [open, address]);

  if (!address) return;

  return (
    <Modal
      hideCloseButton
      open={open}
      setOpen={setOpen}
      size="md"
      className="max-h-[80vh] w-[95%] overflow-auto"
      noPadding
      closeOnOutsideClick={true}>
      <div className="h-full rounded-lg">
        <div className="relative h-full w-full overflow-auto p-4">
          <div className="flex flex-col items-center space-y-4">
            <Card className={cardClasses}>
              <div>
                <div className="text-lg font-medium text-slate-900">
                  {t("environments.wallet.balance_card.scan_qr_to_deposit")}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center">
                <div className="mb-4 w-full">
                  <div className="mb-2 mt-4 text-sm font-medium text-slate-700">{t("common.address")}:</div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="break-all text-sm text-slate-600">{address}</p>
                  </div>
                </div>
                <div className="flex justify-center py-4">
                  <div className="bg-secondary rounded-lg border-4 border-black p-4 shadow-sm">
                    <div ref={qrCodeRef} className="h-[150px] w-[150px]"></div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Modal>
  );
};
