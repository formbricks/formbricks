import { StatusBar } from "expo-status-bar";
import { Button, LogBox, StyleSheet, Text, View } from "react-native";
import Formbricks, { track } from "@formbricks/react-native";

LogBox.ignoreAllLogs();

export default function App() {
  const config = {
    environmentId: "clyr6frui0009v2pn32q5fxd3",
    // apiHost: "http://localhost:3000",
    apiHost: process.env.EXPO_PUBLIC_API_HOST!,
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
          track("test");
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
