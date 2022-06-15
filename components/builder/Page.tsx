import dynamic from "next/dynamic";
let Editor = dynamic(() => import("./Editor"), {
  ssr: false,
});

export default function Page({}) {
  return (
    <div className="w-full p-10 bg-white rounded-lg">
      {Editor && <Editor />}
    </div>
  );
}
