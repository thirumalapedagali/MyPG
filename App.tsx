import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, ToastAndroid, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedSplash from './src/AnimatedSplash';
import { registerForPush, watchPushToken } from './src/push';
import { AuthProvider, useAuth } from './src/auth';
import { PropertyRequired, colors } from './src/ui';
import Dashboard from './src/screens/Dashboard';
import Today from './src/screens/Today';
import Overview from './src/screens/Overview';
import Rooms from './src/screens/Rooms';
import Residents from './src/screens/Residents';
import PendingDues from './src/screens/PendingDues';
import Announcements from './src/screens/Announcements';
import SupportContacts from './src/screens/SupportContacts';
import Complaints from './src/screens/Complaints';
import FoodMenu from './src/screens/FoodMenu';
import Feedback from './src/screens/Feedback';
import AdminFeedback from './src/screens/AdminFeedback';
import CheckinRequests from './src/screens/CheckinRequests';
import VacateRequests from './src/screens/VacateRequests';
import Expenses from './src/screens/Expenses';
import MyDues from './src/screens/MyDues';
import Login from './src/screens/Login';
import Account, { MustChangePassword } from './src/screens/Account';
import Users from './src/screens/Users';
import Pgs from './src/screens/Pgs';
import AdminHome from './src/screens/AdminHome';
import AdminUsers from './src/screens/AdminUsers';
import AdminAnalytics from './src/screens/AdminAnalytics';
import PropertyUserStats from './src/screens/PropertyUserStats';
import Registrations from './src/screens/Registrations';
import Lookups from './src/screens/Lookups';
import PropertyCatalog from './src/screens/PropertyCatalog';
import PropertySetup from './src/screens/PropertySetup';
import PropertyTypes from './src/screens/PropertyTypes';
import ExploreScreen from './src/screens/ExploreScreen';
import ResidentDashboard from './src/screens/ResidentDashboard';
import Notifications from './src/screens/Notifications';
import { initNotificationListeners } from './src/notificationStore';

// Keep the native splash up until the animated intro is mounted and takes over.
SplashScreen.preventAutoHideAsync().catch(() => {});

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

/** Rooms, residents and expenses belong to one property: while an owner views "All Properties", ask them to pick one. */
function PerProperty({ title, children }: { title: string; children: React.ReactNode }) {
  const { user } = useAuth();
  return user?.allProperties ? <PropertyRequired title={title} /> : <>{children}</>;
}

function OwnerTabs() {
  const opts = useScreenOptions();
  return (
    <Tab.Navigator screenOptions={opts} backBehavior="history">
      <Tab.Screen name="Dashboard" component={Dashboard} />
      <Tab.Screen name="Today" component={Today} />
      <Tab.Screen name="Overview" component={Overview} />
      <Tab.Screen name="Rooms">
        {({ route, navigation }) => (
          <PerProperty title="Rooms">
            <Rooms navigation={navigation} addSignal={(route.params as { add?: number } | undefined)?.add} />
          </PerProperty>
        )}
      </Tab.Screen>
      <Tab.Screen name="Residents">
        {({ navigation, route }) => (
          <PerProperty title="Residents">
            <Residents navigation={navigation} route={route} />
          </PerProperty>
        )}
      </Tab.Screen>
      <Tab.Screen name="Expenses">
        {({ route }) => (
          <PerProperty title="Expenses">
            <Expenses addSignal={(route.params as { add?: number } | undefined)?.add} />
          </PerProperty>
        )}
      </Tab.Screen>
      
      <Tab.Screen name="Account" component={Account} />
    </Tab.Navigator>
  );
}

function ResidentTabs() {
  const opts = useScreenOptions();
  return (
    <Tab.Navigator screenOptions={opts} backBehavior="history">
      <Tab.Screen name="Home" component={ResidentDashboard} />
      <Tab.Screen name="My Dues" component={MyDues} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Availability">{() => <Rooms editable={false} />}</Tab.Screen>
      <Tab.Screen name="Account" component={Account} />
    </Tab.Navigator>
  );
}

/** All authenticated users get push notifications: register this phone once they are signed in and past the forced password change. */
function usePushRegistration() {
  const { user } = useAuth();
const eligible = user != null && user.mustChangePassword === false;  useEffect(() => {
    if (!eligible) return;
    registerForPush();
    return watchPushToken();
  }, [eligible]);
}

function Root() {
  const { ready, user } = useAuth();
  usePushRegistration();
  if (!ready)
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  if (!user) return <Login />;
  if (user.mustChangePassword) return <MustChangePassword />;

  // A super admin has no PG until one is opened, so only the admin console screens are available.
  const needsPg = user.role === 'SUPER_ADMIN' && user.pgId == null;
  const Main = user.role === 'RESIDENT' ? ResidentTabs : OwnerTabs;

  // Switching property remounts the navigator so every screen reloads that property's data.
  return (
    <Stack.Navigator key={`${user.pgId ?? 'none'}-${user.allProperties ? 'all' : 'one'}`} screenOptions={{ headerShown: false }}>
      {needsPg ? (
        <>
          <Stack.Screen name="AdminHome" component={AdminHome} />
          <Stack.Screen name="Pgs" component={Pgs} />
          <Stack.Screen name="AdminUsers" component={AdminUsers} />
          <Stack.Screen name="AdminAnalytics" component={AdminAnalytics} />
          <Stack.Screen name="PropertyUserStats" component={PropertyUserStats} />
          <Stack.Screen name="Registrations" component={Registrations} />
          <Stack.Screen name="Lookups" component={Lookups} />
          <Stack.Screen name="PropertyTypes" component={PropertyTypes} />
          <Stack.Screen name="PropertyCatalog" component={PropertyCatalog} />
          <Stack.Screen name="AdminFeedback" component={AdminFeedback} />
          <Stack.Screen name="Notifications" component={Notifications} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={Main} />
          {user.role !== 'RESIDENT' && <Stack.Screen name="PendingDues" component={PendingDues} />}
          <Stack.Screen name="Announcements" component={Announcements} />
          {user.role !== 'RESIDENT' && <Stack.Screen name="SupportContacts" component={SupportContacts} />}
          {user.role !== 'RESIDENT' && <Stack.Screen name="PropertySetup" component={PropertySetup} />}
          {user.role !== 'RESIDENT' && <Stack.Screen name="Complaints" component={Complaints} />}
          <Stack.Screen name="FoodMenu" component={FoodMenu} />
          <Stack.Screen name="Feedback" component={Feedback} />
          {user.role !== 'RESIDENT' && <Stack.Screen name="CheckinRequests" component={CheckinRequests} />}
          {user.role !== 'RESIDENT' && <Stack.Screen name="VacateRequests" component={VacateRequests} />}
          {user.role !== 'RESIDENT' && <Stack.Screen name="Users" component={Users} />}
          {user.role !== 'RESIDENT' && <Stack.Screen name="Pgs" component={Pgs} />}
          {user.role === 'SUPER_ADMIN' && <Stack.Screen name="AdminAnalytics" component={AdminAnalytics} />}
          {user.role === 'SUPER_ADMIN' && <Stack.Screen name="PropertyUserStats" component={PropertyUserStats} />}
          <Stack.Screen name="Notifications" component={Notifications} />
        </>
      )}
    </Stack.Navigator>
  );
}

function useDoubleBackToExit(navRef: ReturnType<typeof useNavigationContainerRef>) {
  const lastBackPress = useRef<number>(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      if (!navRef.isReady()) return false;

      if (navRef.canGoBack()) {
        navRef.goBack();
        return true;
      }

      const now = Date.now();
      if (lastBackPress.current && now - lastBackPress.current < 2000) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPress.current = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navRef]);
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const onSplashDone = useCallback(() => setShowSplash(false), []);
  const navRef = useNavigationContainerRef();

  useEffect(() => {
    const cleanup = initNotificationListeners();
    return cleanup;
  }, []);

  useDoubleBackToExit(navRef);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navRef}>
          <Root />
          <StatusBar style="dark" />
        </NavigationContainer>
      </AuthProvider>
      {showSplash && <AnimatedSplash onFinish={onSplashDone} />}
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', width: 42, height: 30, borderRadius: 15 },
  iconWrapOn: { backgroundColor: colors.tabActiveBg },
});
