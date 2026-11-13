import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { del, get, post } from '../api';
import { attempt, useResource } from '../hooks';
import { Resident } from '../types';
import { Badge, Card, Chips, Empty, Screen, SearchInput, colors, s, FormModal } from '../ui';
import { money } from '../utils';

const TABS = ['Pending', 'Approved', 'Declined', 'All'] as const;

/**
 * Notice-to-vacate requests raised by residents. Approving one advertises the bed as available from the leaving date;
 * the owner still does the actual check-out (after dues are cleared) from the resident's page.
 */
export default function VacateRequests({ navigation }: { navigation?: any }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Pending');
  const [search, setSearch] = useState('');
  const [approvingNoticeFor, setApprovingNoticeFor] = useState<Resident | null>(null);
  const { data, error, loading, refreshing, refresh, reload } = useResource(() => get<Resident[]>('/api/residents'));

  const withNotice = (data ?? [])
    .filter((r) => r.noticeStatus)
    .sort((a, b) => (a.vacateOn ?? '').localeCompare(b.vacateOn ?? ''));
  const pending = withNotice.filter((r) => r.noticeStatus === 'REQUESTED').length;
  const q = search.trim().toLowerCase();
  const visible = withNotice
    .filter((r) => {
      if (tab === 'Pending') return r.noticeStatus === 'REQUESTED';
      if (tab === 'Approved') return r.noticeStatus === 'APPROVED';
      if (tab === 'Declined') return r.noticeStatus === 'REJECTED';
      return true;
    })
    .filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.phone ?? '').includes(q) ||
        (r.roomNumber ?? '').toLowerCase().includes(q) ||
        (r.bedNumber ?? '').toLowerCase().includes(q)
    );

  const decide = (r: Resident, approve: boolean) => {
    if (approve) {
      setApprovingNoticeFor(r);
    } else {
      Alert.alert(
        'Decline notice',
        `Decline ${r.name}'s notice? They stay as a resident.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Decline',
            style: 'destructive',
            onPress: async () => {
              if (await attempt(() => post(`/api/residents/${r.id}/notice/reject`, {}))) reload();
            },
          },
        ]
      );
    }
  };

  const withdraw = (r: Resident) =>
    Alert.alert('Cancel notice', `Remove ${r.name}'s notice? The bed stops being advertised.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel notice',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => del(`/api/residents/${r.id}/notice`))) reload();
        },
      },
    ]);

  return (
    <Screen title="Vacate requests" loading={loading} error={error} refreshing={refreshing} onRefresh={refresh}>
      {data && (
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, mobile, room or bed" />
          <Chips options={TABS} value={tab} onChange={setTab} />
          <Text style={[s.muted, { marginBottom: 8 }]}>
            {pending} pending · {withNotice.length} total
          </Text>
          {visible.length === 0 && (
            <Empty
              text={
                withNotice.length === 0
                  ? 'No vacate requests. When a resident gives notice, it will appear here for approval.'
                  : 'No requests match your filter.'
              }
            />
          )}
          {visible.map((r) => {
            const isPending = r.noticeStatus === 'REQUESTED';
            const isApproved = r.noticeStatus === 'APPROVED';
            const color = isPending ? colors.warn : isApproved ? colors.good : colors.bad;
            const label = isPending ? 'Pending' : isApproved ? 'Approved' : 'Declined';
            const where = [r.roomNumber ? `Room ${r.roomNumber}` : null, r.sectionName, r.bedNumber ? `Bed ${r.bedNumber}` : null]
              .filter(Boolean)
              .join(' · ');
            return (
              <Card key={r.id} style={{ marginBottom: 8, paddingVertical: 10 }}>
                <View style={s.row}>
                  <Text style={[s.h2, { fontSize: 15, flex: 1 }]} numberOfLines={1}>{r.name}</Text>
                  <Badge text={label} color={color} />
                </View>
                {!!where && <Line icon="bed-outline" text={where} />}
                <Line icon="exit-outline" text={`Leaving on ${r.vacateOn}`} />
                <Line icon="calendar-outline" text={`Notice given ${r.noticeGivenOn}`} />
                {r.due > 0 && <Line icon="alert-circle-outline" text={`Pending dues ${money(r.due)}, to clear before check-out`} warn />}
                {r.noticeReason ? <Text style={styles.message}>&quot;{r.noticeReason}&quot;</Text> : null}
                <View style={styles.actions}>
                  {r.phone ? <Pill icon="call" label="Call" onPress={() => Linking.openURL(`tel:${r.phone}`)} /> : null}
                  <Pill icon="person" label="Resident" onPress={() => navigation?.navigate?.('Main', { screen: 'Residents', params: { residentId: r.id } })} />
                  {isPending && (
                    <>
                      <Pill icon="checkmark-circle" label="Approve" solid onPress={() => decide(r, true)} />
                      <Pill icon="close" label="Decline" danger onPress={() => decide(r, false)} />
                    </>
                  )}
                  {(isApproved || r.noticeStatus === 'REJECTED') && (
                    <Pill icon="trash-outline" label="Remove notice" danger onPress={() => withdraw(r)} />
                  )}
                </View>
              </Card>
            );
          })}
        </>
      )}

      {approvingNoticeFor && (
        <FormModal
          visible={approvingNoticeFor !== null}
          title={`Approve notice - ${approvingNoticeFor.name}`}
          submitLabel="Approve"
          fields={[
            {
              key: 'returnedDeposit',
              label: 'Returned Deposit Amount (₹)',
              keyboard: 'number-pad',
              initial: String(approvingNoticeFor.securityDeposit ?? 0),
            },
          ]}
          onClose={() => setApprovingNoticeFor(null)}
          onSubmit={async (v) => {
            const returnedDeposit = parseFloat(v.returnedDeposit) || 0;
            if (returnedDeposit < 0) {
              Alert.alert('Invalid', 'Returned deposit cannot be negative.');
              return false;
            }
            if (
              !(await attempt(() =>
                post(`/api/residents/${approvingNoticeFor.id}/notice/approve?returnedDeposit=${returnedDeposit}`, {})
              ))
            )
              return false;
            setApprovingNoticeFor(null);
            reload();
          }}
        />
      )}
    </Screen>
  );
}

function Line({ icon, text, warn }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; warn?: boolean }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={13} color={warn ? colors.warn : colors.muted} />
      <Text style={[styles.lineText, warn && { color: colors.warn }]}>{text}</Text>
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
