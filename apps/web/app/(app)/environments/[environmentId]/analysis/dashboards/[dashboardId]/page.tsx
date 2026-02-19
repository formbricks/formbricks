const DashboardDetailPage = async (props: { params: Promise<{ dashboardId: string }> }) => {
  const { dashboardId } = await props.params;

  return (
    <div className="flex items-center justify-center py-12 text-sm text-slate-500">
      Dashboard detail for {dashboardId} will appear here.
    </div>
  );
};

export default DashboardDetailPage;
