import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { get } from '../api';
import { useAuth } from '../auth';
import { useResource } from '../hooks';
import { PicturesSheet } from '../pictures';
import { Room, Summary } from '../types';
import { AddPropertyModal, Card, Screen, Stat, colors, s } from '../ui';
import { money } from '../utils';
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
      return { summary, pendingRequests: 0, pendingVacates: 0, pendingComplaints: 0, stayType: null as string | null };
    }
    const [summary, requests, profile, notices, complaints] = await Promise.all([
      get<Summary>('/api/dashboard/summary'),
      get<{ pending: number }>('/api/booking-requests/count').catch(() => ({ pending: 0 })),
      get<{ stayType?: string | null }>('/api/pg/profile').catch(() => null),
      get<{ pending: number }>('/api/residents/notice-count').catch(() => ({ pending: 0 })),
      get<{ pending: number }>('/api/complaints/count').catch(() => ({ pending: 0 })),
    ]);
    return {
      summary,
      pendingRequests: requests.pending,
      pendingVacates: notices.pending,
      pendingComplaints: complaints.pending,
      stayType: profile?.stayType ?? null,
    };
  });

  const summary = data?.summary;
  const pendingRequests = data?.pendingRequests ?? 0;
  const pendingVacates = data?.pendingVacates ?? 0;
  const pendingComplaints = data?.pendingComplaints ?? 0;
  // Apartments rent whole flats, so count flats instead of beds.
  const isApartment = data?.stayType === 'APARTMENT';

  const go = (screen: string, params?: object) => navigation?.navigate?.(screen, params);
  // Rooms, residents and expenses belong to one property, so they are not offered while viewing all properties.
  const perProperty = (screen: string) => (all ? undefined : () => go(screen));

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
                  navigation?.navigate?.('CheckinRequests');
                }}
              >
                <Text style={dashStyles.bannerBtnText}>Review</Text>
                <Ionicons name="chevron-forward" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {all && <PropertyBreakdown properties={summary.properties ?? []} />}

          {/* ── Pending dues: opens the full list ── */}
          <TouchableOpacity
            style={[dashStyles.duesCard, summary.totalDue > 0 ? dashStyles.duesCardOwing : dashStyles.duesCardClear]}
            onPress={() => go('PendingDues')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="View all pending dues"
          >
            <View style={[dashStyles.duesIcon, { backgroundColor: summary.totalDue > 0 ? '#fee2e2' : '#dcfce7' }]}>
              <Ionicons
                name={summary.totalDue > 0 ? 'alert-circle' : 'checkmark-circle'}
                size={24}
                color={summary.totalDue > 0 ? colors.bad : colors.good}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statLabel}>Pending dues</Text>
              <Text style={[dashStyles.duesAmount, { color: summary.totalDue > 0 ? colors.bad : colors.good }]} numberOfLines={1}>
                {money(summary.totalDue)}
              </Text>
              <Text style={s.muted}>
                {summary.totalDue > 0
                  ? ``
                  : 'No Pending Dues'}
              </Text>
            </View>
            <Text style={dashStyles.duesLink}>View all</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </TouchableOpacity>
          {/* ── KPIs (tap one to open its screen) ── */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {isApartment ? (
              <>
                <Stat icon="home-outline" label="Flats" value={String(summary.rooms)} color={colors.blue} onPress={perProperty('Rooms')} />
                <Stat icon="key-outline" label="Vacant flats" value={String(summary.vacant)} color={summary.vacant ? colors.good : colors.muted} onPress={perProperty('Rooms')} />
              </>
            ) : (
              <>
                <Stat icon="bed-outline" label="Rooms" value={String(summary.rooms)} color={colors.blue} onPress={perProperty('Rooms')} />
                <Stat icon="bed-outline" label="Total beds" value={String(summary.beds)} color={colors.blue} onPress={perProperty('Rooms')} />
                <Stat icon="bed" label="Vacant beds" value={String(summary.vacant)} color={summary.vacant ? colors.good : colors.muted} onPress={perProperty('Rooms')} />
              </>
            )}
            {summary.checkInsToday > 0 && (
              <Stat icon="log-in-outline" label="Check-ins (today)" value={String(summary.checkInsToday)} color={colors.good} onPress={() => go('Today')} />
            )}
            <Stat icon="people-outline" label="Check-ins (this month)" value={String(summary.checkInsMonth)} color={colors.blue} onPress={perProperty('Residents')} />
            <Stat icon="cash-outline" label="Collected (this month)" value={money(summary.collections.month)} color={colors.good} onPress={() => go('Overview')} />
            <Stat icon="receipt-outline" label="Expenses (this month)" value={money(summary.expenses.month)} color={colors.warn} onPress={perProperty('Expenses')} />
            <Stat icon="trending-up" label="Net (this month)" value={money(summary.net.month)} color={summary.net.month >= 0 ? colors.good : colors.bad} onPress={() => go('Overview')} />
            <Stat icon="wallet-outline" label="Total Refundable Deposit" value={money(summary.totalRefundableDeposit)} color="#0d9488" onPress={perProperty('Residents')} />
          </View>
          {/* ── Quick actions ── */}
          <Text style={[s.h2, { marginTop: 16, marginBottom: 8 }]}>Quick actions</Text>
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
                <QuickAction icon="call" color="#2563eb" label="Support Contacts" onPress={() => go('SupportContacts')} />
                {user?.pgId ? <QuickAction icon="images" color="#db2777" label="Property Photos" onPress={() => setPhotosOpen(true)} /> : null}
                {user?.role !== 'MANAGER' && <QuickAction icon="options" color="#0891b2" label="Property Setup" onPress={() => go('PropertySetup')} />}
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

/** Shortcut tile for the quick-action grid: white card, large coloured icon, bold label underneath. */
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
      <Ionicons name={icon} size={30} color={color} />
      <Text style={dashStyles.actionLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Per-property split shown above the consolidated numbers. */
function PropertyBreakdown({ properties }: { properties: NonNullable<Summary['properties']> }) {
  return (
    <>
      <Text style={[s.h2, { marginBottom: 8 }]}>Your properties</Text>
      {properties.map((p) => (
        <Card key={p.pgId} style={{ paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 }}>
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
      <View style={{ height: 4 }} />
    </>
  );
}

const dashStyles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
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
  action: {
    width: '23%',
    minHeight: 82,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 3,
    shadowColor: '#1e293b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  duesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  duesCardOwing: { borderColor: '#fecaca', borderLeftColor: colors.bad },
  duesCardClear: { borderColor: '#bbf7d0', borderLeftColor: colors.good },
  duesIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  duesAmount: { fontSize: 20, fontWeight: '800', marginVertical: 1 },
  duesLink: { fontSize: 12, fontWeight: '700', color: colors.primary },  actionLabel: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: colors.text, textAlign: 'center' },
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
