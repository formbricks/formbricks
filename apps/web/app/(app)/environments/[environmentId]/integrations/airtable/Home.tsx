import { Button } from "@/../../packages/ui";

interface handleModalProps {
  handleModal: (data: boolean) => void;
}

export default function Home(props: handleModalProps) {
  const { handleModal } = props;
  return (
    <div className="mt-6 flex w-full flex-col items-center justify-center p-6">
      <div className="flex w-full justify-end">
        <Button onClick={() => handleModal(true)} variant="darkCTA">
          Link new table
        </Button>
      </div>
    </div>
  );
}
