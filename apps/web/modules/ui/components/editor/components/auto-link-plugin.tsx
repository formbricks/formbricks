import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { MATCHERS } from "./auto-link-matchers";

export const PlaygroundAutoLinkPlugin = () => {
  return <AutoLinkPlugin matchers={MATCHERS} />;
};
