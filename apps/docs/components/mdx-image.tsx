import Image, { type ImageProps } from "next/image";

export function MdxImage(props: ImageProps) {
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
}
