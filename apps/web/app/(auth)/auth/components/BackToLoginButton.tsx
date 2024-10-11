import { Button } from "@formbricks/ui/components/Button";

export const BackToLoginButton = () => {
  return (
    <Button variant="secondary" href="/auth/login" className="w-full justify-center">
      Login
    </Button>
  );
};
