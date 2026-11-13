import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { get, post } from '../api';
import { attempt, useResource } from '../hooks';
import { OwnerRegistration } from '../types';
import { Badge, Card, Chips, Empty, FormModal, Screen, colors, s } from '../ui';
import { money } from '../utils';

const TABS = ['Pending', 'Approved', 'Rejected', 'All'] as const;

/** Super admin: owners' requests to put a property on MyStay. Approving creates the property and the owner's login. */
export default function Registrations() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Pending');
  const [rejecting, setRejecting] = useState<OwnerRegistration | null>(null);
  const { data, error, loading, refreshing, refresh, reload } = useResource(() =>
    get<OwnerRegistration[]>('/api/admin/registrations'),
  );

  const all = data ?? [];
  const pending = all.filter((r) => r.status === 'PENDING').length;
  const visible = all.filter((r) => tab === 'All' || r.status === tab.toUpperCase());

  const approve = (r: OwnerRegistration) =>
    Alert.alert('Approve property', `Create "${r.propertyName}" and let ${r.ownerName} sign in with ${r.mobile}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          if (await attempt(() => post(`/api/admin/registrations/${r.id}/approve`, {}))) reload();
        },
      },
    ]);

  return (
    <Screen title="Owner requests" loading={loading} error={error} refreshing={refreshing} onRefresh={refresh}>
      {data && (
        <>
          <Chips options={TABS} value={tab} onChange={setTab} />
          <Text style={[s.muted, { marginBottom: 8 }]}>
            {pending} pending · {all.length} total
          </Text>
          {visible.length === 0 && (
            <Empty
              text={all.length === 0 ? 'No requests yet. Owners who register from the sign-in screen appear here.' : 'Nothing here.'}
            />
          )}
          {visible.map((r) => {
            const isPending = r.status === 'PENDING';
            const color = isPending ? colors.warn : r.status === 'APPROVED' ? colors.good : colors.bad;
            const label = isPending ? 'Pending' : r.status === 'APPROVED' ? 'Approved' : 'Rejected';
            const where = [r.address, r.city].filter(Boolean).join(', ');
            return (
              <Card key={r.id} style={{ marginBottom: 8, paddingVertical: 10 }}>
                <View style={s.row}>
                  <Text style={[s.h2, { fontSize: 15, flex: 1 }]} numberOfLines={1}>
                    {r.propertyName}
                  </Text>
                  <Badge text={label} color={color} />
                </View>
                <Line icon="person-outline" text={`${r.ownerName} · ${r.mobile}`} />
                {r.email ? <Line icon="mail-outline" text={r.email} /> : null}
                <Line icon="business-outline" text={r.stayType || 'PG'} />
                {where ? <Line icon="location-outline" text={where} /> : null}
                {r.startingPrice ? <Line icon="pricetag-outline" text={`From ${money(r.startingPrice)}/mo`} /> : null}
                {r.upiId ? <Line icon="wallet-outline" text={r.upiId} /> : null}
                <Line icon="time-outline" text={`Requested ${r.createdAt.slice(0, 10)}`} />
                {r.rejectionReason ? <Line icon="information-circle-outline" text={r.rejectionReason} /> : null}
                <View style={styles.actions}>
                  <Pill icon="call" label="Call" onPress={() => Linking.openURL(`tel:${r.mobile}`)} />
                  {isPending && (
                    <>
                      <Pill icon="checkmark-circle" label="Approve" solid onPress={() => approve(r)} />
                      <Pill icon="close" label="Reject" danger onPress={() => setRejecting(r)} />
                    </>
                  )}
                </View>
              </Card>
            );
          })}
        </>
      )}

      <FormModal
        visible={rejecting !== null}
        title={`Reject · ${rejecting?.propertyName ?? ''}`}
        submitLabel="Reject"
        fields={[{ key: 'reason', label: 'Reason (shown to the owner)', optional: true }]}
        onClose={() => setRejecting(null)}
        onSubmit={async (v) => {
          if (!(await attempt(() => post(`/api/admin/registrations/${rejecting!.id}/reject`, { reason: v.reason })))) return false;
          setRejecting(null);
          reload();
        }}
      />
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
