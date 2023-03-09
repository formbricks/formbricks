import { Switch } from "@mui/material";
import { UserRole } from "@prisma/client";
import { useState } from "react";
import { toast } from "react-toastify";
import { updateUserRole } from "../lib/users";

const toggleRole = async (id, role, setIsAdmin) => {
  setTimeout(async () => {
    try {
      setIsAdmin(role === "ADMIN" ? false : true);
      await updateUserRole({ id, role });
    } catch (e) {
      setIsAdmin(role !== "ADMIN" ? false : true);
      toast.error(`Error: ${e.message}`);
    }
  }, 500);
};
export const SwitchButton = ({ role, id }) => {
  const [isAdmin, setIsAdmin] = useState(role === "ADMIN");
  return (
    <Switch
      size='medium'
      color='primary'
      onClick={() => {
        toggleRole(id, role, setIsAdmin);
      }}
      checked={isAdmin}
    />
  );
};

export const usersDataGridSchemaColumn = [
  {
    field: "Noms",
    width: 230,
  },

  {
    field: "Genre",
    width: 80,
  },
  {
    field: "Email",
    width: 200,
  },
  {
    field: "Phone",
    width: 140,
  },
  {
    field: "Whatsapp",
    width: 140,
  },
  {
    field: "Rôle",
    width: 200,
    renderCell: ({ row }) => {
      return (
        <div>
          <span>PUBLIC</span>
          <SwitchButton role={row["Rôle"]} id={row.id} />
          <span>ADMIN</span>
        </div>
      );
    },
  },
];

export const candidateDataGridSchemaColumn = [
  {
    field: "Noms",
    width: 130,
  },

  {
    field: "Genre",
    width: 80,
  },
  {
    field: "Email",
    width: 200,
  },
  {
    field: "Phone",
    width: 80,
    hide: true
  },
  {
    field: "Whatsapp",
    width: 80,
    hide: true
  },
];
