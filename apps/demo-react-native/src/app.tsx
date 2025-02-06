import { StatusBar } from "expo-status-bar";
import React, { type JSX } from "react";
import { Button, LogBox, StyleSheet, Text, View } from "react-native";
import Formbricks, {
  logout,
  setAttribute,
  setAttributes,
  setLanguage,
  setUserId,
  track,
} from "@formbricks/react-native";

LogBox.ignoreAllLogs();

export default function App(): JSX.Element {
  if (!process.env.EXPO_PUBLIC_FORMBRICKS_ENVIRONMENT_ID) {
    throw new Error("EXPO_PUBLIC_FORMBRICKS_ENVIRONMENT_ID is required");
  }

  if (!process.env.EXPO_PUBLIC_APP_URL) {
    throw new Error("EXPO_PUBLIC_APP_URL is required");
  }

  return (
    <View style={styles.container}>
      <Text>Formbricks React Native SDK Demo</Text>

      <View
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>
        <Button
          title="Trigger Code Action"
          onPress={() => {
            track("code").catch((error: unknown) => {
              // eslint-disable-next-line no-console -- logging is allowed in demo apps
              console.error("Error tracking event:", error);
            });
          }}
        />

        <Button
          title="Set User Id"
          onPress={() => {
            setUserId("random-user-id").catch((error: unknown) => {
              // eslint-disable-next-line no-console -- logging is allowed in demo apps
              console.error("Error setting user id:", error);
            });
          }}
        />

        <Button
          title="Set User Attributess (multiple)"
          onPress={() => {
            setAttributes({
              testAttr: "attr-test",
              testAttr2: "attr-test-2",
              testAttr3: "attr-test-3",
              testAttr4: "attr-test-4",
            }).catch((error: unknown) => {
              // eslint-disable-next-line no-console -- logging is allowed in demo apps
              console.error("Error setting user attributes:", error);
            });
          }}
        />

        <Button
          title="Set User Attributes (single)"
          onPress={() => {
            setAttribute("testSingleAttr", "testSingleAttr").catch((error: unknown) => {
              // eslint-disable-next-line no-console -- logging is allowed in demo apps
              console.error("Error setting user attributes:", error);
            });
          }}
        />

        <Button
          title="Logout"
          onPress={() => {
            logout().catch((error: unknown) => {
              // eslint-disable-next-line no-console -- logging is allowed in demo apps
              console.error("Error logging out:", error);
            });
          }}
        />

        <Button
          title="Set Language (de)"
          onPress={() => {
            setLanguage("de").catch((error: unknown) => {
              // eslint-disable-next-line no-console -- logging is allowed in demo apps
              console.error("Error setting language:", error);
            });
          }}
        />
      </View>

      <StatusBar style="auto" />

      <Formbricks
        appUrl={process.env.EXPO_PUBLIC_APP_URL as string}
        environmentId={process.env.EXPO_PUBLIC_FORMBRICKS_ENVIRONMENT_ID as string}
      />
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
