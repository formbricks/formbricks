import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LogBox, StyleSheet, Text, View } from "react-native";

import { init, test } from "@formbricks/react-native";

LogBox.ignoreAllLogs();

export default function App() {
  useEffect(() => {
    init({
      environmentId: "cls6h9rs3000aqy2y1v35z74z",
      apiHost: "http://localhost:3000",
      debug: true,
    });
  }, []);
  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <Text>{test()}</Text>
      <StatusBar style="auto" />
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
