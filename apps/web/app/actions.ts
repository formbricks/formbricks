"use server";

import { redirect } from "next/navigation";

export const redirectHomeAction = () => {
  redirect("/");
};
