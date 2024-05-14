import Image, { ImageProps } from "next/image";
import React from "react";

export const MdxImage = (props: ImageProps) => {
  return <Image {...props} alt={props.alt} />;
};
