"use client";

import CustomersPage from "@/components/customers/CustomersPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperOrganisation from "@/components/layout/LayoutWrapperOrganisation";

export default function Customers({}) {
  return (
    <LayoutApp>
      <LayoutWrapperOrganisation>
        <CustomersPage />
      </LayoutWrapperOrganisation>
    </LayoutApp>
  );
}
