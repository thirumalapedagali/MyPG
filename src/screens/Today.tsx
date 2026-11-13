import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { get } from '../api';
import { useAuth } from '../auth';
import { useResource } from '../hooks';
import { TodayData } from '../types';
import { Card, Empty, Screen, Stat, colors, s } from '../ui';
import { money } from '../utils';

/** Today's summary: money in, money out, and what happened today. "Today" is decided by the server (PG time zone). */
export default function Today({ navigation }: { navigation?: any }) {
  const { user } = useAuth();
  // Owner viewing "All Properties": everything today across properties, each row tagged with its property.
  const all = !!user?.allProperties;
  const { data, error, loading, refreshing, refresh } = useResource(() =>
    get<TodayData>(all ? '/api/dashboard/today?scope=all' : '/api/dashboard/today'),
  );

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
          {data.payments.length > 0 && (
            <Card style={{ paddingVertical: 0, paddingHorizontal: 10 }}>
              {data.payments.map((p, i) => {
                const place = [
                  p.roomNumber && `Room ${p.roomNumber}`,
                  p.sectionName && p.sectionName !== 'Main Room' && p.sectionName,
                  p.bedNumber && `Bed ${p.bedNumber}`
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <Pressable
                    key={`${p.pgId ?? 0}-${p.id}`}
                    disabled={all}
                    onPress={() => navigation?.navigate?.('Residents', { residentId: p.residentId })}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      paddingVertical: 6,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                    })}
                  >
                    <View style={[s.row, { gap: 8 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                          {p.residentName}
                          {!!place && <Text style={{ fontSize: 12, fontWeight: '500', color: colors.muted }}>{`  ${place}`}</Text>}
                        </Text>
                        {all && !!p.pgName && <Text style={[s.muted, { fontSize: 11 }]} numberOfLines={1}>{p.pgName}</Text>}
                      </View>
                      <Text style={{ fontWeight: '700', color: colors.good }}>{money(p.amount)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          )}

          <Text style={[s.h2, { marginVertical: 12 }]}>Expenses today</Text>
          {data.expenses.length === 0 && <Empty text="No expenses recorded today." />}
          {data.expenses.map((e) => (
            <Card key={`${e.pgId ?? 0}-${e.id}`}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.h2}>{e.title}</Text>
                  <Text style={s.muted}>{all && e.pgName ? `${e.pgName} · ${e.category}` : e.category}</Text>
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
