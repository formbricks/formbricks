import { cleanup, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AddMemberRole } from "./add-member-role";

// Mock dependencies
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Create a wrapper component that provides the form context
const FormWrapper = ({
  children,
  defaultValues,
  membershipRole,
  isAccessControlAllowed,
  isFormbricksCloud,
}) => {
  const methods = useForm({ defaultValues });
  return (
    <FormProvider {...methods}>
      <AddMemberRole
        control={methods.control}
        membershipRole={membershipRole}
        isAccessControlAllowed={isAccessControlAllowed}
        isFormbricksCloud={isFormbricksCloud}
      />
      {children}
    </FormProvider>
  );
};

describe("AddMemberRole Component", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultValues = {
    name: "Test User",
    email: "test@example.com",
    role: "member",
    teamIds: [],
  };

  describe("Rendering", () => {
    test("renders role selector when user is owner", () => {
      render(
        <FormWrapper
          defaultValues={defaultValues}
          membershipRole="owner"
          isAccessControlAllowed={true}
          isFormbricksCloud={true}>
          <div />
        </FormWrapper>
      );

      const roleLabel = screen.getByText("common.role_organization");
      expect(roleLabel).toBeInTheDocument();
    });

    test("does not render anything when user is member", () => {
      render(
        <FormWrapper
          defaultValues={defaultValues}
          membershipRole="member"
          isAccessControlAllowed={true}
          isFormbricksCloud={true}>
          <div data-testid="child" />
        </FormWrapper>
      );

      expect(screen.queryByText("common.role_organization")).not.toBeInTheDocument();
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    test("disables the role selector when isAccessControlAllowed is false", () => {
      render(
        <FormWrapper
          defaultValues={defaultValues}
          membershipRole="owner"
          isAccessControlAllowed={false}
          isFormbricksCloud={true}>
          <div />
        </FormWrapper>
      );

      const selectTrigger = screen.getByRole("combobox");
      expect(selectTrigger).toBeDisabled();
    });
  });

  describe("Default values", () => {
    test("displays the default role value", () => {
      render(
        <FormWrapper
          defaultValues={defaultValues}
          membershipRole="owner"
          isAccessControlAllowed={true}
          isFormbricksCloud={true}>
          <div />
        </FormWrapper>
      );

      const selectTrigger = screen.getByRole("combobox");
      expect(selectTrigger).toHaveTextContent("member");
    });
  });
});
