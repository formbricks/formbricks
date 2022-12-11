import { useState } from "react";
import AppPage from "../components/AppPage";
import PmfModal from "../components/PmfModal";

export default function Example() {
  const [openModal, setOpenModal] = useState(true);

  return (
    <>
      <AppPage />
      <PmfModal open={openModal} setOpen={setOpenModal} />
    </>
  );
}
