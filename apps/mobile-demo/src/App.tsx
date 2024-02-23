import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Button, LogBox, StyleSheet, Text, View } from "react-native";

import Formbricks, { track } from "@formbricks/react-native";

LogBox.ignoreAllLogs();

export default function App() {
  const [text, setText] = useState("Formbricks React Native SDK Demo");
  const config = {
    environmentId: "cls9j2dox000ahde62sjgfw08",
    apiHost: "http://192.168.4.30:3000",
    debug: true,
    userId: "111",
    attributes: {
      userId: "111",
    },
  };
  return (
    <View style={styles.container}>
      <Text>{text}</Text>

      <Button
        title="Trigger Code Action"
        onPress={() => {
          track("rn-code-action");
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
