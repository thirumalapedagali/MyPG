import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth';
import {
  NotificationItem,
  clearAllNotifications,
  deleteNotification,
  subscribeNotifications,
} from '../notificationStore';
import { Card, Empty, HeaderAction, Screen, colors, s } from '../ui';

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  useEffect(() => {
    // Subscribe to notification store changes
    const unsubscribe = subscribeNotifications((items) => {
      setNotifications(items);
    });
    return unsubscribe;
  }, []);

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert('Clear all', 'Are you sure you want to clear all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await clearAllNotifications();
        },
      },
    ]);
  };

  const handleDeleteOne = async (id: string) => {
    await deleteNotification(id);
  };

  const handleNotificationPress = (n: NotificationItem) => {
    const title = n.title.toLowerCase();
    const body = n.body.toLowerCase();

    if (title.includes('announcement') || body.includes('announcement')) {
      navigation.navigate('Announcements');
    } else if (title.includes('complaint') || body.includes('complaint')) {
      if (user?.role !== 'RESIDENT') {
        navigation.navigate('Complaints');
      } else {
        navigation.navigate('Main'); // Residents view complaints in hub
      }
    } else if (title.includes('check-in') || body.includes('check-in')) {
      if (user?.role !== 'RESIDENT') {
        navigation.navigate('CheckinRequests');
      } else {
        navigation.navigate('Main');
      }
    } else if (title.includes('vacate') || body.includes('vacate')) {
      if (user?.role !== 'RESIDENT') {
        navigation.navigate('VacateRequests');
      } else {
        navigation.navigate('Main');
      }
    } else if (title.includes('payment') || title.includes('due') || body.includes('payment') || body.includes('due')) {
      if (user?.role !== 'RESIDENT') {
        navigation.navigate('PendingDues');
      } else {
        navigation.navigate('Main');
      }
    } else {
      navigation.navigate('Main');
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      // Format as "Nov 8, 5:30 PM"
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      return `${dateStr}, ${timeStr}`;
    } catch {
      return isoString;
    }
  };

  return (
    <Screen
      title="Notifications"
      showBack
      action={
        notifications.length > 0 ? (
          <HeaderAction label="Clear All" icon="trash-outline" onPress={handleClearAll} />
        ) : undefined
      }
    >
      {notifications.length === 0 ? (
        <Empty text="No notifications yet." />
      ) : (
        notifications.map((n) => (
          <Card key={n.id}>
            <Pressable onPress={() => handleNotificationPress(n)} style={[s.row, { alignItems: 'flex-start' }]}>
              {/* Notification icon indicator */}
              <View style={styles.iconCircle}>
                <Ionicons name="notifications" size={18} color={colors.primary} />
              </View>

              {/* Text details */}
              <View style={{ flex: 1, marginRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={styles.timestampText}>{formatTimestamp(n.timestamp)}</Text>
                </View>
                <Text style={styles.notificationTitle}>{n.title}</Text>
                {n.body ? <Text style={[s.muted, { marginTop: 4, fontSize: 13 }]}>{n.body}</Text> : null}
                <Text style={styles.tapToViewText}>Tap to view updates →</Text>
              </View>

              {/* Single Delete Action */}
              <Pressable
                onPress={(e) => {
                  e.stopPropagation(); // prevent triggering the card's onPress navigation!
                  handleDeleteOne(n.id);
                }}
                hitSlop={10}
                accessibilityLabel="Delete notification"
                style={styles.deleteButton}
              >
                <Ionicons name="close-circle-outline" size={18} color={colors.muted} />
              </Pressable>
            </Pressable>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  timestampText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 2,
    marginLeft: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  tapToViewText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 6,
  },
});
