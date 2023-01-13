import { Switch } from "@mui/material";

export const SwitchButton = () => <Switch size='medium' color='primary' />;

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
          <Switch
            size='medium'
            color='primary'
            checked={row["Rôle"] === "ADMIN"}
          />
          <span>ADMIN</span>
        </div>
      );
    },
  },
];

  const updateUserRole = async (user, role) => {
    try {
      await fetch(`/api/users/${user.id}`, {
        method: "UPDATE",
      });
   
    } catch (error) {
      console.error(error);
    }
  };
