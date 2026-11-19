import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { get } from '../api';
import { useResource } from '../hooks';
import { AdminAnalytics as AdminAnalyticsType } from '../types';
import { Card, Chips, HeaderAction, Screen, Stat, colors, s } from '../ui';

const TIME_RANGES = ['24 Hours (DAU)', '7 Days (WAU)', '30 Days (MAU)'] as const;
type TimeRange = (typeof TIME_RANGES)[number];

export default function AdminAnalytics() {
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const [range, setRange] = useState<TimeRange>('24 Hours (DAU)');

  const { data, error, loading, refreshing, refresh } = useResource(async () => {
    return await get<AdminAnalyticsType>('/api/admin/analytics');
  });

  const stats = data;

  const activeCount =
    range === '24 Hours (DAU)'
      ? stats?.activeUsers24h ?? 0
      : range === '7 Days (WAU)'
      ? stats?.activeUsers7d ?? 0
      : stats?.activeUsers30d ?? 0;

  const activePct =
    stats?.totalUsers && stats.totalUsers > 0
      ? Math.round((activeCount / stats.totalUsers) * 100)
      : 0;

  return (
    <Screen
      title="App Analytics"
      action={
        <HeaderAction label="Back" icon="chevron-back" onPress={() => nav.goBack()} />
      }
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {stats && (
        <>
          {/* ── Time Range Switcher for Active Users ── */}
          <Text style={[s.muted, { marginBottom: 6, fontWeight: '600' }]}>
            Active Users & Engagement
          </Text>
          <Chips options={TIME_RANGES} value={range} onChange={setRange} />

          {/* ── Featured Active Users Hero Card ── */}
          <Card style={{ backgroundColor: colors.primary, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: '#e0e7ff', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' }}>
                  Active App Users ({range.split(' ')[0]})
                </Text>
                <Text style={{ color: '#ffffff', fontSize: 36, fontWeight: '800', marginVertical: 4 }}>
                  {activeCount}
                </Text>
                <Text style={{ color: '#c7d2fe', fontSize: 13 }}>
                  {activePct}% of {stats.totalUsers} total registered users
                </Text>
              </View>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="pulse" size={32} color="#ffffff" />
              </View>
            </View>

            {/* Active Users Bar Progress */}
            <View
              style={{
                height: 8,
                backgroundColor: 'rgba(255,255,255,0.25)',
                borderRadius: 4,
                marginTop: 14,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${Math.min(activePct, 100)}%`,
                  backgroundColor: '#60a5fa',
                  borderRadius: 4,
                }}
              />
            </View>

            {/* Role Breakdown pill summary */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#c084fc' }} />
                <Text style={{ color: '#f3e8ff', fontSize: 12, fontWeight: '600' }}>
                  Owners: {stats.activeOwners24h}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#93c5fd' }} />
                <Text style={{ color: '#dbeafe', fontSize: 12, fontWeight: '600' }}>
                  Managers: {stats.activeManagers24h}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#5eead4' }} />
                <Text style={{ color: '#ccfbf1', fontSize: 12, fontWeight: '600' }}>
                  Residents: {stats.activeResidents24h}
                </Text>
              </View>
            </View>
          </Card>

          {/* ── Registered Users & Accounts Breakdown ── */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={s.h2}>User Accounts Overview</Text>
            <Pressable onPress={() => nav.navigate('PropertyUserStats')}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Property-wise breakdown →</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <Stat
              icon="people-outline"
              label="Total Users"
              value={String(stats.totalUsers)}
              color={colors.blue}
              onPress={() => nav.navigate('AdminUsers')}
            />
            <Stat
              icon="key-outline"
              label="Owners"
              value={String(stats.totalOwners)}
              color="#7c3aed"
              onPress={() => nav.navigate('AdminUsers')}
            />
            <Stat
              icon="briefcase-outline"
              label="Managers"
              value={String(stats.totalManagers)}
              color={colors.blue}
              onPress={() => nav.navigate('AdminUsers')}
            />
            <Stat
              icon="home-outline"
              label="Residents"
              value={String(stats.totalResidents)}
              color="#0d9488"
              onPress={() => nav.navigate('AdminUsers')}
            />
            <Stat
              icon="ban-outline"
              label="Blocked Users"
              value={String(stats.blockedUsers)}
              color={colors.bad}
              onPress={() => nav.navigate('AdminUsers')}
            />
          </View>

          {/* ── Platform Capacity & Occupancy ── */}
          <Text style={[s.h2, { marginBottom: 8 }]}>Beds & Occupancy Analytics</Text>
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Platform Occupancy Rate</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.good }}>
                {stats.occupancyRatePercentage}%
              </Text>
            </View>
            <View
              style={{
                height: 10,
                backgroundColor: '#f1f5f9',
                borderRadius: 5,
                overflow: 'hidden',
                marginBottom: 14,
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${Math.min(stats.occupancyRatePercentage, 100)}%`,
                  backgroundColor: colors.good,
                  borderRadius: 5,
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 6 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{stats.totalBeds}</Text>
                <Text style={s.muted}>Total Beds</Text>
              </View>
              <View style={{ width: 1, backgroundColor: colors.border }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.good }}>{stats.occupiedBeds}</Text>
                <Text style={s.muted}>Occupied Beds</Text>
              </View>
              <View style={{ width: 1, backgroundColor: colors.border }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.blue }}>{stats.vacantBeds}</Text>
                <Text style={s.muted}>Vacant Beds</Text>
              </View>
            </View>
          </Card>

          {/* ── Property & License Health ── */}
          <Text style={[s.h2, { marginBottom: 8 }]}>Properties & Licensing</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <Stat
              icon="business-outline"
              label="Total PGs"
              value={String(stats.totalPgs)}
              color={colors.blue}
              onPress={() => nav.navigate('Pgs')}
            />
            <Stat
              icon="checkmark-circle-outline"
              label="Active Properties"
              value={String(stats.activePgs)}
              color={colors.good}
              onPress={() => nav.navigate('Pgs')}
            />
            <Stat
              icon="hourglass-outline"
              label="Pending Approvals"
              value={String(stats.pendingRegistrations)}
              color={colors.warn}
              onPress={() => nav.navigate('Registrations')}
            />
            <Stat
              icon="alert-circle-outline"
              label="Expired / Expiring"
              value={String(stats.expiredPgs + stats.expiringSoonPgs)}
              sub={`${stats.expiredPgs} expired · ${stats.expiringSoonPgs} soon`}
              color={colors.bad}
              onPress={() => nav.navigate('Pgs')}
            />
          </View>

          {/* ── Operations & Service Requests ── */}
          <Text style={[s.h2, { marginBottom: 8 }]}>Operations & Support</Text>
          <Card style={{ marginBottom: 20 }}>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="chatbubbles-outline" size={20} color={colors.warn} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Open Complaints</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.warn }}>
                  {stats.openComplaints}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="construct-outline" size={20} color={colors.blue} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>In-Progress Complaints</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.blue }}>
                  {stats.inProgressComplaints}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="calendar-outline" size={20} color="#7c3aed" />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Pending Guest Bookings</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#7c3aed' }}>
                  {stats.pendingBookings}
                </Text>
              </View>
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}
