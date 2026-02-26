"use client";

import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/modules/ui/components/dialog";

interface ChartBuilderGuideProps {
  /** Optional trigger; when not provided, caller renders their own */
  trigger?: React.ReactNode;
}

export function ChartBuilderGuide({ trigger }: Readonly<ChartBuilderGuideProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      {trigger ?? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
          <HelpCircle className="mr-2 h-4 w-4" />
          {t("environments.analysis.charts.guide_button")}
        </Button>
      )}
      <Dialog open={isOpen} onOpenChange={(isOpen) => !isOpen && setIsOpen(false)}>
        <DialogContent width="wide" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("environments.analysis.charts.guide_title")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-6">
              <section>
                <h3 className="text-md mb-1 font-semibold text-gray-900">
                  {t("environments.analysis.charts.guide_chart_type")}
                </h3>
                <p className="text-gray-600">{t("environments.analysis.charts.guide_chart_type_desc")}</p>
              </section>

              <section>
                <h3 className="text-md mb-1 font-semibold text-gray-900">
                  {t("environments.analysis.charts.guide_measures")}
                </h3>
                <p className="text-sm text-gray-600">
                  {t("environments.analysis.charts.guide_measures_predefined")}
                </p>
              </section>

              <section>
                <h3 className="text-md mb-1 font-semibold text-gray-900">
                  {t("environments.analysis.charts.guide_dimensions")}
                </h3>
                <p className="text-sm text-gray-600">
                  {t("environments.analysis.charts.guide_dimensions_desc")}
                </p>
              </section>

              <section>
                <h3 className="text-md mb-1 font-semibold text-gray-900">
                  {t("environments.analysis.charts.guide_time_dimension")}
                </h3>
                <p className="text-sm text-gray-600">
                  {t("environments.analysis.charts.guide_time_dimension_desc")}
                </p>
              </section>

              <section>
                <h3 className="text-md mb-1 font-semibold text-gray-900">
                  {t("environments.analysis.charts.guide_filters")}
                </h3>
                <p className="text-sm text-gray-600">
                  {t("environments.analysis.charts.guide_filters_desc")}
                </p>
              </section>

              <section>
                <h3 className="text-md mb-2 font-semibold text-gray-900">
                  {t("environments.analysis.charts.guide_quick_ref")}
                </h3>
                <dl className="space-y-1.5 text-sm text-gray-600">
                  <div>
                    <dt className="inline font-medium text-gray-900">Measure: </dt>
                    <dd className="inline">{t("environments.analysis.charts.guide_term_measure")}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-gray-900">Dimension: </dt>
                    <dd className="inline">{t("environments.analysis.charts.guide_term_dimension")}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-gray-900">Time dimension: </dt>
                    <dd className="inline">{t("environments.analysis.charts.guide_term_time")}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-gray-900">Filter: </dt>
                    <dd className="inline">{t("environments.analysis.charts.guide_term_filter")}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
