import DummyFace from "@/images/formtribe/jojo.jpeg";
import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa6";

export const ProfileImage: React.FC = ({}) => {
  return (
    <Link
      href="https://github.com"
      target="_blank"
      className="group rotate-0 transition-transform hover:-rotate-6">
      <div className="-mb-12 mt-8 flex items-center justify-center pb-4 text-sm text-slate-100 transition-all group-hover:mb-0 group-hover:mt-0">
        <FaGithub className=" mr-2 h-5 w-5" />
        <p>jobenjada</p>
      </div>
      <Image
        src={DummyFace}
        alt="Dummy Face"
        className="ring-brand-dark rounded-lg ring-offset-4 ring-offset-slate-900 transition-all hover:scale-105 hover:ring-1"
      />
    </Link>
  );
};

export default ProfileImage;
