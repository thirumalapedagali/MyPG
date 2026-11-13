import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const LOGO = require('../assets/MyStay.png');

/** Full-screen intro shown when the app opens: logo springs in while a ring pulses behind it, then the screen fades away. */
export default function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const [logoScale] = useState(() => new Animated.Value(0.6));
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [ring] = useState(() => new Animated.Value(0));
  const [screenOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    // Our own animated view takes over from the native splash, which shows the same logo on white.
    SplashScreen.hideAsync().catch(() => {});

    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(600),
      Animated.timing(screenOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [logoScale, logoOpacity, ring, screenOpacity, onFinish]);

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.35] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.35, 0] });

  return (
    <Animated.View style={[st.page, { opacity: screenOpacity }]} pointerEvents="none">
      <View style={st.center}>
        <Animated.View style={[st.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
        <Animated.Image
          source={LOGO}
          resizeMode="contain"
          style={[st.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        />
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  page: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  center: { alignItems: 'center', justifyContent: 'center', width: 320, height: 320 },
  ring: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 4,
    borderColor: '#7b1fa2',
  },
  logo: { width: 240, height: 240 },
});
