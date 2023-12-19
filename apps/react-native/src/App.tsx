import * as React from 'react';

import { StyleSheet, View, Text } from 'react-native';
import { FormBricks,showSurvey  } from '@formbricks/react-native-sdk';

export default function App() {
  const handleShowSurvey = () => {
    showSurvey('YOUR_SURVEY_ID');
  };

  return (
    <>
      <View style={styles.container}>
        <Text onPress={handleShowSurvey}>Show Survey</Text>
      </View>
      <FormBricks />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
