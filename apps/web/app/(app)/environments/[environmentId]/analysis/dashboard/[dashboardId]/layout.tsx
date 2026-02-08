export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout bypasses the analysis layout, allowing the dashboard page to have its own layout
  return children;
}
