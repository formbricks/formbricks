import { redirect } from "next/navigation";

export default function ProductPage({ params }) {
  return redirect(`/environments/${params.environmentId}/product/general`);
}
