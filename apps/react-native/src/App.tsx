import * as React from 'react';

import { StyleSheet, View, Text } from 'react-native';
import { FormBricks,showSurvey  } from '@formbricks/react-native-sdk';

export default function App() {

  return (
    <>
    <View style={styles.container}>
      <Text onTap={() => {
        showSurvey('clq76qtq2000ov7j6pwns40wn');
      } }>SHOW SURVEY</Text>
    </View><FormBricks />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
