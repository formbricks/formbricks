"use client";

import CustomersPage from "@/components/customers/CustomersPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperTeam from "@/components/layout/LayoutWrapperTeam";

export default function Customers({}) {
  return (
    <LayoutApp>
      <LayoutWrapperTeam>
        <CustomersPage />
      </LayoutWrapperTeam>
    </LayoutApp>
  );
}
