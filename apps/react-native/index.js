import App from "./src/App"
import { registerRootComponent } from "expo"
import { LogBox } from 'react-native';


// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App)


LogBox.ignoreAllLogs();//Ignore all log notifications