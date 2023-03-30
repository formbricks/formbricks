import { Button } from "@formbricks/ui";

const ContentLayout = ({ headline, description, children }) => {
  return (
    <div className="flex h-screen">
      <div className="m-auto flex flex-col gap-7 text-center text-slate-700">
        <h2 className="text-3xl font-bold ">{headline}</h2>
        <p className="text-2xl  ">{description}</p>
        <div className="flex justify-center gap-5 text-xs">{children}</div>
      </div>
    </div>
  );
};

// TODO: replace support email

export const NotLoggedInContent = ({ email, token, redirectUrl }) => {
  email = encodeURIComponent(email);
  return (
    <ContentLayout headline="Happy to have you 🤗" description="Please create an account or login.">
      <Button variant="secondary" href={`/auth/signup?inviteToken=${token}&email=${email}`}>
        Create account
      </Button>
      <Button variant="primary" href={`/auth/login?callbackUrl=${redirectUrl}&email=${email}`}>
        Login
      </Button>
    </ContentLayout>
  );
};

export const WrongAccountContent = () => {
  return (
    <ContentLayout
      headline="Ooops! Wrong email 🤦"
      description="The email in the invitation does not match yours.">
      <Button variant="secondary" href="/support">
        Contact support
      </Button>
      <Button variant="primary" href="/">
        Go to app
      </Button>
    </ContentLayout>
  );
};

export const RightAccountContent = () => {
  return (
    <ContentLayout headline="You’re in 🎉" description="Welcome to the team.">
      <Button variant="primary" href="/">
        Go to app
      </Button>
    </ContentLayout>
  );
};

export const ExpiredContent = () => {
  return (
    <ContentLayout
      headline="Invite expired 😥"
      description="The invitation was valid for 7 days. Please request a new invite.">
      <div></div>
    </ContentLayout>
  );
};

export const UsedContent = () => {
  return (
    <ContentLayout
      headline="You’re already part of the squad."
      description="This invitation has already been used.">
      <Button variant="secondary" href="/support">
        Contact support
      </Button>
      <Button variant="primary" href="/">
        Go to app
      </Button>
    </ContentLayout>
  );
};
