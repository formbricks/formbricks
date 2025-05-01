import NoTokensCTAButton from "@/modules/alchemy-wallet/components/common/no-tokens-cta-button";
import { Card } from "@/modules/ui/components/card";
import { Modal } from "@/modules/ui/components/modal";
import { TabBar } from "@/modules/ui/components/tab-bar";
import { useTranslate } from "@tolgee/react";
import { Download, PlusIcon } from "lucide-react";
import QRCodeStyling from "qr-code-styling";
import { useEffect, useRef, useState } from "react";

interface WalletModalProps {
  address: string;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const WalletModal = ({ address, open, setOpen }: WalletModalProps) => {
  const { t } = useTranslate();
  const tabs = [
    {
      id: "deposit",
      label: t("common.deposit"),
      icon: <Download className="h-4 w-4" strokeWidth={2} />,
    },
    {
      id: "mint",
      label: t("common.mint"),
      icon: <PlusIcon className="h-4 w-4" strokeWidth={2} />,
    },
  ];
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const qrCodeRef = useRef<HTMLDivElement | null>(null);
  const cardClasses = "w-full min-h-[360px] p-6";

  //Currently resolving the issue of QR code not being generated. Temporarily used setTimeout to generate the QR code.
  useEffect(() => {
    if (!open || activeTab !== "deposit" || !address) return;

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
  }, [open, activeTab, address]);

  // console.log("address", address);
  if (!address) return;

  return (
    <Modal
      hideCloseButton
      open={open}
      setOpen={setOpen}
      size="md"
      className="max-h-[80vh] overflow-auto"
      noPadding
      closeOnOutsideClick={true}>
      <div className="h-full rounded-lg">
        <div className="relative h-full w-full overflow-auto p-4">
          <div className="flex flex-col items-center space-y-4">
            <TabBar
              tabs={tabs}
              activeId={activeTab}
              setActiveId={setActiveTab}
              tabStyle="button"
              className="w-full bg-slate-100"
            />

            {activeTab == "deposit" && (
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
            )}

            {activeTab == "mint" && (
              <Card className={cardClasses + " flex h-full flex-col justify-center"}>
                <div className="flex flex-1 flex-col items-center justify-center gap-3">
                  <div>
                    <h3 className="text-base font-medium text-slate-900">
                      {t("common.interested_in_minting")}
                    </h3>
                    <p className="text-sm text-slate-600">{t("common.find_out_more_and_mint")}</p>
                  </div>
                  <NoTokensCTAButton className="w-1/2" />
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
