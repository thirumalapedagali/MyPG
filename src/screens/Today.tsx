import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { get } from '../api';
import { useResource } from '../hooks';
import { TodayData } from '../types';
import { Avatar, Card, Empty, Screen, Stat, colors, s } from '../ui';
import { money } from '../utils';

/** Today's summary: money in, money out, and what happened today. "Today" is decided by the server (PG time zone). */
export default function Today({ navigation }: { navigation?: any }) {
  const { data, error, loading, refreshing, refresh } = useResource(() => get<TodayData>('/api/dashboard/today'));

  return (
    <Screen title="Today" loading={loading} error={error} refreshing={refreshing} onRefresh={refresh}>
      {data && (
        <>
          <Text style={[s.muted, { marginBottom: 12 }]}>{data.date}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Stat icon="cash-outline" label="Collected" value={money(data.collected)} color={colors.good} />
            <Stat icon="receipt-outline" label="Expenses" value={money(data.spent)} color={colors.warn} />
            <Stat icon="checkmark-done-outline" label="Payments received" value={String(data.payments.length)} color={colors.blue} />
            {data.checkIns.length > 0 && (
              <Stat
                icon="log-in-outline"
                label="Check-ins"
                value={String(data.checkIns.length)}
                sub={data.checkIns.map((c) => c.name).join(', ')}
                color={colors.good}
              />
            )}
            <Stat icon="trending-up" label="Net" value={money(data.net)} color={data.net >= 0 ? colors.good : colors.bad} />
          </View>

          <Text style={[s.h2, { marginVertical: 12 }]}>Payments today</Text>
          {data.payments.length === 0 && <Empty text="No payments received today." />}
          {data.payments.map((p) => {
            const place = [p.roomNumber && `Room ${p.roomNumber}`, p.bedNumber && `${p.bedNumber}`].filter(Boolean).join(' · ');
            return (
              <Pressable
                key={p.id}
                onPress={() => navigation?.navigate?.('Residents', { residentId: p.residentId })}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Card style={{ paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6 }}>
                  <View style={[s.row, { justifyContent: 'flex-start', gap: 8 }]}>
                    <Avatar name={p.residentName} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.h2, { fontSize: 14 }]} numberOfLines={1}>{p.residentName}</Text>
                      {!!place && <Text style={[s.muted, { fontSize: 11 }]}>{place}</Text>}
                    </View>
                    <Text style={{ fontWeight: '700', color: colors.good }}>{money(p.amount)}</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}

          <Text style={[s.h2, { marginVertical: 12 }]}>Expenses today</Text>
          {data.expenses.length === 0 && <Empty text="No expenses recorded today." />}
          {data.expenses.map((e) => (
            <Card key={e.id}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.h2}>{e.title}</Text>
                  <Text style={s.muted}>{e.category}</Text>
                </View>
                <Text style={{ fontWeight: '700', color: colors.warn }}>{money(e.amount)}</Text>
              </View>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
