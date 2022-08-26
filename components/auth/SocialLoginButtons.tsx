import Spacer from '../Spacer';
import GithubLoginButton from './GithubLoginButton';
import GoogleLoginButton from './GoogleLoginButton';

const SocialLoginButtons = ({ text }: { text?: string }) => {
  return (
    <>
      <Spacer text={text} />

      <div className="flex flex-col items-center">
        <GithubLoginButton noMx />
        <GoogleLoginButton noMx />
      </div>
    </>
  );
};

export default SocialLoginButtons;
