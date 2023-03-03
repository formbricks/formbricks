import Button from "@/components/ui/Button";

export default function BackToLoginButton() {
  return (
    <Button variant="secondary" href="/auth/signin" className="w-full justify-center">
      Login
    </Button>
  );
}
