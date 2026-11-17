
import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { get } from '../api';
import { useAuth } from '../auth';
import { useResource } from '../hooks';
import { Summary } from '../types';
import { Card, Screen, colors } from '../ui';
import { money, monthLabel } from '../utils';

type Tab = 'Overview' | 'Collections' | 'Expenses' | 'Profit';
type Period = 'Today' | 'This Month' | 'This Year';

export default function Overview({ navigation }: { navigation?: any }) {
  const { user } = useAuth();
  const all = !!user?.allProperties;

  const { data, error, loading, refreshing, refresh } = useResource(() =>
    get<Summary>(
      all
        ? '/api/dashboard/summary?scope=all'
        : '/api/dashboard/summary',
    ),
  );

  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [period, setPeriod] = useState<Period>('This Month');

  return (
    <Screen
      title="Business Overview"
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {data && (
        
      <OverviewBody
        navigation={navigation}
        data={data}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        period={period}
        setPeriod={setPeriod}
      />

      )}
    </Screen>
  );
}

function OverviewBody({
  navigation,
  data,
  activeTab,
  setActiveTab,
  period,
  setPeriod,
}: {
  navigation?: any;
  data: Summary;
  activeTab: Tab;
  setActiveTab: (v: Tab) => void;
  period: Period;
  setPeriod: (v: Period) => void;
}) {
  const { collections, expenses, net } = data;

  const occupancy = data.beds
    ? Math.round((data.occupied / data.beds) * 100)
    : 0;

  const periodValues = {
    Today: {
      collected: collections.today,
      spent: expenses.today,
      profit: net.today,
    },
    'This Month': {
      collected: collections.month,
      spent: expenses.month,
      profit: net.month,
    },
    'This Year': {
      collected: collections.year,
      spent: expenses.year,
      profit: net.year,
    },
  };

  const selected = periodValues[period];

  const hero = {
    Overview: {
      label: 'Net Profit',
      value: net.total,
      color: '#ffffff',
      icon: 'trending-up' as const,
      sub: net.total >= 0 ? 'Overall profit' : 'Overall loss',
    },
    Collections: {
      label: 'Total Collections',
      value: collections.total,
      color: '#ffffff',
      icon: 'wallet' as const,
      sub: 'All-time collections',
    },
    Expenses: {
      label: 'Total Expenses',
      value: expenses.total,
      color: '#ffffff',
      icon: 'receipt' as const,
      sub: 'All-time expenses',
    },
    Profit: {
      label: 'Net Profit',
      value: net.total,
      color: '#ffffff',
      icon: 'stats-chart' as const,
      sub: net.total >= 0 ? 'Overall profit' : 'Overall loss',
    },
  }[activeTab];

    const max = Math.max(
    1,
    ...data.months.flatMap((m) => [m.collected, m.spent]),
  );

  const pendingCount = data.pendingDues?.length ?? 0;
  const go = (screen: string, params?: object) => navigation?.navigate?.(screen, params);

  return (
    <>
      <Text style={styles.description}>
        {data.properties
          ? `All-time analytics across ${data.properties.length} properties`
          : 'All-time analytics across collections, expenses & profit'}
      </Text>

      {/* Category tabs */}
      <View style={styles.tabs}>
        {(['Overview', 'Collections', 'Expenses', 'Profit'] as Tab[]).map(
          (tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
              style={[
                styles.tab,
                activeTab === tab && styles.activeTab,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText,
                ]}
                numberOfLines={1}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </View>

      {/* Hero card */}
      <View style={styles.heroCard}>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>
            {hero.label} (All Time)
          </Text>

          <Text style={styles.heroAmount} numberOfLines={1}
            adjustsFontSizeToFit>
            {money(Math.abs(hero.value))}
          </Text>

          <View style={styles.heroFooter}>
            <View style={styles.heroBadge}>
              <Ionicons
                name={hero.value >= 0 ? 'trending-up' : 'trending-down'}
                size={14}
                color="#087c35"
              />
              <Text style={styles.heroBadgeText}>
                {hero.sub}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.heroIllustration}>
          <Ionicons name="business" size={85} color="#c5e8cf" />
          <Ionicons
            name="leaf"
            size={34}
            color="#b4e5a8"
            style={{ position: 'absolute', bottom: 0, right: 8 }}
          />
        </View>
      </View>

      {/* All-time summary cards */}
      <View style={styles.summaryGrid}>
        <SummaryCard
          icon="server-outline"
          title="Total Collected"
          value={money(collections.total)}
          color="#087c35"
          background="#e8f8ed"
        />

        <SummaryCard
          icon="wallet-outline"
          title="Total Expenses"
          value={money(expenses.total)}
          color="#c62828"
          background="#fff0f0"
        />

        <SummaryCard
          icon="stats-chart-outline"
          title="Net Profit"
          value={money(Math.abs(net.total))}
          color="#6a1b9a"
          background="#f4eaff"
        />
      </View>

      {/* This period */}
      <Card style={styles.periodCard}>
<View style={styles.periodHeader}>
  <Text style={styles.sectionTitle}>This Period</Text>
</View>

<View style={styles.periodTabs}>
  {(['Today', 'This Month', 'This Year'] as Period[]).map((item) => (
    <TouchableOpacity
      key={item}
      style={[
        styles.periodTab,
        period === item && styles.activePeriodTab,
      ]}
      onPress={() => setPeriod(item)}
      activeOpacity={0.8}
    >
      <Text
        style={[
          styles.periodTabText,
          period === item && styles.activePeriodTabText,
        ]}
      >
        {item}
      </Text>
    </TouchableOpacity>
  ))}
</View>

<View style={styles.periodRow}>
  <PeriodMetric
    icon="calendar-outline"
    label="Collections"
    value={money(selected.collected)}
    color="#16833c"
    background="#e5f7eb"
  />

  <PeriodMetric
    icon="calendar-outline"
    label="Expenses"
    value={money(selected.spent)}
    color="#c62828"
    background="#ffeded"
  />

  <PeriodMetric
    icon="stats-chart-outline"
    label="Profit"
    value={money(Math.abs(selected.profit))}
    color="#6a1b9a"
    background="#f3eaff"
  />
</View>
</Card>

      {/* Pending dues and occupancy */}
      <View style={styles.infoRow}>
        <TouchableOpacity
          style={[styles.infoCard, styles.dueCard]}
          onPress={() => go('PendingDues')}
          activeOpacity={0.8}
        >
          <View style={styles.infoIcon}>
            <Ionicons
              name="hourglass-outline"
              size={23}
              color="#ea580c"
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.infoTitle}>Pending Dues</Text>
            <Text style={styles.dueAmount} numberOfLines={1}
              adjustsFontSizeToFit>
              {money(data.totalDue)}
            </Text>
            <Text style={styles.infoSub}>
              {pendingCount} residents
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.muted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.infoCard, styles.occupancyCard]}
          onPress={() => go('Rooms')}
          activeOpacity={0.8}
        >
          <View style={styles.infoIcon}>
            <Ionicons
              name="bed-outline"
              size={23}
              color="#1769c2"
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.infoTitle}>Occupancy</Text>
            <Text style={styles.occupancyValue}>
              {occupancy}%
            </Text>
            <Text style={styles.infoSub}>
              {data.occupied} / {data.beds} beds
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.muted}
          />
        </TouchableOpacity>
      </View>

      {/* Collections trend */}
      
{/* Collections & Expenses Trend */}
<Card style={styles.trendCard}>
  <View style={styles.trendHeader}>
    <Text style={styles.sectionTitle}>
      Collections & Expenses Trend
    </Text>
    <Text style={styles.trendHint}>Last 6 Months</Text>
  </View>

  <View style={styles.legend}>
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: colors.good }]} />
      <Text style={styles.legendText}>Collections</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: colors.warn }]} />
      <Text style={styles.legendText}>Expenses</Text>
    </View>
  </View>

  <View style={styles.chart}>
    {data.months.map((m, index) => (
      <View key={m.month} style={styles.chartColumn}>
        <View style={styles.bars}>
          <View
            style={[
              styles.chartBar,
              {
                height: Math.max(3, (m.collected / max) * 100),
                backgroundColor: colors.good,
              },
            ]}
          />
          <View
            style={[
              styles.chartBar,
              {
                height: Math.max(3, (m.spent / max) * 100),
                backgroundColor: colors.warn,
              },
            ]}
          />
        </View>

        <Text style={styles.monthLabel}>
          {monthLabel(m.month)}
        </Text>
      </View>
    ))}
  </View>
</Card>

    </>
  );
}

/* Reusable all-time card */
function SummaryCard({
  icon,
  title,
  value,
  color,
  background,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  value: string;
  color: string;
  background: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryInner, { backgroundColor: background }]}>
        <Ionicons name={icon} size={24} color={color} />

        <Text style={styles.summaryTitle}>{title}</Text>

        <Text
          style={[styles.summaryValue, { color }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>

        <Text style={styles.summarySub}>All time</Text>
      </View>
    </View>
  );
}

/* Period metric */
function PeriodMetric({
  icon,
  label,
  value,
  color,
  background,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  color: string;
  background: string;
}) {
  return (
    <View style={styles.periodMetric}>
      <View style={[styles.periodIcon, { backgroundColor: background }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.periodLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text
          style={[styles.periodValue, { color }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 8,
  },

periodHeader: {
  marginBottom: 8,
},

periodTabs: {
  flexDirection: 'row',
  backgroundColor: '#edf1f5',
  borderRadius: 10,
  padding: 3,
  marginBottom: 10,
},

periodTab: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 8,
  borderRadius: 8,
},

activePeriodTab: {
  backgroundColor: '#16843b',
},

periodTabText: {
  fontSize: 11,
  fontWeight: '700',
  color: colors.muted,
},

activePeriodTabText: {
  color: '#fff',
  fontWeight: '800',
},

  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#edf1f5',
    borderRadius: 24,
    padding: 3,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  activeTab: {
    backgroundColor: '#16843b',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '800',
  },

  // Hero
  heroCard: {
    backgroundColor: '#087c42',
    borderRadius: 16,
    minHeight: 140,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 12,
  },
  heroContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    zIndex: 1,
  },
  heroTitle: {
    color: '#e2f8e9',
    fontSize: 13,
    fontWeight: '700',
  },
  heroAmount: {
    color: '#fff',
    fontSize: 31,
    fontWeight: '900',
    marginTop: 5,
  },
  heroFooter: {
    flexDirection: 'row',
    marginTop: 9,
  },
  heroBadge: {
    backgroundColor: '#e1f8e8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroBadgeText: {
    color: '#087c35',
    fontSize: 10,
    fontWeight: '800',
  },
  heroIllustration: {
    width: 105,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
    backgroundColor: '#ffffff10',
  },

  // All-time summary
  summaryGrid: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    padding: 4,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  summaryInner: {
    minHeight: 112,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 3,
    gap: 5,
  },
  summaryTitle: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  summarySub: {
    fontSize: 9,
    color: colors.muted,
  },

  // Period
  periodCard: {
    padding: 10,
    marginBottom: 10,
  },
  
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  periodText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text,
  },
  periodRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
  },
  periodMetric: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  periodIcon: {
    width: 29,
    height: 29,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodLabel: {
    fontSize: 9,
    color: colors.muted,
    fontWeight: '600',
  },
  periodValue: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },

  // Pending and occupancy
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  infoCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  dueCard: {
    backgroundColor: '#fff8f1',
    borderColor: '#fed7aa',
  },
  occupancyCard: {
    backgroundColor: '#eff7ff',
    borderColor: '#bfdbfe',
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ffffffaa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
  },
  dueAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ea580c',
    marginTop: 3,
  },
  occupancyValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1769c2',
    marginTop: 2,
  },
  infoSub: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 2,
  },

  // Trend
  
trendCard: {
  padding: 12,
  marginBottom: 8,
},

trendHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
},

trendHint: {
  fontSize: 10,
  color: colors.muted,
},

legend: {
  flexDirection: 'row',
  gap: 16,
  marginBottom: 10,
},

legendItem: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
},

dot: {
  width: 8,
  height: 8,
  borderRadius: 4,
},

legendText: {
  fontSize: 10,
  color: colors.muted,
},

chart: {
  height: 120,
  flexDirection: 'row',
  alignItems: 'flex-end',
  justifyContent: 'space-around',
},

chartColumn: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'flex-end',
  height: '100%',
  gap: 5,
},

bars: {
  height: 95,
  flexDirection: 'row',
  alignItems: 'flex-end',
  gap: 3,
},

chartBar: {
  width: 12,
  borderRadius: 3,
},

monthLabel: {
  fontSize: 10,
  color: colors.muted,
},
});
