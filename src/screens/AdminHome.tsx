import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { get } from '../api';
import { useAuth } from '../auth';
import { attempt, useResource } from '../hooks';
import { AdminStats, PgInfo } from '../types';
import { Card, PickerModal, Screen, Stat, colors, s } from '../ui';

/** Super admin landing page: pick any PG to enter it, or manage PGs and users platform-wide. */
export default function AdminHome({ navigation }: { navigation?: any }) {
  const { selectPg } = useAuth();
  const [picking, setPicking] = useState(false);
  const { data, error, loading, refreshing, refresh } = useResource(async () => {
    const [stats, pgs] = await Promise.all([get<AdminStats>('/api/admin/stats'), get<PgInfo[]>('/api/admin/pgs')]);
    return { stats, pgs };
  });

  const stats = data?.stats;
  const go = (screen: string) => navigation?.navigate?.(screen);
  const enter = async (pg: PgInfo) => {
    setPicking(false);
    const ok = await attempt(() => selectPg(pg.id));
    if (ok && navigation?.canGoBack?.()) {
      navigation.popToTop();
    }
  };

  return (
    <Screen
      title="Admin Console"
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {data && stats && (
        <>
          {/* ── PG dropdown: enter any property ── */}
          <Text style={[s.muted, { marginBottom: 6, fontWeight: '600' }]}>Open a PG</Text>
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 13,
              marginBottom: 16,
            }}
          >
            <Ionicons name="business-outline" size={18} color={colors.primary} />
            <Text style={{ flex: 1, color: colors.muted, fontSize: 15 }}>
              {data.pgs.length === 0 ? 'No PGs yet' : `Choose a PG (${data.pgs.length})…`}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.muted} />
          </Pressable>

          {/* ── App Analytics Card ── */}
          <Pressable
            onPress={() => go('AdminAnalytics')}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="analytics" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Active Users & Platform Analytics</Text>
              <Text style={{ color: '#c7d2fe', fontSize: 12, marginTop: 2 }}>
                Track DAU/WAU/MAU, user roles, occupancy rate & health
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </Pressable>

          {stats.pendingRegistrations > 0 && (
            <Pressable
              onPress={() => go('Registrations')}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff3e0', borderRadius: 12, padding: 12, marginBottom: 16 }}
            >
              <Ionicons name="hourglass-outline" size={20} color={colors.warn} />
              <Text style={{ flex: 1, color: colors.warn, fontWeight: '700', fontSize: 13 }}>
                {stats.pendingRegistrations} new {stats.pendingRegistrations === 1 ? 'property is' : 'properties are'} waiting for your approval
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.warn} />
            </Pressable>
          )}

          <Text style={[s.h2, { marginBottom: 8 }]}>PG management</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <Stat icon="business-outline" label="Total PGs" value={String(stats.totalPgs)} color={colors.blue} onPress={() => go('Pgs')} />
            <Stat icon="checkmark-circle-outline" label="Active" value={String(stats.activePgs)} color={colors.good} onPress={() => go('Pgs')} />
            <Stat icon="time-outline" label="Expiring in 30 days" value={String(stats.expiringSoon)} color={colors.warn} onPress={() => go('Pgs')} />
            <Stat
              icon="alert-circle-outline"
              label="Expired / blocked"
              value={String(stats.expiredPgs + stats.blockedPgs)}
              sub={`${stats.expiredPgs} expired · ${stats.blockedPgs} blocked`}
              color={colors.bad}
              onPress={() => go('Pgs')}
            />
          </View>

          <Text style={[s.h2, { marginBottom: 8 }]}>User management</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <Stat icon="key-outline" label="Owners" value={String(stats.owners)} color="#7c3aed" onPress={() => go('AdminUsers')} />
            <Stat icon="briefcase-outline" label="Managers" value={String(stats.managers)} color={colors.blue} onPress={() => go('AdminUsers')} />
            <Stat icon="people-outline" label="Residents" value={String(stats.residents)} color="#0d9488" onPress={() => go('AdminUsers')} />
            <Stat icon="ban-outline" label="Blocked users" value={String(stats.blockedUsers)} color={colors.bad} onPress={() => go('AdminUsers')} />
          </View>

          <Card>
            <Text style={s.h2}>Quick actions</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <Pressable
                onPress={() => go('AdminAnalytics')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e0e7ff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}
              >
                <Ionicons name="stats-chart" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>App Analytics</Text>
              </Pressable>
              <Pressable
                onPress={() => go('PropertyUserStats')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dcfce7', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}
              >
                <Ionicons name="pie-chart" size={16} color={colors.good} />
                <Text style={{ color: colors.good, fontWeight: '700', fontSize: 13 }}>Property Users</Text>
              </Pressable>
              <Pressable
                onPress={() => go('Registrations')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff3e0', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}
              >
                <Ionicons name="hourglass" size={16} color={colors.warn} />
                <Text style={{ color: colors.warn, fontWeight: '700', fontSize: 13 }}>Owner requests</Text>
              </Pressable>
              <Pressable
                onPress={() => go('Pgs')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}
              >
                <Ionicons name="business" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Manage PGs</Text>
              </Pressable>
              <Pressable
                onPress={() => go('AdminUsers')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f3e8ff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}
              >
                <Ionicons name="people" size={16} color="#7c3aed" />
                <Text style={{ color: '#7c3aed', fontWeight: '700', fontSize: 13 }}>Manage users</Text>
              </Pressable>
              <Pressable
                onPress={() => go('Lookups')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ccfbf1', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}
              >
                <Ionicons name="list" size={16} color="#0d9488" />
                <Text style={{ color: '#0d9488', fontWeight: '700', fontSize: 13 }}>Lookup data</Text>
              </Pressable>
              <Pressable
                onPress={() => go('PropertyTypes')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dbeafe', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}
              >
                <Ionicons name="options" size={16} color={colors.blue} />
                <Text style={{ color: colors.blue, fontWeight: '700', fontSize: 13 }}>Property types</Text>
              </Pressable>
              <Pressable
                onPress={() => go('PropertyCatalog')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffedd5', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}
              >
                <Ionicons name="sparkles" size={16} color={colors.warn} />
                <Text style={{ color: colors.warn, fontWeight: '700', fontSize: 13 }}>Amenities & fields</Text>
              </Pressable>
              <Pressable
                onPress={() => go('AdminFeedback')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e0f2fe', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}
              >
                <Ionicons name="chatbubble-ellipses" size={16} color="#0284c7" />
                <Text style={{ color: '#0284c7', fontWeight: '700', fontSize: 13 }}>User feedback</Text>
              </Pressable>
            </View>
          </Card>

          <PickerModal
            visible={picking}
            title="Open a PG"
            items={data.pgs}
            label={(p) => `${p.name}${p.city ? ` · ${p.city}` : ''}${p.active ? '' : ' (blocked)'}`}
            onClose={() => setPicking(false)}
            onPick={enter}
          />
        </>
      )}
    </Screen>
  );
}
