"use client";

import SingleCustomerPage from "@/components/customers/SingleCustomerPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperOrganisation from "@/components/layout/LayoutWrapperOrganisation";

export default function Customers({}) {
  return (
    <LayoutApp>
      <LayoutWrapperOrganisation>
        <SingleCustomerPage />
      </LayoutWrapperOrganisation>
    </LayoutApp>
  );
}
