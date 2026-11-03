import React from 'react';
import { Text, View } from 'react-native';
import { get } from '../api';
import { useResource } from '../hooks';
import { Summary } from '../types';
import { Card, Screen, Section, Stat, colors, s } from '../ui';
import { money, monthLabel } from '../utils';

/** Business overview — same layout as AgroMobileApp: Collections, Expenses, Net Profit, each by period. */
export default function Overview() {
  const { data, error, loading, refreshing, refresh } = useResource(() => get<Summary>('/api/dashboard/summary'));
  const now = new Date();
  const monthName = now.toLocaleString('en-IN', { month: 'long' });
  const year = String(now.getFullYear());

  const netStat = (label: string, icon: React.ComponentProps<typeof Stat>['icon'], n: number) => (
    <Stat
      key={label}
      icon={icon}
      label={label}
      value={money(Math.abs(n))}
      sub={n >= 0 ? '↑ Profit' : '↓ Loss'}
      color={n >= 0 ? '#6a1b9a' : colors.bad}
    />
  );

  return (
    <Screen title="Business Overview" loading={loading} error={error} refreshing={refreshing} onRefresh={refresh}>
      {data && <Body data={data} monthName={monthName} year={year} netStat={netStat} />}
    </Screen>
  );
}

function Body({
  data,
  monthName,
  year,
  netStat,
}: {
  data: Summary;
  monthName: string;
  year: string;
  netStat: (label: string, icon: React.ComponentProps<typeof Stat>['icon'], n: number) => React.ReactNode;
}) {
  const { collections: inc, expenses: exp, net } = data;
  const occupancy = data.beds ? Math.round((data.occupied / data.beds) * 100) : 0;
  const max = Math.max(1, ...data.months.flatMap((m) => [m.collected, m.spent]));

  return (
    <>
      <Text style={[s.muted, { marginBottom: 10 }]}>All-time analytics across collections, expenses & profit</Text>

      <Section title="Collections" icon="cash-outline" color={colors.primary}>
        <Stat icon="server-outline" label="Total Collected" value={money(inc.total)} sub="All time" />
        <Stat icon="sunny-outline" label="Today" value={money(inc.today)} sub="Today" />
        <Stat icon="calendar-outline" label="This Month" value={money(inc.month)} sub={monthName} />
        <Stat icon="calendar-number-outline" label="This Year" value={money(inc.year)} sub={year} />
        <Stat
          icon="time-outline"
          label="Pending Dues"
          value={money(data.totalDue)}
          sub={`${data.pendingDues.length} resident${data.pendingDues.length === 1 ? '' : 's'}`}
          color={colors.warn}
        />
        <Stat icon="pie-chart-outline" label="Occupancy" value={`${occupancy}%`} sub={`${data.occupied} / ${data.beds} beds`} color={colors.blue} />
      </Section>

      <Section title="Expenses" icon="receipt-outline" color={colors.warn}>
        <Stat icon="server-outline" label="All Time" value={money(exp.total)} color={colors.warn} />
        <Stat icon="sunny-outline" label="Today" value={money(exp.today)} color={colors.bad} />
        <Stat icon="calendar-outline" label="This Month" value={money(exp.month)} sub={monthName} color={colors.bad} />
        <Stat icon="calendar-number-outline" label="This Year" value={money(exp.year)} sub={year} color={colors.bad} />
      </Section>

      <Section title="Net Profit" icon="analytics-outline" color="#6a1b9a">
        {netStat('All Time', 'server-outline', net.total)}
        {netStat('Today', 'sunny-outline', net.today)}
        {netStat('This Month', 'calendar-outline', net.month)}
        {netStat('This Year', 'calendar-number-outline', net.year)}
      </Section>

      <Text style={[s.h2, { marginVertical: 8 }]}>Last 6 months</Text>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, justifyContent: 'space-between' }}>
          {data.months.map((m) => (
            <View key={m.month} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 3 }}>
                <View style={{ width: 12, height: Math.max(2, (m.collected / max) * 120), backgroundColor: colors.good, borderRadius: 3 }} />
                <View style={{ width: 12, height: Math.max(2, (m.spent / max) * 120), backgroundColor: colors.warn, borderRadius: 3 }} />
              </View>
              <Text style={[s.muted, { marginTop: 4 }]}>{monthLabel(m.month)}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
          <Text style={{ color: colors.good, fontSize: 12 }}>■ Collected</Text>
          <Text style={{ color: colors.warn, fontSize: 12 }}>■ Expenses</Text>
        </View>
      </Card>
    </>
  );
}
