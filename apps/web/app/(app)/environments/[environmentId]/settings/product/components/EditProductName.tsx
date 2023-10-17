"use client";

import { updateProductAction } from "../actions";
import { TProduct } from "@formbricks/types/v1/product";
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

type TEditProductName = {
  name: string;
};

type EditProductNameProps = {
  product: TProduct;
  environmentId: string;
};

const EditProductName: React.FC<EditProductNameProps> = ({ product, environmentId }) => {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TEditProductName>({
    defaultValues: {
      name: product.name,
    },
  });

  const updateProduct: SubmitHandler<TEditProductName> = async (data) => {
    try {
      const updatedProduct = await updateProductAction(environmentId, product.id, data);
      if (!!updatedProduct?.id) {
        toast.success("Product name updated successfully.");
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      toast.error(`Error: Unable to save product information`);
    }
  };

  return (
    <form className="w-full max-w-sm items-center" onSubmit={handleSubmit(updateProduct)}>
      <Label htmlFor="fullname">What&apos;s your product called?</Label>
      <Input
        type="text"
        id="fullname"
        defaultValue={product.name}
        {...register("name", { required: { value: true, message: "Product name can't be empty" } })}
      />

      {errors?.name ? (
        <div className="my-2">
          <p className="text-xs text-red-500">{errors?.name?.message}</p>
        </div>
      ) : null}

      <Button type="submit" variant="darkCTA" className="mt-4">
        Update
      </Button>
    </form>
  );
};

export default EditProductName;
