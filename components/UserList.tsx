import { Switch } from "@headlessui/react";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { useUsers,  } from "../lib/users";
import { usersDataGridSchemaColumn } from "./usersDataGridSchemaColumn";

export default function UserList() {
  const { users } = useUsers();

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
                  createdAt,
                }) => ({
                  createdAt,
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
