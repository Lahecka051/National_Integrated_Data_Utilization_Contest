import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { RootStackParamList } from './types'
import { Colors } from '../utils/colors'

import LandingScreen from '../screens/LandingScreen'
import ErrandSelectScreen from '../screens/ErrandSelectScreen'
import DateSelectScreen from '../screens/DateSelectScreen'
import LoadingScreen from '../screens/LoadingScreen'
import ResultScreen from '../screens/ResultScreen'

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.gray[900],
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        headerBackTitle: '뒤로',
        contentStyle: { backgroundColor: '#f8fafc' },
      }}
    >
      <Stack.Screen
        name="Landing"
        component={LandingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ErrandSelect"
        component={ErrandSelectScreen}
        options={{ title: '용무 선택' }}
      />
      <Stack.Screen
        name="DateSelect"
        component={DateSelectScreen}
        options={{ title: '날짜 선택' }}
      />
      <Stack.Screen
        name="Loading"
        component={LoadingScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="Result"
        component={ResultScreen}
        options={{ title: '추천 결과', headerBackVisible: false }}
      />
    </Stack.Navigator>
  )
}
