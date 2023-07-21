"use client";

import Modal from "@/components/shared/Modal";
import { createProduct } from "@/lib/products/products";
import { Button, Input, Label } from "@formbricks/ui";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

interface AddProductModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
}

export default function AddProductModal({ environmentId, open, setOpen }: AddProductModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm();

  const submitProduct = async (data) => {
    setLoading(true);
    const newEnv = await createProduct(environmentId, data);
    router.push(`/environments/${newEnv.id}/`);
    setOpen(false);
    setLoading(false);
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-10 w-10 text-slate-500">
                <PlusCircleIcon />
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
                <Input placeholder="e.g. My New Product" {...register("name", { required: true })} />
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
              <Button variant="darkCTA" type="submit" loading={loading}>
                Add product
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
