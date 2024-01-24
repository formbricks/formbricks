import { registerRootComponent } from "expo";
import { LogBox } from "react-native";

import App from "./src/App";

registerRootComponent(App);

LogBox.ignoreAllLogs();
