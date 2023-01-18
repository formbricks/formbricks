import { Switch } from "@headlessui/react";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { UserCircleIcon, TrashIcon } from "@heroicons/react/24/solid";
import { TailSpin } from "react-loader-spinner";
import { toast } from "react-toastify";
import Link from "next/link";
import { isAdmin } from "../lib/utils";
import { useState } from "react";
import { useUsers, persistUserRole } from "../lib/users";
import { UserRole } from "@prisma/client";
import { classNames } from "../lib/utils";
import { usersDataGridSchemaColumn } from "./usersDataGridSchemaColumn";

export default function UserList() {
  const { users, mutateUsers } = useUsers();
  const [loading, setLoading] = useState(false);

  // const toggleRole = async (user) => {
  //   setLoading(true);
  //   setTimeout(async () => {
  //     try {
  //       await updateUserRole(user);
  //     } catch (e) {
  //       toast.error(`Error: ${e.message}`);
  //     }
  //     const newUserRole =
  //       user.role === UserRole.ADMIN ? UserRole.PUBLIC : UserRole.ADMIN;
  //     const data = {
  //       id: user.id,
  //       role: newUserRole,
  //     };
  //     JSON.parse(JSON.stringify(user));

  //     await persistUserRole(data);
  //     mutateUsers();
  //     setLoading(false);
  //     toast("Your role has changed 🎉");
  //   }, 500);
  // };

  // const deleteForm = async (form, formIdx) => {
  //   try {
  //     await fetch(`/api/users/${form.id}`, {
  //       method: "DELETE",
  //     });
  //     // remove locally
  //     const updatedForms = [...forms];
  //     updatedForms.splice(formIdx, 1);
  //     mutateForms(updatedForms);
  //   } catch (error) {
  //     console.error(error);
  //   }
  // };

  return (
    <>
      <div className='h-full px-6 py-8'>
        {users && (
          <div style={{ width: "100%" }}>
            <DataGrid
              columns={usersDataGridSchemaColumn}
              rows={users.map(
                ({
                  id,
                  firstname,
                  lastname,
                  gender,
                  phone,
                  whatsapp,
                  role,
                  email,
                }) => ({
                  id,
                  Noms: `${firstname} ${lastname}`,
                  Genre: gender,
                  Phone: phone,
                  Whatsapp: whatsapp,
                  Rôle: role,
                  Email: email,
                })
              )}
              components={{ Toolbar: GridToolbar }}
              autoHeight
            />
          </div>
        )}
      </div>
    </>
  );
}
