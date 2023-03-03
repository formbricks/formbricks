import { h, VNode } from "preact";
import { useEffect } from "preact/compat";
import Modal from "./components/Modal";
import Survey from "./components/Survey";

export default function App({ formId, schema, config }): VNode {
  useEffect(() => {
    console.log(JSON.stringify(schema, null, 2));
  }, []);

  return (
    <div className="tailwind-preflight">
      <Modal>
        <Survey schema={schema} config={config} formId={formId} />
      </Modal>
    </div>
  );
}
