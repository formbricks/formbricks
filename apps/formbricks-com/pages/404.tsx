// 404.js
import { Button } from "@formbricks/ui/Button";

export default function FourOhFour() {
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h1 className="text-8xl font-bold text-slate-300">404</h1>
      <h1 className="mb-8 text-xl text-slate-300">Page Not Found</h1>
      <Button href="/" variant="highlight">
        Go back home
      </Button>
    </div>
  );
}
