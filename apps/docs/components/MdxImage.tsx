import Image, { ImageProps } from "next/image";

export const MdxImage = (props: ImageProps) => {
  return (
    <Image
      {...props}
      alt={props.alt}
      sizes="100vw"
      style={{
        width: "100%",
        height: "auto",
      }}
    />
  );
};
