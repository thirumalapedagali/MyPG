
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { get } from '../api';
import { useAuth } from '../auth';
import { useResource } from '../hooks';
import { TodayData } from '../types';
import { Card, Empty, Screen, colors } from '../ui';
import { money } from '../utils';

export default function Today({ navigation }: { navigation?: any }) {
  const { user } = useAuth();
  const all = !!user?.allProperties;

  const { data, error, loading, refreshing, refresh } = useResource(() =>
    get<TodayData>(
      all
        ? '/api/dashboard/today?scope=all'
        : '/api/dashboard/today',
    ),
  );

  return (
    <Screen
      title="Today"
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {data && (
        <>
          {/* Date and subtitle */}
          <View style={styles.dateHeader}>
            <View>
              <Text style={styles.dateTitle}>Today's Activity</Text>
              <Text style={styles.dateText}>{data.date}</Text>
            </View>
            <View style={styles.todayBadge}>
              <View style={styles.todayDot} />
              <Text style={styles.todayBadgeText}>Today</Text>
            </View>
          </View>

          {/* Financial summary */}
          <Text style={styles.sectionTitle}>Financial Summary</Text>

          
<Card style={styles.financialCard}>
  {/* Net Collection hero */}
  <View style={styles.netHero}>
    <View style={styles.netIcon}>
      <Ionicons name="wallet" size={24} color="#fff" />
    </View>

    <View style={{ flex: 1 }}>
      <Text style={styles.netLabel}>Net Collection</Text>
      <Text
        style={styles.netAmount}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {money(data.net)}
      </Text>
    </View>

    <Ionicons name="stats-chart" size={28} color="#86c994" />
  </View>

  {/* Collected and Expenses */}
  <View style={styles.moneyRow}>
    <View style={styles.moneyTile}>
      <Text style={styles.kpiLabel}>Collected</Text>
      <Text
        style={[styles.moneyValue, { color: colors.good }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {money(data.collected)}
      </Text>
    </View>

    <View style={[styles.moneyTile, styles.tileLeft]}>
      <Text style={styles.kpiLabel}>Expenses</Text>
      <Text
        style={[styles.moneyValue, { color: colors.warn }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {money(data.spent)}
      </Text>
    </View>
  </View>
</Card>


          {/* Activity overview */}
          <Text style={styles.sectionTitle}>Activity Overview</Text>

          <View style={styles.activityRow}>
            <ActivityCard
              icon="checkmark-done-outline"
              label="Payments Received"
              value={String(data.payments.length)}
              color="#2474c9"
              background="#edf5ff"
            />

            <ActivityCard
              icon="log-in-outline"
              label="Check-ins"
              value={String(data.checkIns.length)}
              color="#16843b"
              background="#e8f8ed"
            />
          </View>

          {/* Payments */}
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Payments Today</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {data.payments.length}
              </Text>
            </View>
          </View>

          {data.payments.length === 0 ? (
            <Empty text="No payments received today." />
          ) : (
            <Card style={styles.listCard}>
              {data.payments.map((p, i) => {
                const place = [
                  p.roomNumber && `Room ${p.roomNumber}`,
                  p.sectionName &&
                    p.sectionName !== 'Main Room' &&
                    p.sectionName,
                  p.bedNumber && `Bed ${p.bedNumber}`,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <Pressable
                    key={`${p.pgId ?? 0}-${p.id}`}
                    disabled={all}
                    onPress={() =>
                      navigation?.navigate?.('Residents', {
                        residentId: p.residentId,
                      })
                    }
                    style={({ pressed }) => [
                      styles.transactionRow,
                      i > 0 && styles.rowBorder,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={styles.transactionIcon}>
                      <Ionicons
                        name="arrow-down"
                        size={18}
                        color="#16843b"
                      />
                    </View>

                    <View style={styles.transactionDetails}>
                      <Text
                        style={styles.residentName}
                        numberOfLines={1}
                      >
                        {p.residentName}
                      </Text>

                      {!!place && (
                        <Text style={styles.transactionSub} numberOfLines={1}>
                          {place}
                        </Text>
                      )}

                      {all && !!p.pgName && (
                        <Text style={styles.transactionSub} numberOfLines={1}>
                          {p.pgName}
                        </Text>
                      )}
                    </View>

                    <View style={styles.amountContainer}>
                      <Text style={styles.paymentAmount} numberOfLines={1}>
                        +{money(p.amount)}
                      </Text>
                      <Text style={styles.paymentStatus}>Received</Text>
                    </View>

                    {!all && (
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.muted}
                      />
                    )}
                  </Pressable>
                );
              })}
            </Card>
          )}

          {/* Check-ins list */}
          {data.checkIns.length > 0 && (
            <>
              <View style={styles.listHeader}>
                <Text style={styles.sectionTitle}>Check-ins Today</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>
                    {data.checkIns.length}
                  </Text>
                </View>
              </View>

              <Card style={styles.listCard}>
                {data.checkIns.map((c, i) => (
                  <View
                    key={`${c.name}-${i}`}
                    style={[
                      styles.checkinRow,
                      i > 0 && styles.rowBorder,
                    ]}
                  >
                    <View style={styles.checkinIcon}>
                      <Ionicons
                        name="person-add-outline"
                        size={18}
                        color="#16843b"
                      />
                    </View>
                    <Text style={styles.residentName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <View style={styles.checkinBadge}>
                      <Text style={styles.checkinBadgeText}>Checked in</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}

          {/* Expenses */}
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Expenses Today</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {data.expenses.length}
              </Text>
            </View>
          </View>

          {data.expenses.length === 0 ? (
            <Empty text="No expenses recorded today." />
          ) : (
            data.expenses.map((e) => (
              <Card
                key={`${e.pgId ?? 0}-${e.id}`}
                style={styles.expenseCard}
              >
                <View style={styles.expenseRow}>
                  <View style={styles.expenseIcon}>
                    <Ionicons
                      name="receipt-outline"
                      size={19}
                      color="#d97706"
                    />
                  </View>

                  <View style={styles.transactionDetails}>
                    <Text style={styles.residentName} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Text style={styles.transactionSub} numberOfLines={1}>
                      {all && e.pgName
                        ? `${e.pgName} · ${e.category}`
                        : e.category}
                    </Text>
                  </View>

                  <Text style={styles.expenseAmount} numberOfLines={1}>
                    -{money(e.amount)}
                  </Text>
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  color,
  background,
}: {
  title: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  background: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, { backgroundColor: background }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <Text style={styles.summaryLabel}>{title}</Text>
      <Text
        style={[styles.summaryValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function ActivityCard({
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
    <View style={styles.activityCard}>
      <View style={[styles.activityIcon, { backgroundColor: background }]}>
        <Ionicons name={icon} size={21} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.activityLabel}>{label}</Text>
        <Text style={[styles.activityValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Date
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  dateText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
  },
  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#e8f8ed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  todayDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16843b',
  },
  todayBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16843b',
  },


financialCard: {
  padding: 0,
  overflow: 'hidden',
  marginBottom: 14,
},

netHero: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  paddingVertical: 16,
  paddingHorizontal: 14,
  backgroundColor: '#f0faf2',
},

netIcon: {
  width: 46,
  height: 46,
  borderRadius: 23,
  backgroundColor: '#279444',
  alignItems: 'center',
  justifyContent: 'center',
},

netLabel: {
  fontSize: 13,
  fontWeight: '700',
  color: colors.text,
},

netAmount: {
  fontSize: 25,
  fontWeight: '900',
  color: '#27833b',
  marginTop: 2,
},

moneyRow: {
  flexDirection: 'row',
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: colors.border,
},

moneyTile: {
  flex: 1,
  minWidth: 0,
  paddingVertical: 13,
  paddingHorizontal: 12,
  gap: 4,
},

tileLeft: {
  borderLeftWidth: StyleSheet.hairlineWidth,
  borderLeftColor: colors.border,
},

kpiLabel: {
  fontSize: 11,
  color: colors.muted,
  fontWeight: '600',
},

moneyValue: {
  fontSize: 17,
  fontWeight: '800',
},

  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },

  // Financial cards
  summaryGrid: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 8,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    padding: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    gap: 5,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '900',
  },

  // Activity
  activityRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 14,
  },
  activityCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 11,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
  },
  activityValue: {
    fontSize: 19,
    fontWeight: '900',
    marginTop: 2,
  },

  // List headers
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
    marginBottom: 7,
  },
  countBadge: {
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#edf1f5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text,
  },

  // Transactions
  listCard: {
    paddingHorizontal: 10,
    paddingVertical: 0,
    marginBottom: 12,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 11,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  transactionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#e8f8ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionDetails: {
    flex: 1,
    minWidth: 0,
  },
  residentName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  transactionSub: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 3,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#16843b',
  },
  paymentStatus: {
    fontSize: 9,
    color: colors.good,
    marginTop: 2,
  },

  // Check-ins
  checkinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 10,
  },
  checkinIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#e8f8ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinBadge: {
    backgroundColor: '#e8f8ed',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  checkinBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#16843b',
  },

  // Expenses
  expenseCard: {
    padding: 11,
    marginBottom: 7,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  expenseIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#fff5e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#d97706',
  },
});
