import Head from "next/head";
import BaseLayoutManagement from "./BaseLayoutManagement";

export default function BaseLayoutUnauthorized({ title, children }) {
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <BaseLayoutManagement
        title={"Mise à jour profil"}
        breadcrumbs={[
          { name: "Sourcings", href: "#", current: false },
          { name: "Gestion des utilisateurs", href: "/users", current: true },
          {
            name: "Mise à jour profil",
            href: "/users/update-profile?next=%2Fusers",
            current: true,
          },
        ]}
        activeMenu="forms"
      >
        {children}
      </BaseLayoutManagement>
    </>
  );
}
