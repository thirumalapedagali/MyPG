import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth';
import { colors } from './src/ui';
import Dashboard from './src/screens/Dashboard';
import Today from './src/screens/Today';
import Overview from './src/screens/Overview';
import Rooms from './src/screens/Rooms';
import Residents from './src/screens/Residents';
import Expenses from './src/screens/Expenses';
import MyDues from './src/screens/MyDues';
import Login from './src/screens/Login';
import Account, { MustChangePassword } from './src/screens/Account';
import Users from './src/screens/Users';
import Pgs from './src/screens/Pgs';
import ExploreScreen from './src/screens/ExploreScreen';
import ResidentDashboard from './src/screens/ResidentDashboard';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const ICONS: Record<string, [IconName, IconName]> = {
  Home: ['home', 'home-outline'],
  Dashboard: ['home', 'home-outline'],
  Today: ['grid', 'grid-outline'],
  Overview: ['bar-chart', 'bar-chart-outline'],
  Rooms: ['bed', 'bed-outline'],
  Availability: ['bed', 'bed-outline'],
  Explore: ['search', 'search-outline'],
  Residents: ['people', 'people-outline'],
  Expenses: ['receipt', 'receipt-outline'],
  'My Dues': ['wallet', 'wallet-outline'],
  Account: ['person-circle', 'person-circle-outline'],
};

/** Same bottom-tab look as AgroMobileApp: pill behind the active icon, small bold labels. */
function useScreenOptions() {
  const insets = useSafeAreaInsets();
  return ({ route }: { route: { name: string } }) => ({
    headerShown: false,
    tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: colors.tab,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: {
      height: 64 + insets.bottom,
      paddingTop: 6,
      paddingBottom: insets.bottom,
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      elevation: 10,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: -3 },
    },
    tabBarLabelStyle: { fontSize: 10, fontWeight: '700' as const, marginTop: 2 },
    tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => {
      const [on, off] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
      return (
        <View style={[st.iconWrap, focused && st.iconWrapOn]}>
          <Ionicons name={focused ? on : off} size={21} color={focused ? colors.tab : color} />
        </View>
      );
    },
  });
}

function OwnerTabs() {
  const opts = useScreenOptions();
  return (
    <Tab.Navigator screenOptions={opts}>
      <Tab.Screen name="Dashboard" component={Dashboard} />
      <Tab.Screen name="Today" component={Today} />
      <Tab.Screen name="Overview" component={Overview} />
      <Tab.Screen name="Rooms" component={Rooms} />
      <Tab.Screen name="Residents" component={Residents} />
      <Tab.Screen name="Expenses" component={Expenses} />
      <Tab.Screen name="Account" component={Account} />
    </Tab.Navigator>
  );
}

function ResidentTabs() {
  const opts = useScreenOptions();
  return (
    <Tab.Navigator screenOptions={opts}>
      <Tab.Screen name="Home" component={ResidentDashboard} />
      <Tab.Screen name="My Dues" component={MyDues} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Availability">{() => <Rooms editable={false} />}</Tab.Screen>
      <Tab.Screen name="Account" component={Account} />
    </Tab.Navigator>
  );
}

function Root() {
  const { ready, user } = useAuth();
  if (!ready)
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  if (!user) return <Login />;
  if (user.mustChangePassword) return <MustChangePassword />;

  // A super admin has no PG until one is opened, so the PG list is the only screen they can use.
  const needsPg = user.role === 'SUPER_ADMIN' && user.pgId == null;
  const Main = user.role === 'RESIDENT' ? ResidentTabs : OwnerTabs;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {needsPg ? (
        <Stack.Screen name="Pgs" component={Pgs} />
      ) : (
        <>
          <Stack.Screen name="Main" component={Main} />
          {user.role !== 'RESIDENT' && <Stack.Screen name="Users" component={Users} />}
          {user.role !== 'RESIDENT' && <Stack.Screen name="Pgs" component={Pgs} />}
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <Root />
          <StatusBar style="dark" />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', width: 42, height: 30, borderRadius: 15 },
  iconWrapOn: { backgroundColor: colors.tabActiveBg },
});
