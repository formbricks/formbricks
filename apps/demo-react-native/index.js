import { registerRootComponent } from "expo";
import { LogBox } from "react-native";
import App from "./src/app";

registerRootComponent(App);

LogBox.ignoreAllLogs();
