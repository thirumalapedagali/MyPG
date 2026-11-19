import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { get } from '../api';
import { attempt, useResource } from '../hooks';
import { useAuth } from '../auth';
import { PropertyUserStats as PropertyUserStatsType } from '../types';
import { Badge, Card, Chips, Empty, HeaderAction, Screen, SearchInput, colors, s } from '../ui';

const PAGE = 15;
const FILTERS = ['All PGs', 'Active Today', 'High Adoption (>50%)', 'Low Adoption (<50%)'] as const;
type Filter = (typeof FILTERS)[number];

export default function PropertyUserStats() {
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const { selectPg } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All PGs');
  const [shown, setShown] = useState(PAGE);

  const { data, error, loading, refreshing, refresh } = useResource(() =>
    get<PropertyUserStatsType[]>('/api/admin/property-user-stats')
  );

  const q = search.trim().toLowerCase();
  const allList = data ?? [];

  const filtered = allList.filter((item) => {
    if (filter === 'Active Today' && item.active24h === 0) return false;
    if (filter === 'High Adoption (>50%)' && item.appAdoptionRatePercentage < 50) return false;
    if (filter === 'Low Adoption (<50%)' && item.appAdoptionRatePercentage >= 50) return false;

    if (!q) return true;
    return [item.pgName, item.city, item.ownerName].some((v) => v?.toLowerCase().includes(q));
  });

  const totalAppUsers = allList.reduce((sum, item) => sum + item.totalUsers, 0);
  const totalActive24h = allList.reduce((sum, item) => sum + item.active24h, 0);
  const avgAdoption =
    allList.length > 0
      ? Math.round(
          (allList.reduce((sum, item) => sum + item.appAdoptionRatePercentage, 0) / allList.length) * 10
        ) / 10
      : 0;

  const openProperty = async (pgId: number) => {
    const ok = await attempt(() => selectPg(pgId));
    if (ok) {
      if ((nav as any).popToTop) {
        (nav as any).popToTop();
      } else {
        nav.navigate('Main');
      }
    }
  };

  return (
    <Screen
      title="Property User Analytics"
      action={<HeaderAction label="Back" icon="chevron-back" onPress={() => nav.goBack()} />}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {/* ── Summary Card at Top ── */}
      {data && (
        <Card style={{ backgroundColor: '#1e293b', padding: 16, marginBottom: 16 }}>
          <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
            Platform Property-Wise Usage
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <View>
              <Text style={{ color: '#ffffff', fontSize: 32, fontWeight: '800' }}>{allList.length}</Text>
              <Text style={{ color: '#cbd5e1', fontSize: 13 }}>Properties Tracked</Text>
            </View>
            <View style={{ width: 1, height: 40, backgroundColor: '#334155' }} />
            <View>
              <Text style={{ color: '#60a5fa', fontSize: 32, fontWeight: '800' }}>{totalAppUsers}</Text>
              <Text style={{ color: '#cbd5e1', fontSize: 13 }}>Total Users</Text>
            </View>
            <View style={{ width: 1, height: 40, backgroundColor: '#334155' }} />
            <View>
              <Text style={{ color: '#4ade80', fontSize: 32, fontWeight: '800' }}>{totalActive24h}</Text>
              <Text style={{ color: '#cbd5e1', fontSize: 13 }}>Active Today</Text>
            </View>
          </View>
          <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>Avg Resident App Adoption:</Text>
            <Text style={{ color: '#facc15', fontSize: 14, fontWeight: '800' }}>{avgAdoption}%</Text>
          </View>
        </Card>
      )}

      {/* ── Search & Filter Chips ── */}
      <SearchInput
        value={search}
        onChange={(t) => {
          setSearch(t);
          setShown(PAGE);
        }}
        placeholder="Search property name, city, owner..."
      />

      <Chips
        options={FILTERS}
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setShown(PAGE);
        }}
      />

      {data && (
        <Text style={[s.muted, { marginBottom: 8 }]}>
          Showing {filtered.length} of {data.length} properties
        </Text>
      )}

      {data && filtered.length === 0 && <Empty text="No properties match your filter/search." />}

      {/* ── Property User Cards List ── */}
      {filtered.slice(0, shown).map((item) => (
        <Card key={item.pgId} style={{ padding: 14, marginBottom: 12 }}>
          {/* Header Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={[s.h2, { fontSize: 16 }]} numberOfLines={1}>
                  {item.pgName}
                </Text>
                <Badge text={item.active ? 'Active' : 'Blocked'} color={item.active ? colors.good : colors.bad} />
              </View>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                {item.city ? `${item.city} · ` : ''}Owner: {item.ownerName ?? 'Unassigned'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', backgroundColor: '#e0e7ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>{item.totalUsers}</Text>
              <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '600' }}>Total Users</Text>
            </View>
          </View>

          {/* User Role Breakdown Bar */}
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              backgroundColor: '#f8fafc',
              borderRadius: 8,
              padding: 10,
              marginTop: 10,
            }}
          >
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#7c3aed' }}>{item.ownerCount}</Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>Owners</Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.blue }}>{item.managerCount}</Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>Managers</Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0d9488' }}>{item.residentCount}</Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>Resident App Logins</Text>
            </View>
          </View>

          {/* Active Logins (DAU / WAU / MAU) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="pulse" size={14} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>Activity:</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.text }}>
              <Text style={{ fontWeight: '700', color: colors.good }}>{item.active24h} Today</Text> · {item.active7d} 7d · {item.active30d} 30d
            </Text>
          </View>

          {/* Resident App Adoption Progress Meter */}
          <View style={{ marginTop: 10, backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>Resident App Adoption</Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: item.appAdoptionRatePercentage >= 50 ? colors.good : colors.warn }}>
                {item.appAdoptionRatePercentage}% ({item.residentCount} / {item.totalActiveResidents} residents)
              </Text>
            </View>
            <View style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  width: `${Math.min(item.appAdoptionRatePercentage, 100)}%`,
                  backgroundColor: item.appAdoptionRatePercentage >= 50 ? colors.good : colors.warn,
                  borderRadius: 3,
                }}
              />
            </View>
          </View>

          {/* Quick Action Button */}
          <Pressable
            onPress={() => openProperty(item.pgId)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 10,
              paddingVertical: 8,
              backgroundColor: colors.primary + '10',
              borderRadius: 8,
            }}
          >
            <Ionicons name="business" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Open Property View</Text>
          </Pressable>
        </Card>
      ))}

      {filtered.length > shown && (
        <Pressable
          onPress={() => setShown(shown + PAGE)}
          style={{ paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
            Show more ({filtered.length - shown})
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}
