"use client";

import { useProduct } from "@/lib/products/products";
import React from "react";

interface IEditTagsWrapperProps {
  environmentId: string;
}

const EditTagsWrapper: React.FC<IEditTagsWrapperProps> = (props) => {
  const { environmentId } = props;
  const { product } = useProduct(environmentId);
  console.log({ product });

  return <div>EditTagsWrapper</div>;
};

export default EditTagsWrapper;
