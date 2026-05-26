const AccountSettingsLayout = async (
  props: Readonly<{
    params: Promise<{ workspaceId: string }>;
    children: React.ReactNode;
  }>
) => {
  await props.params;
  return <>{props.children}</>;
};

export default AccountSettingsLayout;
