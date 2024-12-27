import { StatusBar } from "expo-status-bar";
import React, { type JSX } from "react";
import { Button, LogBox, StyleSheet, Text, View } from "react-native";
import Formbricks, { track } from "@formbricks/react-native";

LogBox.ignoreAllLogs();

export default function App(): JSX.Element {
  if (!process.env.EXPO_PUBLIC_FORMBRICKS_ENVIRONMENT_ID) {
    throw new Error("EXPO_PUBLIC_FORMBRICKS_ENVIRONMENT_ID is required");
  }

  if (!process.env.EXPO_PUBLIC_API_HOST) {
    throw new Error("EXPO_PUBLIC_API_HOST is required");
  }

  const config = {
    environmentId: process.env.EXPO_PUBLIC_FORMBRICKS_ENVIRONMENT_ID as string,
    apiHost: process.env.EXPO_PUBLIC_API_HOST as string,
    userId: "random-user-id",
    attributes: {
      language: "en",
      testAttr: "attr-test",
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
