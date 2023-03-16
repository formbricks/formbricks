import Modal from "@/components/preview/Modal";
import OpenTextQuestion from "@/components/preview/OpenTextQuestion";

export default function Preview() {
  return (
    <Modal>
      <OpenTextQuestion
        question={{
          id: "123",
          type: "openText",
          headline: "This is a sample question",
          subheader: "a subheader",
          required: true,
        }}
        onSubmit={() => {}}
        lastQuestion={false}
      />
    </Modal>
  );
}
