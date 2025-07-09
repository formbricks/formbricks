import type { Meta, StoryObj } from "@storybook/react";
import { InfoIcon, KeyRound, UserIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./index";

const meta = {
  title: "ui/Tabs",
  component: Tabs,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  render: () => (
    <div className="w-[400px]">
      <Tabs defaultValue="tab1">
        <TabsList variant="default" size="default">
          <TabsTrigger value="tab1" layout="row">
            Account
          </TabsTrigger>
          <TabsTrigger value="tab2" layout="row">
            Password
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="mt-4">
          Make changes to your account here.
        </TabsContent>
        <TabsContent value="tab2" className="mt-4">
          Change your password here.
        </TabsContent>
      </Tabs>
    </div>
  ),
};

// With Icons
export const WithIcons: Story = {
  render: () => (
    <div className="w-[400px]">
      <Tabs defaultValue="tab1">
        <TabsList variant="default" size="default">
          <TabsTrigger value="tab1" layout="row" icon={<UserIcon />}>
            Account
          </TabsTrigger>
          <TabsTrigger value="tab2" layout="row" icon={<KeyRound />}>
            Password
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="mt-4">
          Make changes to your account here.
        </TabsContent>
        <TabsContent value="tab2" className="mt-4">
          Change your password here.
        </TabsContent>
      </Tabs>
    </div>
  ),
};

// Big Size
export const BigSize: Story = {
  render: () => (
    <div className="w-[400px]">
      <Tabs defaultValue="tab1">
        <TabsList variant="default" size="big">
          <TabsTrigger value="tab1" layout="column" size="big" icon={<UserIcon />}>
            Account
          </TabsTrigger>
          <TabsTrigger value="tab2" layout="column" size="big" icon={<KeyRound />}>
            Password
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="mt-4">
          Make changes to your account here.
        </TabsContent>
        <TabsContent value="tab2" className="mt-4">
          Change your password here.
        </TabsContent>
      </Tabs>
    </div>
  ),
};

// Disabled
export const Disabled: Story = {
  render: () => (
    <div className="w-[400px]">
      <Tabs defaultValue="tab1">
        <TabsList variant="disabled" size="default">
          <TabsTrigger value="tab1" layout="row" variant="disabled" icon={<UserIcon />}>
            Account
          </TabsTrigger>
          <TabsTrigger value="tab2" layout="row" variant="disabled" icon={<KeyRound />}>
            Password
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="mt-4">
          Make changes to your account here.
        </TabsContent>
        <TabsContent value="tab2" className="mt-4">
          Change your password here.
        </TabsContent>
      </Tabs>
    </div>
  ),
};

// Big Size Disabled
export const BigSizeDisabled: Story = {
  render: () => (
    <div className="w-[400px]">
      <Tabs defaultValue="tab1">
        <TabsList variant="disabled" size="big">
          <TabsTrigger value="tab1" layout="column" size="big" variant="disabled" icon={<UserIcon />}>
            Account
          </TabsTrigger>
          <TabsTrigger value="tab2" layout="column" size="big" variant="disabled" icon={<KeyRound />}>
            Password
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="mt-4">
          Make changes to your account here.
        </TabsContent>
        <TabsContent value="tab2" className="mt-4">
          Change your password here.
        </TabsContent>
      </Tabs>
    </div>
  ),
};

// Without Icons
export const WithoutIcons: Story = {
  render: () => (
    <div className="w-[400px]">
      <Tabs defaultValue="tab1">
        <TabsList variant="default" size="default">
          <TabsTrigger value="tab1" layout="row" showIcon={false}>
            Account
          </TabsTrigger>
          <TabsTrigger value="tab2" layout="row" showIcon={false}>
            Password
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="mt-4">
          Make changes to your account here.
        </TabsContent>
        <TabsContent value="tab2" className="mt-4">
          Change your password here.
        </TabsContent>
      </Tabs>
    </div>
  ),
};

// Multiple Tabs
export const MultipleTabs: Story = {
  render: () => (
    <div className="w-full">
      <Tabs defaultValue="tab1">
        <TabsList variant="default" size="default">
          <TabsTrigger value="tab1" layout="row" icon={<InfoIcon />}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="tab2" layout="row" icon={<InfoIcon />}>
            Analytics
          </TabsTrigger>
          <TabsTrigger value="tab3" layout="row" icon={<InfoIcon />}>
            Reports
          </TabsTrigger>
          <TabsTrigger value="tab4" layout="row" icon={<InfoIcon />}>
            Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="mt-4">
          Overview content here.
        </TabsContent>
        <TabsContent value="tab2" className="mt-4">
          Analytics content here.
        </TabsContent>
        <TabsContent value="tab3" className="mt-4">
          Reports content here.
        </TabsContent>
        <TabsContent value="tab4" className="mt-4">
          Settings content here.
        </TabsContent>
      </Tabs>
    </div>
  ),
};
