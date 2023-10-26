enum MEMBERSHIP_ROLES {
  OWNER = "owner",
  ADMIN = "admin",
  EDITOR = "editor",
  DEVELOPER = "developer",
  VIEWER = "viewer",
}

export const getAccessFlags = (role: string) => {
  const isAdmin = role === MEMBERSHIP_ROLES.ADMIN;
  const isEditor = role === MEMBERSHIP_ROLES.EDITOR;
  const isOwner = role === MEMBERSHIP_ROLES.OWNER;
  const isDeveloper = role === MEMBERSHIP_ROLES.DEVELOPER;
  const isViewer = role === MEMBERSHIP_ROLES.VIEWER;

  return {
    isAdmin,
    isEditor,
    isOwner,
    isDeveloper,
    isViewer,
  };
};
