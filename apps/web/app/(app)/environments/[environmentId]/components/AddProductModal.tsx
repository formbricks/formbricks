"use client";

import { createProductAction } from "@/app/(app)/environments/[environmentId]/actions";
import { PlusCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Modal } from "@formbricks/ui/Modal";

interface AddProductModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
}

export default function AddProductModal({ environmentId, open, setOpen }: AddProductModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [productName, setProductName] = useState("");
  const isProductNameValid = productName.trim() !== "";
  const { register, handleSubmit } = useForm();

  const submitProduct = async (data: { name: string }) => {
    data.name = data.name.trim();
    if (!isProductNameValid) return;

    try {
      setLoading(true);
      const newEnv = await createProductAction(environmentId, data.name);

      toast.success("Product created successfully!");
      router.push(`/environments/${newEnv.id}/`);
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(`Error: Unable to save product information`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-10 w-10 text-slate-500">
                <PlusCircleIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">Add Product</div>
                <div className="text-sm text-slate-500">Create a new product for your team.</div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitProduct)}>
          <div className="flex w-full justify-between space-y-4 rounded-lg p-6">
            <div className="grid w-full gap-x-2">
              <div>
                <Label>Name</Label>
                <Input
                  autoFocus
                  placeholder="e.g. My New Product"
                  {...register("name", { required: true })}
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 p-6">
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="minimal"
                onClick={() => {
                  setOpen(false);
                }}>
                Cancel
              </Button>
              <Button variant="darkCTA" type="submit" loading={loading} disabled={!isProductNameValid}>
                Add product
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
