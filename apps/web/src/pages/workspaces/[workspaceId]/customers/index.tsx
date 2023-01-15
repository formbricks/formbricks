"use client";

import CustomersPage from "@/components/customers/CustomersPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperWorkspace from "@/components/layout/LayoutWrapperWorkspace";

export default function Customers({}) {
  return (
    <LayoutApp>
      <LayoutWrapperWorkspace>
        <CustomersPage />
      </LayoutWrapperWorkspace>
    </LayoutApp>
  );
}
