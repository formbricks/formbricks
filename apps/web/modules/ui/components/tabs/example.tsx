import { HomeIcon, SettingsIcon, UserIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./index";

export function TabsExample() {
  return (
    <div className="space-y-8 p-8">
      <div>
        <h2 className="mb-4 text-lg font-semibold">Default Tabs</h2>
        <Tabs defaultValue="account" className="w-[400px]">
          <TabsList variant="default" size="default">
            <TabsTrigger value="account" layout="row">
              Account
            </TabsTrigger>
            <TabsTrigger value="password" layout="row">
              Password
            </TabsTrigger>
          </TabsList>
          <TabsContent value="account" className="mt-4">
            <div className="rounded-lg border p-4">
              <h3 className="mb-2 font-medium">Account Settings</h3>
              <p className="text-sm text-slate-600">
                Make changes to your account here. Click save when you're done.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="password" className="mt-4">
            <div className="rounded-lg border p-4">
              <h3 className="mb-2 font-medium">Password Settings</h3>
              <p className="text-sm text-slate-600">
                Change your password here. After saving, you'll be logged out.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">With Icons</h2>
        <Tabs defaultValue="home" className="w-[400px]">
          <TabsList variant="default" size="default">
            <TabsTrigger value="home" layout="row" icon={<HomeIcon />}>
              Home
            </TabsTrigger>
            <TabsTrigger value="profile" layout="row" icon={<UserIcon />}>
              Profile
            </TabsTrigger>
            <TabsTrigger value="settings" layout="row" icon={<SettingsIcon />}>
              Settings
            </TabsTrigger>
          </TabsList>
          <TabsContent value="home" className="mt-4">
            <div className="rounded-lg border p-4">
              <h3 className="mb-2 font-medium">Home Dashboard</h3>
              <p className="text-sm text-slate-600">
                Welcome to your dashboard. Here you can see an overview of your activity.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="profile" className="mt-4">
            <div className="rounded-lg border p-4">
              <h3 className="mb-2 font-medium">Profile Information</h3>
              <p className="text-sm text-slate-600">View and edit your profile information here.</p>
            </div>
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <div className="rounded-lg border p-4">
              <h3 className="mb-2 font-medium">Settings Panel</h3>
              <p className="text-sm text-slate-600">Configure your application settings and preferences.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Big Size (Column Layout)</h2>
        <Tabs defaultValue="account" className="w-[400px]">
          <TabsList variant="default" size="big">
            <TabsTrigger value="account" layout="column" size="big" icon={<UserIcon />}>
              Account
            </TabsTrigger>
            <TabsTrigger value="security" layout="column" size="big" icon={<SettingsIcon />}>
              Security
            </TabsTrigger>
          </TabsList>
          <TabsContent value="account" className="mt-4">
            <div className="rounded-lg border p-4">
              <h3 className="mb-2 font-medium">Account Information</h3>
              <p className="text-sm text-slate-600">Manage your account details and preferences.</p>
            </div>
          </TabsContent>
          <TabsContent value="security" className="mt-4">
            <div className="rounded-lg border p-4">
              <h3 className="mb-2 font-medium">Security Settings</h3>
              <p className="text-sm text-slate-600">
                Configure security options and two-factor authentication.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Disabled State</h2>
        <Tabs defaultValue="account" className="w-[400px]">
          <TabsList variant="disabled" size="default">
            <TabsTrigger value="account" layout="row" variant="disabled" icon={<UserIcon />}>
              Account
            </TabsTrigger>
            <TabsTrigger value="password" layout="row" variant="disabled" icon={<SettingsIcon />}>
              Password
            </TabsTrigger>
          </TabsList>
          <TabsContent value="account" className="mt-4">
            <div className="rounded-lg border p-4 opacity-50">
              <h3 className="mb-2 font-medium">Account Settings (Disabled)</h3>
              <p className="text-sm text-slate-600">This tab is currently disabled.</p>
            </div>
          </TabsContent>
          <TabsContent value="password" className="mt-4">
            <div className="rounded-lg border p-4 opacity-50">
              <h3 className="mb-2 font-medium">Password Settings (Disabled)</h3>
              <p className="text-sm text-slate-600">This tab is currently disabled.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
