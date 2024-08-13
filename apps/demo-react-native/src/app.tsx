import { StatusBar } from "expo-status-bar";
import { Button, LogBox, StyleSheet, Text, View } from "react-native";
import Formbricks, { track } from "@formbricks/react-native";

LogBox.ignoreAllLogs();

export default function App() {
  const config = {
    environmentId: "clzi9vr95000ivazb5e291wlm",
    apiHost: process.env.EXPO_PUBLIC_API_HOST ?? "http://localhost:3000",
    userId: "hello-user",
    attributes: {
      language: "en",
      testAttr: "attr-test",
      hello: "Hello",
    },
  };

  return (
    <View style={styles.container}>
      <Text>Formbricks React Native SDK Demo</Text>

      <Button
        title="Trigger Code Action"
        onPress={() => {
          track("code").catch((error: unknown) => {
            // eslint-disable-next-line no-console -- logging is allowed in demo apps
            console.error("Error tracking event:", error);
          });
        }}
      />
      <StatusBar style="auto" />
      <Formbricks initConfig={config} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
