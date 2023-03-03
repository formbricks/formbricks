import AppPage from "../AppPage";
import Widget from "./Widget";

export const metadata = {
  title: "Widget Overview",
};

export default function Page() {
  return (
    <div>
      <Widget />
      <AppPage />
    </div>
  );
}
