import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { get, post } from '../api';
import { attempt, useResource } from '../hooks';
import { BookingRequest, Room } from '../types';
import { Badge, Card, Chips, Empty, Screen, SearchInput, colors, s } from '../ui';
import { money } from '../utils';
import { AddResidentModal } from './Residents';

const TABS = ['Pending', 'Approved', 'Rejected', 'All'] as const;

/** Prospective residents' bed/flat booking requests. Owners and managers approve (assign a bed) or reject them. */
export default function CheckinRequests() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Pending');
  const [search, setSearch] = useState('');
  const [approving, setApproving] = useState<BookingRequest | null>(null);
  const { data, error, loading, refreshing, refresh, reload } = useResource(async () => {
    const [requests, rooms] = await Promise.all([
      get<BookingRequest[]>('/api/booking-requests?status=ALL'),
      get<Room[]>('/api/rooms').catch(() => [] as Room[]),
    ]);
    return { requests, rooms };
  });

  const requests = data?.requests ?? [];
  const pending = requests.filter((r) => r.status === 'PENDING').length;
  const q = search.trim().toLowerCase();
  const visible = requests
    .filter((r) => {
      if (tab === 'Pending') return r.status === 'PENDING';
      if (tab === 'Approved') return r.status === 'APPROVED';
      if (tab === 'Rejected') return r.status === 'REJECTED' || r.status === 'CANCELLED';
      return true;
    })
    .filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.mobile ?? '').includes(q) ||
        (r.roomNumber ?? '').toLowerCase().includes(q) ||
        (r.bedNumber ?? '').toLowerCase().includes(q)
    );

  const reject = (r: BookingRequest) =>
    Alert.alert('Reject request', `Reject the booking request from ${r.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => post(`/api/booking-requests/${r.id}/reject`, {}))) reload();
        },
      },
    ]);

  const whatsApp = (r: BookingRequest) => {
    const clean = r.mobile.replace(/[^0-9]/g, '');
    const msg = `Hello ${r.name}, regarding your booking request on MyStay...`;
    Linking.openURL(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`);
  };

  return (
    <Screen title="Check-in requests" loading={loading} error={error} refreshing={refreshing} onRefresh={refresh}>
      {data && (
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, mobile, room or bed" />
          <Chips options={TABS} value={tab} onChange={setTab} />
          <Text style={[s.muted, { marginBottom: 8 }]}>
            {pending} pending · {requests.length} total
          </Text>
          {visible.length === 0 && (
            <Empty
              text={
                requests.length === 0
                  ? 'No check-in requests yet. Requests from prospective residents will appear here for approval.'
                  : 'No requests match your filter.'
              }
            />
          )}
          {visible.map((r) => {
            const isPending = r.status === 'PENDING';
            const isApproved = r.status === 'APPROVED';
            const color = isPending ? colors.warn : isApproved ? colors.good : colors.bad;
            const label = isPending ? 'Pending' : isApproved ? 'Approved' : r.status === 'CANCELLED' ? 'Cancelled' : 'Rejected';
            const where = [r.roomNumber ? `Room ${r.roomNumber}` : 'Any room', r.sectionName, r.bedNumber ? `Bed ${r.bedNumber}` : null]
              .filter(Boolean)
              .join(' · ');
            return (
              <Card key={r.id} style={{ marginBottom: 8, paddingVertical: 10 }}>
                <View style={s.row}>
                  <Text style={[s.h2, { fontSize: 15, flex: 1 }]} numberOfLines={1}>{r.name}</Text>
                  <Badge text={label} color={color} />
                </View>
                <Line icon="bed-outline" text={where} />
                <Line icon="calendar-outline" text={`Move-in: ${r.expectedJoinDate || 'Immediate'}`} />
                {r.rent ? <Line icon="pricetag-outline" text={`${money(r.rent)}/mo${r.deposit ? ` · Deposit ${money(r.deposit)}` : ''}`} /> : null}
                {r.mobile ? <Line icon="call-outline" text={r.mobile} /> : null}
                {r.message ? <Text style={styles.message}>&quot;{r.message}&quot;</Text> : null}
                {!isPending && r.rejectionReason ? <Line icon="information-circle-outline" text={r.rejectionReason} /> : null}
                <View style={styles.actions}>
                  {r.mobile ? (
                    <>
                      <Pill icon="call" label="Call" onPress={() => Linking.openURL(`tel:${r.mobile}`)} />
                      <Pill icon="logo-whatsapp" label="WhatsApp" onPress={() => whatsApp(r)} />
                    </>
                  ) : null}
                  {isPending && (
                    <>
                      <Pill icon="checkmark-circle" label="Approve & assign" solid onPress={() => setApproving(r)} />
                      <Pill icon="close" label="Reject" danger onPress={() => reject(r)} />
                    </>
                  )}
                </View>
              </Card>
            );
          })}
        </>
      )}
      {approving && (
        <AddResidentModal
          visible
          rooms={data?.rooms ?? []}
          initialRequest={approving}
          onClose={() => setApproving(null)}
          onAdded={() => {
            setApproving(null);
            reload();
          }}
        />
      )}
    </Screen>
  );
}

function Line({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={13} color={colors.muted} />
      <Text style={styles.lineText}>{text}</Text>
    </View>
  );
}

function Pill({
  icon,
  label,
  onPress,
  solid,
  danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  solid?: boolean;
  danger?: boolean;
}) {
  const fg = solid ? '#fff' : danger ? colors.bad : colors.good;
  return (
    <TouchableOpacity
      style={[styles.pill, solid && { backgroundColor: colors.good, borderColor: colors.good }, danger && { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={13} color={fg} />
      <Text style={[styles.pillText, { color: solid || danger ? fg : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  lineText: { fontSize: 12, color: colors.muted, flex: 1 },
  message: { fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  pillText: { fontSize: 12, fontWeight: '700' },
});
