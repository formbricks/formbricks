"use client";

import SingleCustomerPage from "@/components/customers/SingleCustomerPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperTeam from "@/components/layout/LayoutWrapperTeam";

export default function Customers({}) {
  return (
    <LayoutApp>
      <LayoutWrapperTeam>
        <SingleCustomerPage />
      </LayoutWrapperTeam>
    </LayoutApp>
  );
}
