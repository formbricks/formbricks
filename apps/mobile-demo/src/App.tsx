import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Button, LogBox, StyleSheet, Text, View } from "react-native";
import Formbricks, { track } from "@formbricks/react-native";

LogBox.ignoreAllLogs();

export default function App() {
  const [text, setText] = useState("Formbricks React Native SDK Demo");
  const config = {
    environmentId: "clxslarzk000l3evo1z1iv0s0",
    apiHost: "http://localhost:3000",
    userId: "111",
  };

  return (
    <View style={styles.container}>
      <Text>{text}</Text>

      <Button
        title="Trigger Code Action"
        onPress={() => {
          track("test");
        }}
      />
      <StatusBar style="auto" />
      <Formbricks initializationConfig={config} />
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
