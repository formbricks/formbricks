"use client";

import { TTeam } from "@formbricks/types/teams";
import { Button } from "@formbricks/ui/Button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import LoadingSpinner from "@formbricks/ui/LoadingSpinner";
import { PricingCard } from "@formbricks/ui/PricingCard";

import {
  manageSubscriptionAction,
  removeSubscriptionAction,
  upgradePlanAction,
} from "@/app/(app)/environments/[environmentId]/settings/billing/actions";

import { priceLookupKeys } from "@formbricks/ee/billing/utils/products";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import toast from "react-hot-toast";

interface BillingDetails {
  people: number;
  response: number;
}

interface PricingTableProps {
  team: TTeam;
  environmentId: string;
  billingDetails: BillingDetails;
}

export default function PricingTableComponent({ team, environmentId, billingDetails }: PricingTableProps) {
  const router = useRouter();
  const [loadingCustomerPortal, setLoadingCustomerPortal] = useState(false);
  const { people, response } = billingDetails;
  const [upgradingPlan, setUpgradingPlan] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [activeLookupKey, setActiveLookupKey] = useState("");

  const openCustomerPortal = async () => {
    setLoadingCustomerPortal(true);
    const sessionUrl = await manageSubscriptionAction(team.id, environmentId);
    router.push(sessionUrl);
    setLoadingCustomerPortal(true);
  };

  const upgradePlan = async (priceNickname: string) => {
    try {
      setUpgradingPlan(true);
      const paymentUrl = await upgradePlanAction(team.id, environmentId, priceNickname);
      setUpgradingPlan(false);
      if (paymentUrl === "") {
        toast.success("Plan upgraded successfully");
        router.refresh();
      } else {
        router.push(paymentUrl);
      }
    } catch (err) {
      toast.error("Unable to upgrade plan");
    } finally {
      setUpgradingPlan(false);
    }
  };

  const handleClickingCancelButton = async (e, lookupKey) => {
    try {
      e.preventDefault();
      setActiveLookupKey(lookupKey);
      setOpenDeleteModal(true);
    } catch (err) {
      toast.error("Unable to open delete modal");
    }
  };

  const handleDeleteSubscription = async () => {
    try {
      await removeSubscriptionAction(team.id, environmentId, activeLookupKey);
      router.refresh();
      toast.success("Subscription deleted successfully");
    } catch (err) {
      toast.error("Unable to delete subscription");
    } finally {
      setOpenDeleteModal(false);
    }
  };

  const coreAndWebAppSurveyPaid = [
    "Team Roles",
    "Multi Language Surveys",
    "0.15$ / submission after 250 submissions",
  ];
  const coreAndWebAppSurveysFreeTierLimit = 250;

  const userTargetingPaid = ["Advanced Targeting", "0.01$ / identified user after 2500 people"];
  const userTargetingFreeTierLimit = 2500;

  const linkSurveysPaid = ["Remove Formbricks Branding", "Custom URL", "File Uploads upto 1 GB"];

  return (
    <div className="relative">
      {loadingCustomerPortal && (
        <div className="absolute h-full w-full rounded-lg bg-slate-900/5">
          <LoadingSpinner />
        </div>
      )}
      <div className="justify-between gap-4 rounded-lg bg-white p-8">
        {team.billing.stripeCustomerId && (
          <div className="absolute right-8 top-4 pb-4">
            <Button
              variant="secondary"
              className="justify-center py-2 shadow-sm"
              loading={loadingCustomerPortal}
              onClick={openCustomerPortal}>
              Manage Card Details
            </Button>
          </div>
        )}

        <PricingCard
          title={"Core & App Surveys"}
          subtitle={"Get upto 250 free responses every month"}
          featureName={priceLookupKeys[priceLookupKeys.appSurvey]}
          monthlyPrice={0}
          actionText={"Starting at"}
          team={team}
          metric="responses"
          sliderValue={response}
          sliderLimit={350}
          freeTierLimit={coreAndWebAppSurveysFreeTierLimit}
          paidFeatures={coreAndWebAppSurveyPaid}
          perMetricCharge={0.15}
          loading={upgradingPlan}
          upgradePlanFunction={() => upgradePlan(priceLookupKeys[priceLookupKeys.appSurvey])}
          cancelPlanFunction={(e) =>
            handleClickingCancelButton(e, priceLookupKeys[priceLookupKeys.appSurvey])
          }
        />

        <PricingCard
          title={"User Identification"}
          subtitle={"Target upto 2500 users every month"}
          featureName={priceLookupKeys[priceLookupKeys.userTargeting]}
          monthlyPrice={0}
          actionText={"Starting at"}
          team={team}
          metric="people"
          sliderValue={people}
          sliderLimit={3500}
          freeTierLimit={userTargetingFreeTierLimit}
          paidFeatures={userTargetingPaid}
          perMetricCharge={0.01}
          loading={upgradingPlan}
          upgradePlanFunction={() => upgradePlan(priceLookupKeys[priceLookupKeys.userTargeting])}
          cancelPlanFunction={(e) =>
            handleClickingCancelButton(e, priceLookupKeys[priceLookupKeys.userTargeting])
          }
        />

        <PricingCard
          title={"Link Survey"}
          subtitle={"Run unlimited surveys and responses for free"}
          featureName={priceLookupKeys[priceLookupKeys.linkSurvey]}
          monthlyPrice={30}
          actionText={"At"}
          team={team}
          metric="people"
          paidFeatures={linkSurveysPaid}
          loading={upgradingPlan}
          upgradePlanFunction={() => upgradePlan(priceLookupKeys[priceLookupKeys.linkSurvey])}
          cancelPlanFunction={(e) =>
            handleClickingCancelButton(e, priceLookupKeys[priceLookupKeys.linkSurvey])
          }
        />
      </div>
      <DeleteDialog
        open={openDeleteModal}
        setOpen={setOpenDeleteModal}
        deleteWhat="App & Core Surveys"
        onDelete={() => {
          handleDeleteSubscription();
        }}
      />
    </div>
  );
}
