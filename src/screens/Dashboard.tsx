import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { get } from '../api';
import { useAuth } from '../auth';
import { useResource } from '../hooks';
import { PicturesSheet } from '../pictures';
import { MealSummary, Room, Summary } from '../types';
import { AddPropertyModal, Card, Screen, colors, s } from '../ui';
import { clock12, money, today } from '../utils';
import { AddRoomModal } from './Rooms';
import { AddResidentModal } from './Residents';
import { AddExpenseModal } from './Expenses';
import { AddAnnouncementModal } from './Announcements';

export default function Dashboard({ navigation }: { navigation?: any }) {
  const { user } = useAuth();
  // Owner viewing "All Properties": consolidated numbers; actions that need a single property are hidden.
  const all = !!user?.allProperties;
  const [addingProperty, setAddingProperty] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [addingRoom, setAddingRoom] = useState(false);
  const [addingResident, setAddingResident] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [addingAnnouncement, setAddingAnnouncement] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    if (addingResident) {
      get<Room[]>('/api/rooms')
        .then(setRooms)
        .catch(() => {});
    }
  }, [addingResident]);

  const { data, error, loading, refreshing, refresh } = useResource(async () => {
    if (all) {
      const summary = await get<Summary>('/api/dashboard/summary?scope=all');
      return { summary, pendingRequests: 0, pendingVacates: 0, pendingComplaints: 0, stayType: null as string | null, meals: [] as MealSummary[] };
    }
    const [summary, requests, profile, notices, complaints, menu] = await Promise.all([
      get<Summary>('/api/dashboard/summary'),
      get<{ pending: number }>('/api/booking-requests/count').catch(() => ({ pending: 0 })),
      get<{ stayType?: string | null }>('/api/pg/profile').catch(() => null),
      get<{ pending: number }>('/api/residents/notice-count').catch(() => ({ pending: 0 })),
      get<{ pending: number }>('/api/complaints/count').catch(() => ({ pending: 0 })),
      get<{ meals: MealSummary[] }>('/api/menu/summary').catch(() => ({ meals: [] as MealSummary[] })),
    ]);
    return {
      summary,
      pendingRequests: requests.pending,
      pendingVacates: notices.pending,
      pendingComplaints: complaints.pending,
      stayType: profile?.stayType ?? null,
      meals: menu.meals,
    };
  });

  const summary = data?.summary;
  const pendingRequests = data?.pendingRequests ?? 0;
  const pendingVacates = data?.pendingVacates ?? 0;
  const pendingComplaints = data?.pendingComplaints ?? 0;
  const meals = data?.meals ?? [];
  // Apartments rent whole flats, so count flats instead of beds.
  const isApartment = data?.stayType === 'APARTMENT';
  // The food menu is for PGs only (a property with no type set is a PG).
  const isPg = (data?.stayType ?? 'PG') === 'PG';

  const go = (screen: string, params?: object) => navigation?.navigate?.(screen, params);
  // Rooms, residents and expenses belong to one property, so they are not offered while viewing all properties.
  const perProperty = (screen: string) => (all ? undefined : () => go(screen));

  // Occupancy tiles: counts only, no money (money lives in its own section).
  const occupancyTiles: Tile[] = [];
  if (summary) {
    if (isApartment) {
      occupancyTiles.push(
        { label: 'Flats', value: String(summary.rooms), color: colors.blue, onPress: perProperty('Rooms') },
        { label: 'Vacant flats', value: String(summary.vacant), color: summary.vacant ? colors.good : colors.muted, onPress: perProperty('Rooms') },
      );
    } else {
      occupancyTiles.push(
        { label: 'Rooms', value: String(summary.rooms), color: colors.blue, onPress: perProperty('Rooms') },
        { label: 'Total beds', value: String(summary.beds), color: colors.blue, onPress: perProperty('Rooms') },
        { label: 'Vacant beds', value: String(summary.vacant), color: summary.vacant ? colors.good : colors.muted, onPress: perProperty('Rooms') },
      );
    }
    if (summary.checkInsToday > 0) {
      occupancyTiles.push({ label: 'Check-ins today', value: String(summary.checkInsToday), color: colors.good, onPress: () => go('Today') });
    }
    occupancyTiles.push({ label: 'Check-ins this month', value: String(summary.checkInsMonth), color: colors.blue, onPress: perProperty('Residents') });
  }

  const owing = (summary?.totalDue ?? 0) > 0;
  const dueCount = summary?.pendingDues?.length ?? 0;

  return (
    <Screen
      title="Dashboard"
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {summary && (
        <>
          {/* ── Pending check-in requests: one compact tappable strip ── */}
          {pendingRequests > 0 && (
            <TouchableOpacity
              style={dashStyles.banner}
              onPress={() => go('CheckinRequests')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Review pending booking requests"
            >
              <Ionicons name="notifications" size={18} color="#ea580c" />
              <View style={{ flex: 1 }}>
                <Text style={dashStyles.bannerTitle} numberOfLines={1}>
                  {pendingRequests} {isApartment ? 'flat' : 'bed'} booking request{pendingRequests > 1 ? 's' : ''} pending
                </Text>
                <Text style={dashStyles.bannerSub} numberOfLines={1}>
                  {isApartment ? 'Waiting for flat approval' : 'Waiting for room & bed approval'}
                </Text>
              </View>
              <Text style={dashStyles.bannerLink}>Review</Text>
              <Ionicons name="chevron-forward" size={14} color="#ea580c" />
            </TouchableOpacity>
          )}

          {all && <PropertyBreakdown properties={summary.properties ?? []} />}

          
<TileGrid tiles={occupancyTiles} />


          {/* ── MONEY: its own section ── */}
          
{/* ── PENDING DUES: independent section ── */}
<SectionHeader title="Pending dues" />

<Card style={[dashStyles.panel, dashStyles.pendingPanel]}>
  <TouchableOpacity
    style={dashStyles.pendingDuesRow}
    onPress={() => go('PendingDues')}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityLabel="View all pending dues"
  >
    <View style={dashStyles.pendingIcon}>
      <Ionicons
        name={owing ? 'alert-circle' : 'checkmark-circle'}
        size={28}
        color={owing ? colors.bad : colors.good}
      />
    </View>

    <View style={dashStyles.pendingDivider} />

    <View style={{ flex: 1 }}>
      <Text style={dashStyles.pendingTitle}>Pending Dues</Text>
      <Text
        style={[
          dashStyles.pendingAmount,
          { color: owing ? colors.bad : colors.good },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {money(summary.totalDue)}
      </Text>
    </View>

    <View style={{ alignItems: 'flex-end' }}>
      <Text style={dashStyles.pendingCount}>
        {owing
          ? `${dueCount} resident${dueCount === 1 ? '' : 's'}`
          : 'All clear'}
      </Text>

      <View style={dashStyles.pendingViewAll}>
        <Text style={dashStyles.link}>View All</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </View>
    </View>
  </TouchableOpacity>
</Card>

{/* ── MONEY OVERVIEW: separate financial card ── */}
<SectionHeader title="Money Overview" right="This month" />

<Card style={[dashStyles.panel, dashStyles.moneyPanel]}>
  {/* Net collection highlighted */}
  <View style={dashStyles.netHero}>
    <View style={dashStyles.netIcon}>
      <Ionicons name="wallet" size={27} color="#fff" />
    </View>

    <View style={{ flex: 1 }}>
      <Text style={dashStyles.netLabel}>Net Collection</Text>
      <Text
        style={dashStyles.netAmount}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {money(summary.net.month)}
      </Text>
    </View>

    <Ionicons name="stats-chart" size={30} color="#86c994" />
  </View>

  {/* Collected and Expenses */}
  <View style={dashStyles.moneyRow}>
    <MoneyTile
      label="Collected"
      value={money(summary.collections.month)}
      color={colors.good}
      onPress={() => go('Overview')}
    />

    <MoneyTile
      label="Expenses"
      value={money(summary.expenses.month)}
      color={colors.warn}
      onPress={perProperty('Expenses')}
      divider
    />
  </View>

  {/* Refundable deposit */}
  <TouchableOpacity
    style={dashStyles.depositRow}
    onPress={perProperty('Residents')}
    disabled={all}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel="Refundable deposit"
  >
    <Ionicons name="wallet-outline" size={20} color="#0d9488" />
    <Text style={dashStyles.depositLabel}>Refundable Deposit</Text>
    <Text style={dashStyles.depositAmount}>
      {money(summary.totalRefundableDeposit)}
    </Text>
    {!all && (
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    )}
  </TouchableOpacity>
</Card>

          {/* ── Meals: how many residents are eating ── */}
          {isPg && meals.length > 0 && (
            <>
              <SectionHeader title="Meals" right="Residents eating" />
              <Card style={dashStyles.panel}>
                {meals.map((m, i) => (
                  <TouchableOpacity
                    key={`${m.mealId}-${m.date}`}
                    style={[dashStyles.mealRow, i > 0 && dashStyles.mealRowDivider]}
                    onPress={() => go('FoodMenu')}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.name} attendance`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={dashStyles.mealName}>{m.name}</Text>
                      <Text style={dashStyles.mealTime}>
                        {m.state === 'NOW' ? 'Now' : m.date === today() ? 'Today' : 'Tomorrow'} · {clock12(m.startTime)} – {clock12(m.endTime)}
                      </Text>
                    </View>
                    <MealCount value={m.attending} label="Eating" color={colors.good} />
                    <MealCount value={m.notAttending} label="Not eating" color={colors.bad} />
                    <MealCount value={m.notAnswered} label="No reply" color={colors.muted} />
                  </TouchableOpacity>
                ))}
              </Card>
            </>
          )}



          {/* ── OCCUPANCY: counts only ── */}
          

          {/* ── Quick actions ── */}
          <SectionHeader title="Quick actions" />
          <View style={dashStyles.actions}>
            {!all && (
              <>
                <QuickAction icon="bed" color={colors.blue} label={isApartment ? 'Add Flat' : 'Add Room'} onPress={() => setAddingRoom(true)} />
                <QuickAction icon="people" color={colors.primary} label="Add Resident" onPress={() => setAddingResident(true)} />
                <QuickAction icon="receipt" color={colors.warn} label="Add Expense" onPress={() => setAddingExpense(true)} />
                <QuickAction icon="megaphone" color="#7c3aed" label="Announce" onPress={() => setAddingAnnouncement(true)} />
                <QuickAction icon="log-in" color="#ea580c" label="Check-in Requests" badge={pendingRequests} onPress={() => go('CheckinRequests')} />
                <QuickAction icon="exit" color="#dc2626" label="Vacate Requests" badge={pendingVacates} onPress={() => go('VacateRequests')} />
                <QuickAction icon="construct" color="#0d9488" label="Complaints" badge={pendingComplaints} onPress={() => go('Complaints')} />
                {isPg && <QuickAction icon="restaurant" color="#ea580c" label="Food Menu" onPress={() => go('FoodMenu')} />}
                <QuickAction icon="call" color="#2563eb" label="Support Contacts" onPress={() => go('SupportContacts')} />
                {user?.pgId ? <QuickAction icon="images" color="#db2777" label="Property Photos" onPress={() => setPhotosOpen(true)} /> : null}
                {/* {user?.role !== 'MANAGER' && <QuickAction icon="options" color="#0891b2" label="Property Setup" onPress={() => go('PropertySetup')} />} */}
              </>
            )}
            <QuickAction icon="business" color={colors.good} label="Add Property" onPress={() => setAddingProperty(true)} />
          </View>

          <AddPropertyModal visible={addingProperty} onClose={() => setAddingProperty(false)} />
          <PicturesSheet
            target={photosOpen && user?.pgId ? { type: 'property', id: user.pgId, title: user.pgName || 'Property' } : null}
            onClose={() => setPhotosOpen(false)}
          />
          <AddRoomModal
            visible={addingRoom}
            onClose={() => setAddingRoom(false)}
            onCreated={() => {
              setAddingRoom(false);
              go('Rooms');
            }}
          />
          <AddResidentModal
            visible={addingResident}
            rooms={rooms}
            onClose={() => setAddingResident(false)}
            onAdded={() => {
              setAddingResident(false);
              go('Residents');
            }}
          />
          <AddExpenseModal
            visible={addingExpense}
            onClose={() => setAddingExpense(false)}
            onCreated={() => {
              setAddingExpense(false);
              go('Expenses');
            }}
          />
          <AddAnnouncementModal
            visible={addingAnnouncement}
            onClose={() => setAddingAnnouncement(false)}
            onCreated={() => {
              setAddingAnnouncement(false);
              go('Announcements');
            }}
          />
        </>
      )}
    </Screen>
  );
}

/** One headcount (number over a small label) in a meal row. */
function MealCount({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={dashStyles.mealCount}>
      <Text style={[dashStyles.mealCountValue, { color }]}>{value}</Text>
      <Text style={dashStyles.mealCountLabel}>{label}</Text>
    </View>
  );
}

/** Small uppercase label that separates sections; optional hint on the right. */
function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <View style={dashStyles.sectionHeader}>
      <Text style={dashStyles.sectionTitle}>{title}</Text>
      {right ? <Text style={dashStyles.sectionHint}>{right}</Text> : null}
    </View>
  );
}

/** One money figure in the Collected | Expenses | Net row. */
function MoneyTile({
  label,
  value,
  color,
  onPress,
  divider,
}: {
  label: string;
  value: string;
  color: string;
  onPress?: () => void;
  divider?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[dashStyles.moneyTile, divider && dashStyles.tileLeft]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label} ${value}`}
    >
      <Text style={dashStyles.kpiLabel}>{label}</Text>
      <Text style={[dashStyles.moneyValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

type Tile = { label: string; value: string; color: string; onPress?: () => void };

/** Count tiles in a hairline grid: 4 or fewer share one row, more wrap to 3 per row. */

/** Modern occupancy statistic cards */

function TileGrid({ tiles }: { tiles: Tile[] }) {
  const getIcon = (
    label: string
  ): React.ComponentProps<typeof Ionicons>['name'] => {
    const value = label.toLowerCase();

    if (value.includes('vacant')) return 'bed-outline';
    if (value.includes('check-in')) return 'calendar-outline';
    if (value.includes('flat')) return 'business-outline';
    if (value.includes('room')) return 'home-outline';
    if (value.includes('beds')) return 'bed-outline';

    return 'people-outline';
  };

  return (
    <View style={dashStyles.occupancyGrid}>
      {tiles.slice(0, 6).map((tile) => (
        <TouchableOpacity
          key={tile.label}
          style={[
            dashStyles.occupancyTile,
            { backgroundColor: `${tile.color}0D` },
          ]}
          onPress={tile.onPress}
          disabled={!tile.onPress}
          activeOpacity={0.7}
          accessibilityRole={tile.onPress ? 'button' : undefined}
          accessibilityLabel={`${tile.label} ${tile.value}`}
        >
          <Ionicons
            name={getIcon(tile.label)}
            size={15}
            color={tile.color}
          />

          <Text
            style={[dashStyles.occupancyValue, { color: tile.color }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {tile.value}
          </Text>

          <Text
            style={dashStyles.occupancyLabel}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {tile.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}



/** Shortcut tile for the quick-action grid: icon on top, label underneath, optional count badge. */
function QuickAction({
  icon,
  color,
  label,
  badge,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  label: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={dashStyles.action} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label}>
      {badge ? (
        <View style={dashStyles.actionBadge}>
          <Text style={dashStyles.actionBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      <Ionicons name={icon} size={24} color={color} />
      <Text style={dashStyles.actionLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Per-property split shown above the consolidated numbers. */
function PropertyBreakdown({ properties }: { properties: NonNullable<Summary['properties']> }) {
  return (
    <>
      <SectionHeader title="Your properties" />
      {properties.map((p) => (
        <Card key={p.pgId} style={{ paddingVertical: 8, paddingHorizontal: 12, marginBottom: 6 }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.h2, { fontSize: 14 }]} numberOfLines={1}>{p.name}</Text>
              <Text style={[s.muted, { fontSize: 11 }]}>
                {p.occupied}/{p.beds} beds occupied{p.city ? ` · ${p.city}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.good, fontWeight: '800' }}>{money(p.collectedMonth)}</Text>
              <Text style={[s.muted, { fontSize: 10 }]}>
                Spent {money(p.spentMonth)}
                {p.totalDue > 0 ? ` · Due ${money(p.totalDue)}` : ''}
              </Text>
            </View>
          </View>
        </Card>
      ))}
    </>
  );
}

const dashStyles = StyleSheet.create({
  // ── section headers ──
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted },
  sectionHint: { fontSize: 11, color: colors.muted },

  // ── Pending dues: separate highlighted card ──
  
pendingPanel: {
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#fecaca',
  borderRadius: 12,
  marginBottom: 4,
},

pendingDuesRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  paddingVertical: 9,
  paddingHorizontal: 10,
  backgroundColor: '#fff5f5',
},

pendingIcon: {
  width: 30,
  height: 30,
  borderRadius: 15,
  backgroundColor: '#fee2e2',
  alignItems: 'center',
  justifyContent: 'center',
},

pendingDivider: {
  width: 1,
  height: 36,
  backgroundColor: '#fecaca',
},

pendingTitle: {
  fontSize: 11,
  fontWeight: '700',
  color: colors.muted,
},

pendingAmount: {
  fontSize: 19,
  fontWeight: '800',
  marginTop: 1,
},

pendingCount: {
  fontSize: 10,
  color: colors.muted,
  marginBottom: 3,
},

pendingViewAll: {
  flexDirection: 'row',
  alignItems: 'center',
},

  // ── Money overview ──
  moneyPanel: {
    backgroundColor: '#f4faf5',
    overflow: 'hidden',
    marginBottom: 4,
  },
  netHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: '#e1f3e5',
  },
  netIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    paddingVertical: 13,
    paddingHorizontal: 12,
    gap: 4,
  },
  moneyValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  depositRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  depositLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  depositAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0d9488',
  },


// ── Occupancy statistic cards ──


occupancyGrid: {
  flexDirection: 'row',
  flexWrap: 'nowrap',
  gap: 4,
  marginBottom: 2,
},
occupancyTile: {
  flex: 1,
  minWidth: 0,
  minHeight: 66,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: colors.border,
  paddingVertical: 6,
  paddingHorizontal: 2,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
},
occupancyValue: {
  fontSize: 17,
  fontWeight: '900',
},
occupancyLabel: {
  fontSize: 9,
  lineHeight: 11,
  color: colors.muted,
  fontWeight: '700',
  textAlign: 'center',
},
  // ── shared panel (Card with no padding; rows pad themselves) ──
  panel: { padding: 0, overflow: 'hidden', marginBottom: 0 },
  kpiLabel: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  link: { fontSize: 11, fontWeight: '700', color: colors.primary },

  // ── money section ──
  duesRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  duesIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  duesAmount: { fontSize: 22, fontWeight: '800' },
  duesSub: { fontSize: 11, color: colors.muted, marginBottom: 2 },
  // ── occupancy grid ──
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  tileTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tileLeft: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  tileValue: { fontSize: 20, fontWeight: '800' },
  tileLabel: { fontSize: 11, lineHeight: 14, color: colors.muted, textAlign: 'center', fontWeight: '600' },

  // ── quick actions ──
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  action: {
    width: '23%',
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionLabel: { fontSize: 11, lineHeight: 13, fontWeight: '700', color: colors.text, textAlign: 'center' },
  actionBadge: {
    position: 'absolute',
    top: 4,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  actionBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // ── pending requests strip ──
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  bannerTitle: { fontSize: 13, fontWeight: '800', color: '#9a3412' },
  bannerSub: { fontSize: 11, color: '#c2410c', marginTop: 1 },
  bannerLink: { fontSize: 12, fontWeight: '800', color: '#ea580c' },

  mealRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  mealRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  mealName: { fontSize: 15, fontWeight: '800', color: colors.text },
  mealTime: { fontSize: 11, color: colors.muted, marginTop: 2 },
  mealCount: { alignItems: 'center', minWidth: 52 },
  mealCountValue: { fontSize: 18, fontWeight: '800' },
  mealCountLabel: { fontSize: 10, color: colors.muted, marginTop: 1 },
});