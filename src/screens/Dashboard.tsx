import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { get, post } from '../api';
import { useAuth } from '../auth';
import { attempt, useResource } from '../hooks';
import { Summary } from '../types';
import { Avatar, Card, FormModal, HeaderAction, Screen, Stat, colors, s } from '../ui';
import { isDate, money, today } from '../utils';

type PendingDue = Summary['pendingDues'][number];

export default function Dashboard({ navigation }: { navigation?: any }) {
  const { logout } = useAuth();
  const [collecting, setCollecting] = useState<PendingDue | null>(null);
  const { data, error, loading, refreshing, refresh, reload } = useResource(async () => {
    const [summary, requests, profile] = await Promise.all([
      get<Summary>('/api/dashboard/summary'),
      get<{ pending: number }>('/api/booking-requests/count').catch(() => ({ pending: 0 })),
      get<{ stayType?: string | null }>('/api/pg/profile').catch(() => null),
    ]);
    return { summary, pendingRequests: requests.pending, stayType: profile?.stayType ?? null };
  });

  const summary = data?.summary;
  const pendingRequests = data?.pendingRequests ?? 0;
  // Apartments rent whole flats, so count flats instead of beds.
  const isApartment = data?.stayType === 'APARTMENT';

  const notify = (d: PendingDue) =>
    Alert.alert('Send reminder', `Send a WhatsApp due reminder of ${money(d.due)} to ${d.name}?`, [
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
    <Screen
      title="Dashboard"
      action={<HeaderAction label="Log out" icon="log-out-outline" onPress={logout} />}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {summary && (
        <>
          {/* ── Pending Bed Requests Alert Banner ── */}
          {pendingRequests > 0 && (
            <View style={dashStyles.banner}>
              <View style={dashStyles.bannerIconWrap}>
                <Ionicons name="notifications" size={20} color="#ea580c" />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={dashStyles.bannerTitle}>
                  {pendingRequests} {isApartment ? 'Flat' : 'Bed'} Booking Request{pendingRequests > 1 ? 's' : ''} Pending
                </Text>
                <Text style={dashStyles.bannerSub}>
                  {isApartment
                    ? 'Prospective residents are waiting for flat assignment approval'
                    : 'Prospective residents are waiting for room & bed assignment approval'}
                </Text>
              </View>
              <TouchableOpacity
                style={dashStyles.bannerBtn}
                onPress={() => {
                  navigation?.navigate?.('Residents', { filter: 'Requests' });
                }}
              >
                <Text style={dashStyles.bannerBtnText}>Review</Text>
                <Ionicons name="chevron-forward" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {isApartment ? (
              <>
                <Stat icon="home-outline" label="Flats" value={String(summary.rooms)} color={colors.blue} />
                <Stat icon="key-outline" label="Vacant flats" value={String(summary.vacant)} color={summary.vacant ? colors.good : colors.muted} />
              </>
            ) : (
              <>
                <Stat icon="bed-outline" label="Rooms" value={String(summary.rooms)} color={colors.blue} />
                <Stat icon="bed-outline" label="Total beds" value={String(summary.beds)} color={colors.blue} />
                <Stat icon="bed" label="Vacant beds" value={String(summary.vacant)} color={summary.vacant ? colors.good : colors.muted} />
              </>
            )}
            {summary.checkInsToday > 0 && (
              <Stat icon="log-in-outline" label="Check-ins (today)" value={String(summary.checkInsToday)} color={colors.good} />
            )}
            <Stat icon="people-outline" label="Check-ins (this month)" value={String(summary.checkInsMonth)} color={colors.blue} />
            <Stat icon="alert-circle-outline" label="Total dues" value={money(summary.totalDue)} color={summary.totalDue ? colors.bad : colors.good} />
            <Stat icon="cash-outline" label="Collected (this month)" value={money(summary.collections.month)} color={colors.good} />
            <Stat icon="receipt-outline" label="Expenses (this month)" value={money(summary.expenses.month)} color={colors.warn} />
            <Stat icon="trending-up" label="Net (this month)" value={money(summary.net.month)} color={summary.net.month >= 0 ? colors.good : colors.bad} />
          </View>
          <Text style={[s.h2, { marginVertical: 12 }]}>Pending dues</Text>
          {summary.pendingDues.length === 0 && <Text style={s.muted}>No pending dues.</Text>}
          {summary.pendingDues.map((d) => (
            <Card key={d.residentId}>
              <View style={[s.row, { justifyContent: 'flex-start' }]}>
                <Avatar name={d.name} />
                <View style={{ flex: 1 }}>
                  <Text style={s.h2}>{d.name}</Text>
                  <Text style={s.muted}>{isApartment ? 'Flat' : 'Room'} {d.roomNumber ?? '-'}</Text>
                </View>
                <Text style={{ color: colors.bad, fontWeight: '800' }}>{money(d.due)}</Text>
                <TouchableOpacity style={dashStyles.dueBtn} onPress={() => notify(d)} hitSlop={6} accessibilityLabel="Send reminder">
                  <Ionicons name="notifications-outline" size={18} color={colors.warn} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[dashStyles.dueBtn, { backgroundColor: colors.good }]}
                  onPress={() => setCollecting(d)}
                  hitSlop={6}
                  accessibilityLabel="Collect payment"
                >
                  <Ionicons name="cash-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </Card>
          ))}
          {collecting && (
            <FormModal
              visible
              title={`Collect payment - ${collecting.name}`}
              submitLabel="Collect"
              fields={[
                { key: 'amount', label: 'Amount (₹)', keyboard: 'number-pad', initial: String(collecting.due) },
                { key: 'date', label: 'Date (YYYY-MM-DD)', initial: today() },
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
        </>
      )}
    </Screen>
  );
}

const dashStyles = StyleSheet.create({
  dueBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
    marginLeft: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  bannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: '#9a3412' },
  bannerSub: { fontSize: 11, color: '#c2410c', marginTop: 2, lineHeight: 15 },
  bannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ea580c',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  bannerBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
