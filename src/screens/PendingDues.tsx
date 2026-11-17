import { Ionicons } from '@expo/vector-icons';
import React, { useState, useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { get, post } from '../api';
import { useAuth } from '../auth';
import { attempt, useResource } from '../hooks';
import { Summary } from '../types';
import { Avatar, Card, Chips, Empty, FormModal, Screen, SearchInput, Stat, colors, s } from '../ui';
import { isDate, money, today } from '../utils';

type PendingDue = Summary['pendingDues'][number];

const shortFloor = (name: string) => {
  const short = name.replace(/\s+floor$/i, '');
  return short === 'Ground' ? 'G' : short;
};

function buildFloorNames(total?: number | null): string[] {
  const count = total && total > 0 ? total : 3;
  const list = ['Ground Floor'];
  for (let i = 1; i <= count; i++) {
    const suffix = i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th';
    list.push(`${i}${suffix} Floor`);
  }
  return list;
}

/** Residents who owe money. Owners can remind or collect; in "All Properties" the list is read-only. */
export default function PendingDues() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const all = !!user?.allProperties;
  const [collecting, setCollecting] = useState<PendingDue | null>(null);
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState('All Floors');

  const { data, error, loading, refreshing, refresh, reload } = useResource(async () => {
    const scopeParam = all ? '?scope=all' : '';
    const [dues, profile] = await Promise.all([
      get<PendingDue[]>(`/api/dashboard/pending-dues${scopeParam}`),
      all ? Promise.resolve(null) : get<{ stayType?: string | null }>('/api/pg/profile').catch(() => null),
    ]);
    return { dues, stayType: profile?.stayType ?? null };
  });

  const dues = data?.dues ?? [];
  const isApartment = data?.stayType === 'APARTMENT';
  const totalDue = useMemo(() => dues.reduce((sum, d) => sum + d.due, 0), [dues]);

  const floorTabs = useMemo(() => {
    const names = buildFloorNames(user?.totalFloors);
    for (const d of dues) {
      if (d.floorName) {
        const f = d.floorName.trim();
        if (!names.includes(f)) names.push(f);
      }
    }
    return ['All Floors', ...names];
  }, [dues, user?.totalFloors]);

  const floorChips = useMemo(() => floorTabs.map(shortFloor), [floorTabs]);

  const filteredDues = useMemo(() => {
    return dues.filter((d) => {
      const query = search.trim().toLowerCase();
      if (query) {
        const nameMatch = d.name?.toLowerCase().includes(query);
        const roomMatch = d.roomNumber?.toLowerCase().includes(query);
        if (!nameMatch && !roomMatch) return false;
      }
      if (floorFilter !== 'All Floors') {
        const itemFloor = d.floorName || 'Ground Floor';
        if (itemFloor !== floorFilter) return false;
      }
      return true;
    });
  }, [dues, search, floorFilter]);

  const notify = (d: PendingDue) =>
    Alert.alert('Send reminder', `Send a due reminder of ${money(d.due)} to ${d.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          if (await attempt(() => post(`/api/notifications/remind-due/${d.residentId}`))) {
            Alert.alert('Reminder sent', `Due reminder sent to ${d.name}.`);
          }
        },
      },
    ]);

  return (
    <Screen title="Pending dues" loading={loading} error={error} refreshing={refreshing} onRefresh={refresh}>
      {data && (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <Stat
              icon="alert-circle-outline"
              label="Total dues"
              value={money(totalDue)}
              color={totalDue ? colors.bad : colors.good}
            />
            <Stat icon="people-outline" label="Residents with dues" value={String(dues.length)} color={colors.warn} />
          </View>

          {/* ── Search Bar ── */}
          <SearchInput
            placeholder="Search by name or room..."
            value={search}
            onChange={setSearch}
          />

          {/* ── Floor Filter Chips ── */}
          {floorChips.length > 1 && (
            <Chips
              options={floorChips}
              value={shortFloor(floorFilter)}
              onChange={(val) => {
                const fullFloorName = floorTabs.find((f) => shortFloor(f) === val) || 'All Floors';
                setFloorFilter(fullFloorName);
              }}
            />
          )}

          {filteredDues.length === 0 && (
            <Empty text={search || floorFilter !== 'All Floors' ? 'No matching residents with dues.' : 'No pending dues. Everyone is paid up.'} />
          )}

          {filteredDues.map((d) => (
            <Card key={d.residentId}>
              <View style={[s.row, { justifyContent: 'flex-start', alignItems: 'center' }]}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  onPress={() => navigation.navigate('Main', { screen: 'Residents', params: { residentId: d.residentId } })}
                  activeOpacity={0.7}
                >
                  <Avatar name={d.name} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.h2}>{d.name}</Text>
                    <Text style={s.muted}>
                      {isApartment ? 'Flat' : 'Room'} {d.roomNumber ?? '-'}
                      {d.sectionName && d.sectionName !== 'Main Room' ? ` · ${d.sectionName}` : ''}
                      {d.bedNumber ? ` · ${d.bedNumber}` : ''}
                    </Text>
                    
                    {/* Days pending and last payment date */}
                    {(() => {
                      const start = d.lastPaymentDate ? new Date(d.lastPaymentDate) : new Date(d.joinedOn);
                      const todayDate = new Date();
                      const diffTime = Math.max(0, todayDate.getTime() - start.getTime());
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      return (
                        <View style={{ marginTop: 4 }}>
                          <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '500' }}>
                            {d.lastPaymentDate
                              ? `Last Paid: ${new Date(d.lastPaymentDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                              : `Joined: ${new Date(d.joinedOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.bad, fontWeight: '600', marginTop: 1 }}>
                            {`Pending: ${diffDays} day${diffDays === 1 ? '' : 's'}`}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                </TouchableOpacity>
                <Text style={{ color: colors.bad, fontWeight: '800', marginRight: 12 }}>{money(d.due)}</Text>
                {!all && (
                  <>
                    <TouchableOpacity style={styles.btn} onPress={() => notify(d)} hitSlop={6} accessibilityLabel="Send reminder">
                      <Ionicons name="notifications-outline" size={18} color={colors.warn} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: colors.good }]}
                      onPress={() => setCollecting(d)}
                      hitSlop={6}
                      accessibilityLabel="Collect payment"
                    >
                      <Ionicons name="cash-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </Card>
          ))}
        </>
      )}
      {collecting && (
        <FormModal
          visible
          title={`Collect payment - ${collecting.name}`}
          submitLabel="Collect"
          fields={[
            { key: 'amount', label: 'Amount (₹)', keyboard: 'number-pad', initial: String(collecting.due) },
            { key: 'date', label: 'Date', initial: today(), date: true },
          ]}
          onClose={() => setCollecting(null)}
          onSubmit={async (v) => {
            const amount = parseFloat(v.amount);
            if (!(amount > 0) || !isDate(v.date)) {
              Alert.alert('Invalid', 'Check amount and date.');
              return false;
            }
            if (!(await attempt(() => post('/api/payments', { residentId: collecting.residentId, amount, date: v.date })))) {
              return false;
            }
            setCollecting(null);
            reload();
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
    marginLeft: 8,
  },
});
