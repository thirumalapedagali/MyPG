import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { del, errorMessage, get, PickedFile, post, upload } from '../api';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { attempt, useResource } from '../hooks';
import { ImagePickerField, uploadPictures, ViewablePhoto } from '../images';
import { PicturesSheet } from '../pictures';
import { Bed, BookingRequest, Payment, Resident, Room, SharingOption, StayType } from '../types';
import { DateField } from '../dateField';
import { Avatar, Badge, Button, Card, Chips, Empty, FormModal, HeaderAction, PickerModal, Screen, SearchInput, colors, s } from '../ui';
import { formatDateTime, isDate, isDateTime, money, nowDateTime, today } from '../utils';
import { useAuth } from '../auth';

const AVATAR_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0d9488', '#e11d48'];
const avatarBg = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

const FILTER_TABS = ['Active', 'With dues', 'Paid up', 'Ex-Residents', 'All'] as const;

type MonthRecord = {
  monthKey: string;
  monthName: string;
  periodLabel: string;
  year: number;
  billedDate: string;
  cycleEndDate: string;
  rent: number;
  paid: number;
  due: number;
  status: 'PAID' | 'PARTIAL' | 'DUE';
  payments: Payment[];
};

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPeriodLabel(startStr: string, endStr: string): string {
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  if (sy === ey) {
    return `${sd} ${SHORT_MONTHS[sm - 1]} - ${ed} ${SHORT_MONTHS[em - 1]} ${ey}`;
  }
  return `${sd} ${SHORT_MONTHS[sm - 1]} ${sy} - ${ed} ${SHORT_MONTHS[em - 1]} ${ey}`;
}

function addMonthsToDate(baseDateStr: string, monthsToAdd: number): string {
  const [baseYear, baseMonth, baseDay] = baseDateStr.split('-').map(Number);
  const targetMonthIndex = baseMonth - 1 + monthsToAdd;
  const targetYear = Math.floor(targetMonthIndex / 12) + baseYear;
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const daysInMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const targetDay = Math.min(baseDay, daysInMonth);
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface ResidentSummary {
  totalResidents: number;
  totalRent: number;
  totalDue: number;
  withDues: number;
  paidCount: number;
}

const ALL_FLOORS = 'All Floors';

const shortFloor = (name: string) => {
  const short = name.replace(/\s+floor$/i, '');
  return short === 'Ground' ? 'G' : short;
};

function buildFloorNames(total?: number | null): string[] {
  const count = total && total > 0 ? total : 3;
  const list = ['Ground Floor'];
  for (let i = 1; i <= count; i++) {
    const suffix = i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th';
    list.push(`${i}${suffix} Floor`);
  }
  return list;
}

export default function Residents({
  route,
  navigation,
}: {
  route?: { params?: { filter?: (typeof FILTER_TABS)[number]; residentId?: number; add?: number } };
  navigation?: any;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTER_TABS)[number]>(route?.params?.filter || 'Active');
  const [floorFilter, setFloorFilter] = useState<string>(ALL_FLOORS);
  const [page, setPage] = useState(0);
  const size = 20;

  const getBackendParams = () => {
    if (filter === 'Active') return { status: 'ACTIVE', filter: '' };
    if (filter === 'With dues') return { status: 'ACTIVE', filter: 'WITH_DUES' };
    if (filter === 'Paid up') return { status: 'ACTIVE', filter: 'PAID_UP' };
    if (filter === 'Ex-Residents') return { status: 'CHECKED_OUT', filter: '' };
    return { status: 'all', filter: '' };
  };

  const { data: staticData, error, loading: staticLoading, refreshing: staticRefreshing, reload: reloadStatic } = useResource(async () => {
    const [rooms, allPayments, summary] = await Promise.all([
      get<Room[]>('/api/rooms'),
      get<Payment[]>('/api/payments').catch(() => []),
      get<ResidentSummary>('/api/residents/summary').catch(() => ({ totalResidents: 0, totalRent: 0, totalDue: 0, withDues: 0, paidCount: 0 })),
    ]);
    return { rooms, allPayments, summary };
  }, []);

  const [pagedData, setPagedData] = useState<{ content: Resident[]; totalPages: number; totalElements: number } | null>(null);
  const [pagedLoading, setPagedLoading] = useState(false);

  const fetchPagedResidents = useCallback(async () => {
    setPagedLoading(true);
    try {
      const params = getBackendParams();
      const res = await get<{ content: Resident[]; totalPages: number; totalElements: number }>(
        `/api/residents?page=${page}&size=${size}&status=${params.status}&filter=${params.filter}&search=${encodeURIComponent(search)}&floor=${encodeURIComponent(floorFilter)}`
      );
      setPagedData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setPagedLoading(false);
    }
  }, [page, filter, search, floorFilter]);

  useEffect(() => {
    fetchPagedResidents();
  }, [fetchPagedResidents]);

  const loading = staticLoading || (pagedLoading && !pagedData);
  const refreshing = staticRefreshing;
  const reload = () => {
    reloadStatic();
    fetchPagedResidents();
  };
  const refresh = reload;

  const data = staticData ? {
    rooms: staticData.rooms,
    allPayments: staticData.allPayments,
    summary: staticData.summary,
    pagedData: pagedData,
  } : null;

  const changeFilter = (newFilter: (typeof FILTER_TABS)[number]) => {
    setFilter(newFilter);
    setPage(0);
  };

  const changeSearch = (newSearch: string) => {
    setSearch(newSearch);
    setPage(0);
  };

  const changeFloor = (newFloor: string) => {
    setFloorFilter(newFloor);
    setPage(0);
  };

  const [selectedResidentId, setSelectedResidentId] = useState<number | null>(null);
  const [showAddResident, setShowAddResident] = useState(false);
  // Dashboard quick action: a new `add` value opens the add-resident form.
  const addSignal = route?.params?.add;
  const [seenAdd, setSeenAdd] = useState<number | undefined>(undefined);
  if (addSignal !== seenAdd) {
    setSeenAdd(addSignal);
    if (addSignal != null) setShowAddResident(true);
  }
  const [movingResident, setMovingResident] = useState<Resident | null>(null);
  const [rejoiningResident, setRejoiningResident] = useState<Resident | null>(null);
  const [payForResident, setPayForResident] = useState<Resident | null>(null);
  const [vacatingResident, setVacatingResident] = useState<Resident | null>(null);
  // Set when collecting for one billing cycle, so the form pre-fills that cycle's due instead of the total.
  const [payCycleAmount, setPayCycleAmount] = useState<number | null>(null);

  // Opened from another screen (e.g. Today) with a specific resident: show that resident's details.
  const requestedResidentId = route?.params?.residentId;
  const [handledResidentId, setHandledResidentId] = useState<number | undefined>(undefined);
  if (requestedResidentId != null && requestedResidentId !== handledResidentId) {
    setHandledResidentId(requestedResidentId);
    setSelectedResidentId(requestedResidentId);
  } else if (requestedResidentId == null && handledResidentId !== undefined) {
    setHandledResidentId(undefined);
  }
  useEffect(() => {
    if (requestedResidentId != null) {
      reload();
      navigation?.setParams?.({ residentId: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedResidentId]);

  const [fetchedResident, setFetchedResident] = useState<Resident | null>(null);

  const rooms = data?.rooms ?? [];
  const floorTabs = useMemo(() => {
    const names = buildFloorNames(user?.totalFloors);
    for (const r of rooms) {
      const f = r.floorName?.trim() || 'Ground Floor';
      if (!names.includes(f)) names.push(f);
    }
    return [ALL_FLOORS, ...names];
  }, [rooms, user?.totalFloors]);

  const floorChips = useMemo(() => floorTabs.map(shortFloor), [floorTabs]);

  const allPayments = data?.allPayments ?? [];
  const summary = data?.summary ?? { totalResidents: 0, totalRent: 0, totalDue: 0, withDues: 0, paidCount: 0 };

  const residents = data?.pagedData?.content ?? [];
  const totalPages = data?.pagedData?.totalPages ?? 0;
  const totalElements = data?.pagedData?.totalElements ?? 0;

  const totalResidentsCount = summary.totalResidents;
  const totalDue = summary.totalDue;
  const totalRent = summary.totalRent;
  const withDues = summary.withDues;
  const paidCount = summary.paidCount;
  const openRooms = rooms.filter((r) => r.vacant > 0);

  useEffect(() => {
    if (!selectedResidentId) {
      setFetchedResident(null);
      return;
    }
    const found = residents.find((r) => r.id === selectedResidentId);
    if (found) {
      setFetchedResident(null);
    } else {
      get<Resident>(`/api/residents/${selectedResidentId}`)
        .then(setFetchedResident)
        .catch(console.error);
    }
  }, [selectedResidentId, residents]);

  const selectedResident = residents.find((r) => r.id === selectedResidentId) || fetchedResident || null;

  // Hardware/gesture back while viewing a resident should return to the residents list, not the previous tab.
  const hasSelectedResident = selectedResidentId != null;
  useFocusEffect(
    useCallback(() => {
      if (!hasSelectedResident) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setSelectedResidentId(null);
        return true;
      });
      return () => sub.remove();
    }, [hasSelectedResident]),
  );

  const handleCall = (phone?: string | null) => {
    if (!phone) {
      Alert.alert('No Phone', 'No phone number is available for this resident.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (r: Resident) => {
    if (!r.phone) {
      Alert.alert('No Phone', 'No phone number is available for this resident.');
      return;
    }
    const clean = r.phone.replace(/[^0-9]/g, '');
    const dueText = r.due && r.due > 0 ? ` Outstanding rent due: ₹${Math.round(r.due)}.` : '';
    const msg = `Hello ${r.name || 'Resident'}, greeting from MyStay.${dueText}`;

    if (r.due > 0) {
      Alert.alert('WhatsApp Reminder', `Send payment due reminder of ₹${Math.round(r.due)} to ${r.name}?`, [
        {
          text: 'Send via WhatsApp Cloud API',
          onPress: async () => {
            const ok = await attempt(() => post(`/api/notifications/remind-due/${r.id}`));
            if (ok) {
              Alert.alert('Reminder Sent', `Automated WhatsApp due reminder sent to ${r.name}.`);
            }
          },
        },
        {
          text: 'Open WhatsApp App',
          onPress: () => {
            Linking.openURL(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Linking.openURL(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`);
    }
  };

  /** Statement for a single billing cycle only (not the resident's lifetime totals). */
  const handleShareDues = async (r: Resident, m: MonthRecord) => {
    try {
      const paymentLines = m.payments.map((p) => `• ${p.date}: ₹${Math.round(p.amount)}`).join('\n');
      const msg =
        `*MyStay - Rent Statement*\nResident: ${r.name}\nRoom: ${r.roomNumber || '—'}\n` +
        `Period: ${m.periodLabel}\nRent for this period: ₹${Math.round(m.rent)}\n` +
        `Paid for this period: ₹${Math.round(m.paid)}\n` +
        (paymentLines ? `Payments:\n${paymentLines}\n` : '') +
        `*Due for this period: ₹${Math.round(m.due)}*` +
        (m.due > 0 ? '\n\nPlease clear the balance at your earliest convenience. Thank you!' : '\n\nThank you for the payment!');
      await Share.share({ message: msg });
    } catch {
      // dismissed
    }
  };

  const confirmVacateBed = (r: Resident) =>
    Alert.alert('Vacate Bed', `Vacate bed for ${r.name}? The bed will immediately become vacant for new bookings.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Vacate Bed',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => post(`/api/residents/${r.id}/vacate-bed`))) {
            reload();
          }
        },
      },
    ]);


  const confirmCancelLeaving = (r: Resident) =>
    Alert.alert('Cancel leaving', `${r.name} will stay. Remove the planned checkout on ${r.vacateOn}?`, [
      { text: 'Keep checkout', style: 'cancel' },
      {
        text: 'Cancel checkout',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => del(`/api/residents/${r.id}/notice`))) reload();
        },
      },
    ]);

  const confirmRemove = (r: Resident) =>
    Alert.alert('Remove resident', `Remove ${r.name}? Their payment history, bed allocation and login are deleted too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => del(`/api/residents/${r.id}`))) {
            if (selectedResidentId === r.id) setSelectedResidentId(null);
            reload();
          }
        },
      },
    ]);

  if (selectedResident) {
    const residentPayments = allPayments.filter((p) => p.residentId === selectedResident.id);
    return (
      <View style={{ flex: 1 }}>
        <ResidentDetailView
          resident={selectedResident}
          payments={residentPayments}
          onBack={() => setSelectedResidentId(null)}
          onRecordPayment={(amount) => {
            setPayCycleAmount(amount ?? null);
            setPayForResident(selectedResident);
          }}
          onMoveRoom={() => setMovingResident(selectedResident)}
          onVacateBed={() => confirmVacateBed(selectedResident)}
          onVacateResident={() => setVacatingResident(selectedResident)}
          onCancelLeaving={() => confirmCancelLeaving(selectedResident)}
          onRejoin={() => setRejoiningResident(selectedResident)}
          onRemove={() => confirmRemove(selectedResident)}
          onCall={() => handleCall(selectedResident.phone)}
          onWhatsApp={() => handleWhatsApp(selectedResident)}
          onShare={(m) => handleShareDues(selectedResident, m)}
          refreshing={refreshing}
          onRefresh={refresh}
        />

        {payForResident && (
          <FormModal
            visible={payForResident !== null}
            title={`Record payment - ${payForResident.name}`}
            submitLabel="Record"
            fields={[
              {
                key: 'amount',
                label: 'Amount (₹)',
                keyboard: 'number-pad',
                initial:
                  payCycleAmount != null
                    ? String(payCycleAmount)
                    : payForResident.due > 0
                      ? String(payForResident.due)
                      : String(payForResident.rent),
              },
              { key: 'date', label: 'Date', initial: today(), date: true },
            ]}
            onClose={() => {
              setPayForResident(null);
              setPayCycleAmount(null);
            }}
            onSubmit={async (v) => {
              const amount = parseFloat(v.amount);
              if (!(amount > 0) || !isDate(v.date)) {
                Alert.alert('Invalid', 'Check amount and date.');
                return false;
              }
              if (
                !(await attempt(() =>
                  post('/api/payments', { residentId: payForResident.id, amount, date: v.date })
                ))
              )
                return false;
              setPayForResident(null);
              setPayCycleAmount(null);
              reload();
            }}
          />
        )}

        {vacatingResident && (
          <FormModal
            visible={vacatingResident !== null}
            title={`Check out - ${vacatingResident.name}`}
            submitLabel="Confirm Checkout"
            fields={[
              { key: 'checkOutDate', label: 'Check-out Date (a future date only schedules it)', initial: today(), date: true },
              {
                key: 'returnedDeposit',
                label: 'Returned Deposit Amount (₹)',
                keyboard: 'number-pad',
                initial: String(vacatingResident.securityDeposit ?? 0),
              },
            ]}
            onClose={() => setVacatingResident(null)}
            onSubmit={async (v) => {
              const returnedDeposit = parseFloat(v.returnedDeposit) || 0;
              if (returnedDeposit < 0) {
                Alert.alert('Invalid', 'Returned deposit cannot be negative.');
                return false;
              }
              if (!isDate(v.checkOutDate)) {
                Alert.alert('Invalid', 'Check check-out date.');
                return false;
              }
              let queryParams = `checkOutDate=${encodeURIComponent(v.checkOutDate)}&returnedDeposit=${returnedDeposit}`;
              if (v.checkOutDate === today()) {
                queryParams += `&checkOutTime=${encodeURIComponent(nowDateTime())}`;
              }

              if (
                !(await attempt(() =>
                  post(`/api/residents/${vacatingResident.id}/vacate?${queryParams}`)
                ))
              )
                return false;

              const scheduled = v.checkOutDate > today();
              const name = vacatingResident.name;
              setVacatingResident(null);
              reload();
              if (scheduled) {
                Alert.alert('Checkout scheduled', `${name} stays until ${v.checkOutDate}. The bed shows as getting vacated and is released on that date.`);
              }
            }}
          />
        )}

        {movingResident && (
          <MoveResidentModal
            visible={movingResident !== null}
            resident={movingResident}
            rooms={rooms}
            onClose={() => setMovingResident(null)}
            onMoved={() => {
              setMovingResident(null);
              reload();
            }}
          />
        )}

        {rejoiningResident && (
          <RejoinResidentModal
            visible={rejoiningResident !== null}
            resident={rejoiningResident}
            rooms={rooms}
            onClose={() => setRejoiningResident(null)}
            onRejoined={() => {
              setRejoiningResident(null);
              reload();
            }}
          />
        )}
      </View>
    );
  }

  return (
    <Screen
      title="Residents"
      scrollable={false}
      action={<HeaderAction label="Add" icon="person-add" onPress={() => setShowAddResident(true)} />}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {/* ── Top Header Title Wrap ── */}
      <View style={resStyles.topHeaderWrap}>
        <View style={{ flex: 1 }}>
          <Text style={resStyles.headingTitle}>Residents</Text>
          <Text style={resStyles.headingSub}>Manage residents, track dues & room allocations</Text>
        </View>
        <TouchableOpacity style={resStyles.addResidentBtn} onPress={() => setShowAddResident(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={16} color="#ffffff" />
          <Text style={resStyles.addResidentBtnText}>Add Resident</Text>
        </TouchableOpacity>
      </View>

      {/* ── Summary KPI Cards ── */}
      <View style={resStyles.kpiRow}>
        <View style={[resStyles.kpiBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <View style={resStyles.kpiIconWrap}>
            <Ionicons name="people" size={16} color="#16a34a" />
          </View>
          <Text style={resStyles.kpiVal}>{totalResidentsCount}</Text>
          <Text style={resStyles.kpiLbl}>Total Residents</Text>
        </View>

        <View style={[resStyles.kpiBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
          <View style={resStyles.kpiIconWrap}>
            <Ionicons name="wallet-outline" size={16} color="#2563eb" />
          </View>
          <Text style={resStyles.kpiVal} numberOfLines={1}>{money(totalRent)}</Text>
          <Text style={resStyles.kpiLbl}>Monthly Rent</Text>
        </View>

        <View style={[resStyles.kpiBox, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
          <View style={resStyles.kpiIconWrap}>
            <Ionicons name="time" size={16} color="#ea580c" />
          </View>
          <Text style={[resStyles.kpiVal, { color: totalDue > 0 ? '#ea580c' : '#16a34a' }]} numberOfLines={1}>
            {money(totalDue)}
          </Text>
          <Text style={resStyles.kpiLbl}>Pending ({withDues})</Text>
        </View>
      </View>

      {/* ── Search Bar with Filter Tune Button ── */}
      <View style={resStyles.searchContainer}>
        <View style={resStyles.searchBar}>
          <Ionicons name="search-outline" size={17} color={colors.muted} style={{ marginRight: 6 }} />
          <TextInput
            style={resStyles.searchInput}
            value={search}
            onChangeText={changeSearch}
            placeholder="Search name, phone, room or bed..."
            placeholderTextColor={colors.muted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => changeSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={resStyles.filterTuneBtn} onPress={() => {}}>
          <Ionicons name="options-outline" size={18} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {/* ── Floor Filter Chips ── */}
      <Chips
        options={floorChips}
        value={shortFloor(floorFilter)}
        onChange={(val) => {
          const fullFloorName = floorTabs.find((f) => shortFloor(f) === val) || ALL_FLOORS;
          changeFloor(fullFloorName);
        }}
      />

      {/* ── Filter Tabs Row ── */}
      <View style={resStyles.tabFilterRow}>
        <View style={resStyles.filterTabsList}>
          {FILTER_TABS.map((tab) => {
            const active = filter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[resStyles.filterPill, active && resStyles.filterPillActive]}
                onPress={() => changeFilter(tab)}
              >
                <Text style={[resStyles.filterPillText, active && resStyles.filterPillTextActive]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

        <ScrollView
          style={{ flex: 1, marginTop: 10 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {data && totalResidentsCount === 0 && <Empty text="No residents yet. Add a room first, then add residents." />}
          {totalResidentsCount > 0 && residents.length === 0 && <Empty text="No residents match your filter." />}

          <View style={[{ gap: 8, paddingBottom: 20 }, pagedLoading && { opacity: 0.6 }]}>
            {pagedLoading && (
              <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 12 }} />
            )}
            {residents.map((r) => {
          const hasDue = r.due > 0;
          const initial = (r.name || '?')[0].toUpperCase();
          const avColor = avatarBg(r.name);
          const bedInfo = [
            r.roomNumber ? `Room ${r.roomNumber}` : null,
            r.sectionName && r.sectionName !== 'Main Room' ? r.sectionName : null,
            r.bedNumber ? r.bedNumber : null,
          ].filter(Boolean).join(' · ');

          return (
            <TouchableOpacity
              key={r.id}
              style={resStyles.residentCard}
              activeOpacity={0.8}
              onPress={() => setSelectedResidentId(r.id)}
            >
              {/* Left: Avatar */}
              <View style={[resStyles.avatar, { backgroundColor: avColor, overflow: 'hidden' }]}>
                {r.photoUrl ? (
                  <ViewablePhoto uri={r.photoUrl}>
                    <Image source={{ uri: r.photoUrl }} style={{ width: '100%', height: '100%' }} />
                  </ViewablePhoto>
                ) : (
                  <Text style={resStyles.avatarText}>{initial}</Text>
                )}
              </View>

              {/* Center: Info */}
              <View style={resStyles.info}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={resStyles.name}>{r.name}</Text>
                  {r.stayType === 'DAILY' ? (
                    <Badge text="Daily Stay" color="#d97706" />
                  ) : r.sharingType ? (
                    <Badge
                      text={r.sharingType === 'PRIVATE' ? '1-Sharing' : r.sharingType === 'TWO_SHARING' ? '2-Sharing' : r.sharingType === 'THREE_SHARING' ? '3-Sharing' : r.sharingType}
                      color="#0284c7"
                    />
                  ) : null}
                  {r.status !== 'CHECKED_OUT' && (r.noticeStatus === 'REQUESTED' || r.noticeStatus === 'APPROVED') ? (
                    <Badge
                      text={`${r.noticeStatus === 'REQUESTED' ? 'Notice' : 'Leaving'} ${r.vacateOn}`}
                      color={r.noticeStatus === 'REQUESTED' ? colors.warn : colors.bad}
                    />
                  ) : null}
                </View>
                <View style={resStyles.locationRow}>
                  <Ionicons name="bed-outline" size={12} color={colors.muted} />
                  <Text style={resStyles.locationText}>{bedInfo || 'No Bed Assigned'}</Text>
                </View>
                {r.phone ? (
                  <View style={resStyles.locationRow}>
                    <Ionicons name="call-outline" size={12} color={colors.muted} />
                    <Text style={resStyles.locationText}>{r.phone}</Text>
                  </View>
                ) : null}
                <Text style={[resStyles.locationText, { fontSize: 10, marginTop: 2 }]}>
                  {r.stayType === 'DAILY'
                    ? `Rate: ${money(r.dailyRate || r.rent)}/day · ${r.hoursStayed ? `${r.hoursStayed} hrs (${r.daysStayed || 1}d)` : `${r.daysStayed || 1} days`} · In: ${formatDateTime(r.checkInTime) || r.joinedOn}`
                    : `Rent: ${money(r.rent)}/mo · Joined: ${r.joinedOn}`}
                </Text>
              </View>

              {/* Right: Badge + Actions */}
              <View style={resStyles.rightActions}>
                {hasDue ? (
                  <View style={resStyles.pendingBadge}>
                    <Text style={resStyles.pendingBadgeText}>{money(r.due)} due</Text>
                  </View>
                ) : (
                  <View style={resStyles.clearedBadge}>
                    <Text style={resStyles.clearedBadgeText}>Paid up</Text>
                  </View>
                )}

                <View style={resStyles.commButtons}>
                  {r.status === 'CHECKED_OUT' ? (
                    <TouchableOpacity
                      style={[resStyles.actionIconBtn, { backgroundColor: '#dcfce7' }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        setRejoiningResident(r);
                      }}
                    >
                      <Ionicons name="person-add" size={14} color="#16a34a" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[resStyles.actionIconBtn, { backgroundColor: '#eff6ff' }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        setMovingResident(r);
                      }}
                    >
                      <Ionicons name="swap-horizontal" size={14} color="#2563eb" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={resStyles.actionIconBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleCall(r.phone);
                    }}
                  >
                    <Ionicons name="call" size={14} color="#16a34a" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={resStyles.actionIconBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleWhatsApp(r);
                    }}
                  >
                    <Ionicons name="logo-whatsapp" size={14} color="#16a34a" />
                  </TouchableOpacity>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
          </View>

          {totalPages > 1 && (
            <View style={resStyles.paginationRow}>
              <TouchableOpacity
                style={[resStyles.pageBtn, page === 0 && resStyles.pageBtnDisabled]}
                disabled={page === 0}
                onPress={() => setPage((p) => Math.max(0, p - 1))}
              >
                <Ionicons name="chevron-back" size={16} color={page === 0 ? colors.muted : '#1f2328'} />
                <Text style={[resStyles.pageBtnText, page === 0 && resStyles.pageBtnTextDisabled]}>Prev</Text>
              </TouchableOpacity>
              
              <Text style={resStyles.pageInfoText}>
                Page {page + 1} of {totalPages}
              </Text>

              <TouchableOpacity
                style={[resStyles.pageBtn, page >= totalPages - 1 && resStyles.pageBtnDisabled]}
                disabled={page >= totalPages - 1}
                onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                <Text style={[resStyles.pageBtnText, page >= totalPages - 1 && resStyles.pageBtnTextDisabled]}>Next</Text>
                <Ionicons name="chevron-forward" size={16} color={page >= totalPages - 1 ? colors.muted : '#1f2328'} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

      {showAddResident && (
        <AddResidentModal
          visible={showAddResident}
          rooms={rooms}
          onClose={() => setShowAddResident(false)}
          onAdded={() => {
            setShowAddResident(false);
            reload();
          }}
        />
      )}

      {payForResident && (
        <FormModal
          visible={payForResident !== null}
          title={`Record payment - ${payForResident.name}`}
          submitLabel="Record"
          fields={[
            { key: 'amount', label: 'Amount (₹)', keyboard: 'number-pad', initial: payForResident.due > 0 ? String(payForResident.due) : String(payForResident.rent) },
            { key: 'date', label: 'Date', initial: today(), date: true },
          ]}
          onClose={() => setPayForResident(null)}
          onSubmit={async (v) => {
            const amount = parseFloat(v.amount);
            if (!(amount > 0) || !isDate(v.date)) {
              Alert.alert('Invalid', 'Check amount and date.');
              return false;
            }
            if (!(await attempt(() => post('/api/payments', { residentId: payForResident.id, amount, date: v.date })))) return false;
            setPayForResident(null);
            reload();
          }}
        />
      )}

      {movingResident && (
        <MoveResidentModal
          visible={movingResident !== null}
          resident={movingResident}
          rooms={rooms}
          onClose={() => setMovingResident(null)}
          onMoved={() => {
            setMovingResident(null);
            reload();
          }}
        />
      )}

      {rejoiningResident && (
        <RejoinResidentModal
          visible={rejoiningResident !== null}
          resident={rejoiningResident}
          rooms={rooms}
          onClose={() => setRejoiningResident(null)}
          onRejoined={() => {
            setRejoiningResident(null);
            reload();
          }}
        />
      )}
    </Screen>
  );
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Detailed Resident Screen with Month-by-Month billing history and payment management */
function ResidentDetailView({
  resident,
  payments,
  onBack,
  onRecordPayment,
  onMoveRoom,
  onVacateBed,
  onVacateResident,
  onCancelLeaving,
  onRejoin,
  onRemove,
  onCall,
  onWhatsApp,
  onShare,
  refreshing,
  onRefresh,
}: {
  resident: Resident;
  payments: Payment[];
  onBack: () => void;
  /** `amount` pre-fills the form (a single cycle's due); omit for the resident's total due. */
  onRecordPayment: (amount?: number) => void;
  onMoveRoom?: () => void;
  onVacateBed?: () => void;
  onVacateResident?: () => void;
  onCancelLeaving?: () => void;
  onRejoin?: () => void;
  onRemove: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onShare: (period: MonthRecord) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'months' | 'pending' | 'payments' | 'attachments'>('months');
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [picturesOpen, setPicturesOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const chooseAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      const pickedFile = {
        uri: asset.uri,
        name: asset.name || 'attachment.pdf',
        type: asset.mimeType || 'application/pdf',
      };
      uploadAttachment(pickedFile);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not pick file.');
    }
  };

  const uploadAttachment = async (file: PickedFile) => {
    setBusy(true);
    try {
      await upload(`/api/attachments/resident/${resident.id}`, file);
      Alert.alert('Success', 'Attachment uploaded successfully.');
      onRefresh();
    } catch (e) {
      Alert.alert('Upload failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteAttachment = async () => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this attachment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await del(`/api/attachments/resident/${resident.id}`);
            Alert.alert('Success', 'Attachment deleted successfully.');
            onRefresh();
          } catch (e) {
            Alert.alert('Delete failed', e instanceof Error ? e.message : 'Could not delete attachment');
          } finally {
            setBusy(false);
          }
        }
      }
    ]);
  };

  // Generate billing cycles based on resident's joining date to current date
  const generateMonthlyBreakdown = (): MonthRecord[] => {
    const list: MonthRecord[] = [];
    const todayStr = today();
    if (!resident.joinedOn || resident.joinedOn > todayStr) return list;

    const chronological: {
      cycleIndex: number;
      cycleName: string;
      startDate: string;
      endDate: string;
      periodLabel: string;
    }[] = [];

    let cycle = 0;
    while (true) {
      const cycleStart = addMonthsToDate(resident.joinedOn, cycle);
      if (cycleStart > todayStr || cycle > 240) break;

      const nextCycleStart = addMonthsToDate(resident.joinedOn, cycle + 1);
      const cycleEnd = subtractDays(nextCycleStart, 1);

      chronological.push({
        cycleIndex: cycle + 1,
        cycleName: `Cycle ${cycle + 1}`,
        startDate: cycleStart,
        endDate: cycleEnd,
        periodLabel: formatPeriodLabel(cycleStart, cycleEnd),
      });

      cycle++;
    }

    let totalCumulativePaid = resident.paid || 0;
    let runningBilled = 0;

    // Allocate payments FIFO across cycles
    for (let i = 0; i < chronological.length; i++) {
      const item = chronological[i];
      // Latest scheduled rent change that has started by this cycle, else the base rent.
      let monthRent = resident.baseRent ?? resident.rent;
      for (const c of resident.rentChanges ?? []) {
        if (c.effectiveFrom <= item.startDate) monthRent = c.rent;
      }
      const prevBilled = runningBilled;
      runningBilled += monthRent;

      const paidForThisMonth = Math.max(0, Math.min(monthRent, totalCumulativePaid - prevBilled));
      const dueForThisMonth = Math.max(0, monthRent - paidForThisMonth);

      const status: 'PAID' | 'PARTIAL' | 'DUE' =
        dueForThisMonth === 0 ? 'PAID' : paidForThisMonth > 0 ? 'PARTIAL' : 'DUE';

      const monthPayments = payments.filter((p) => p.date && p.date >= item.startDate && p.date <= item.endDate);

      list.push({
        monthKey: item.startDate,
        monthName: item.cycleName,
        periodLabel: item.periodLabel,
        year: Number(item.startDate.split('-')[0]),
        billedDate: item.startDate,
        cycleEndDate: item.endDate,
        rent: monthRent,
        paid: paidForThisMonth,
        due: dueForThisMonth,
        status,
        payments: monthPayments,
      });
    }

    // Return in reverse chronological order (newest cycle first)
    return list.reverse();
  };

  const monthlyRecords = generateMonthlyBreakdown();
  const pendingMonths = monthlyRecords.filter((m) => m.due > 0);
  const paidMonthsCount = monthlyRecords.filter((m) => m.status === 'PAID').length;

  const displayMonths = activeTab === 'pending' ? pendingMonths : monthlyRecords;

  const bedInfo = [
    resident.roomNumber ? `Room ${resident.roomNumber}` : null,
    resident.sectionName && resident.sectionName !== 'Main Room' ? resident.sectionName : null,
    resident.bedNumber ? resident.bedNumber : null,
  ].filter(Boolean).join(' · ');

  const initial = (resident.name || '?')[0].toUpperCase();
  const avBg = avatarBg(resident.name);
  const insets = useSafeAreaInsets();

  return (
    <View style={detailStyles.container}>
      {/* ── Top Header with Safe Area Inset ── */}
      <View style={[detailStyles.headerWrap, { paddingTop: insets.top }]}>
        <View style={detailStyles.header}>
          <TouchableOpacity
            style={detailStyles.backBtn}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={detailStyles.headerTitle}>Resident Details</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {resident.status === 'CHECKED_OUT' ? (
              onRejoin && (
                <TouchableOpacity
                  style={[detailStyles.headerActionBtn, { backgroundColor: '#dcfce7', width: 'auto', paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                  onPress={onRejoin}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person-add" size={16} color="#16a34a" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#16a34a' }}>Re-admit</Text>
                </TouchableOpacity>
              )
            ) : (
              <>
                {onMoveRoom && (
                  <TouchableOpacity
                    style={detailStyles.headerActionBtn}
                    onPress={onMoveRoom}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="swap-horizontal" size={21} color="#2563eb" />
                  </TouchableOpacity>
                )}
                {onVacateResident && (
                  <TouchableOpacity
                    style={detailStyles.headerActionBtn}
                    onPress={onVacateResident}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="log-out-outline" size={21} color="#e11d48" />
                  </TouchableOpacity>
                )}
              </>
            )}
            <TouchableOpacity
              style={detailStyles.headerActionBtn}
              onPress={() => setPicturesOpen(true)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="images-outline" size={20} color="#2563eb" />
            </TouchableOpacity>
            <TouchableOpacity
              style={detailStyles.headerActionBtn}
              onPress={onRemove}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color="#dc2626" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <PicturesSheet
        target={picturesOpen ? { type: 'resident', id: resident.id, title: resident.name } : null}
        onClose={() => setPicturesOpen(false)}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={detailStyles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />}
      >
        {/* ── Profile Box ── */}
        <View style={detailStyles.profileCard}>
          <View style={detailStyles.profileTopRow}>
            <View style={[detailStyles.avatar, { backgroundColor: avBg, overflow: 'hidden' }]}>
              {resident.photoUrl ? (
                <ViewablePhoto uri={resident.photoUrl}>
                  <Image source={{ uri: resident.photoUrl }} style={{ width: '100%', height: '100%' }} />
                </ViewablePhoto>
              ) : (
                <Text style={detailStyles.avatarText}>{initial}</Text>
              )}
            </View>

            <View style={detailStyles.profileCenter}>
              <Text style={detailStyles.customerName}>{resident.name}</Text>
              <View style={detailStyles.subInfoRow}>
                <Ionicons name="bed-outline" size={13} color={colors.muted} />
                <Text style={detailStyles.subInfoText}>{resident.status === 'CHECKED_OUT' ? 'Vacated / Ex-Resident' : (bedInfo || 'No Bed Assigned')}</Text>
                {resident.status !== 'CHECKED_OUT' && onMoveRoom && (
                  <TouchableOpacity
                    style={detailStyles.changeRoomPill}
                    onPress={onMoveRoom}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="swap-horizontal" size={11} color="#2563eb" />
                    <Text style={detailStyles.changeRoomPillText}>Change Room</Text>
                  </TouchableOpacity>
                )}
              </View>
              {resident.phone ? (
                <View style={detailStyles.subInfoRow}>
                  <Ionicons name="call-outline" size={13} color={colors.muted} />
                  <Text style={detailStyles.subInfoText}>{resident.phone}</Text>
                </View>
              ) : null}
            </View>

            {/* 3 mini stat badges top-right */}
            <View style={detailStyles.miniStatsCol}>
              <View style={[detailStyles.miniStat, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="calendar-outline" size={12} color="#2563eb" />
                <Text style={[detailStyles.miniStatVal, { color: "#2563eb" }]}>{monthlyRecords.length}</Text>
                <Text style={detailStyles.miniStatLbl}>Months</Text>
              </View>
              <View style={[detailStyles.miniStat, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                <Text style={[detailStyles.miniStatVal, { color: "#16a34a" }]}>{paidMonthsCount}</Text>
                <Text style={detailStyles.miniStatLbl}>Paid</Text>
              </View>
              <View style={[detailStyles.miniStat, { backgroundColor: '#fef2f2' }]}>
                <Ionicons name="time-outline" size={12} color="#dc2626" />
                <Text style={[detailStyles.miniStatVal, { color: "#dc2626" }]}>{pendingMonths.length}</Text>
                <Text style={detailStyles.miniStatLbl}>Due</Text>
              </View>
            </View>
          </View>

          {/* Tags row */}
          <View style={detailStyles.tagPillRow}>
            {resident.status === 'CHECKED_OUT' ? (
              <View style={[detailStyles.activePill, { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }]}>
                <Text style={[detailStyles.activePillText, { color: '#475569' }]}>Checked Out: {resident.checkOutDate || '—'}</Text>
              </View>
            ) : resident.stayType === 'DAILY' ? (
              <View style={[detailStyles.activePill, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                <Text style={[detailStyles.activePillText, { color: '#d97706' }]}>Daily Stay</Text>
              </View>
            ) : (
              <View style={detailStyles.activePill}>
                <Text style={detailStyles.activePillText}>Monthly Resident</Text>
              </View>
            )}
            {resident.status !== 'CHECKED_OUT' && resident.noticeStatus === 'APPROVED' && resident.vacateOn ? (
              <TouchableOpacity
                style={[detailStyles.activePill, { backgroundColor: '#fef2f2', borderColor: '#fecaca', flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                onPress={onCancelLeaving}
                disabled={!onCancelLeaving}
                activeOpacity={0.7}
              >
                <Ionicons name="exit-outline" size={12} color="#dc2626" />
                <Text style={[detailStyles.activePillText, { color: '#dc2626' }]}>Getting vacated: {resident.vacateOn}</Text>
                {onCancelLeaving && <Ionicons name="close-circle" size={13} color="#dc2626" />}
              </TouchableOpacity>
            ) : null}
            <View style={detailStyles.sincePill}>
              <Ionicons name="calendar" size={11} color="#16a34a" />
              <Text style={detailStyles.sincePillText}>
                {resident.stayType === 'DAILY'
                  ? ` Check-in: ${formatDateTime(resident.checkInTime) || resident.joinedOn}`
                  : ` Joined: ${resident.joinedOn}`}
              </Text>
            </View>
            <View style={[detailStyles.sincePill, { backgroundColor: '#eff6ff', borderColor: '#dbeafe' }]}>
              <Ionicons name="cash-outline" size={11} color="#2563eb" />
              <Text style={[detailStyles.sincePillText, { color: '#2563eb' }]}>
                {resident.stayType === 'DAILY'
                  ? ` ${money(resident.dailyRate || resident.rent)}/day (${resident.hoursStayed ? `${resident.hoursStayed} hrs` : `${resident.daysStayed || 1} days`})`
                  : ` ${money(resident.rent)}/mo`}
              </Text>
            </View>
            {resident.stayType !== 'DAILY' &&
              (resident.rentChanges ?? [])
                .filter((c) => c.effectiveFrom > today())
                .map((c) => (
                  <View key={c.effectiveFrom} style={[detailStyles.sincePill, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                    <Ionicons name="trending-up-outline" size={11} color="#b45309" />
                    <Text style={[detailStyles.sincePillText, { color: '#b45309' }]}>
                      {` ${money(c.rent)}/mo from ${c.effectiveFrom}`}
                    </Text>
                  </View>
                ))}
          </View>

          {/* ── Billing Summary — 3 Amount Cards ── */}
          <View style={detailStyles.billingRow}>
            <View style={[detailStyles.billingCard, detailStyles.billingTotalCard]}>
              <View style={[detailStyles.billingIconWrap, detailStyles.billingTotalIcon]}>
                <Ionicons name="receipt-outline" size={16} color="#15803d" />
              </View>
              <Text style={detailStyles.billingCardLbl}>Total Billed</Text>
              <Text style={[detailStyles.billingCardVal, { color: '#15803d' }]} numberOfLines={1}>
                {money(resident.billed)}
              </Text>
            </View>

            <View style={[detailStyles.billingCard, detailStyles.billingPaidCard]}>
              <View style={[detailStyles.billingIconWrap, detailStyles.billingPaidIcon]}>
                <Ionicons name="wallet-outline" size={16} color="#2563eb" />
              </View>
              <Text style={detailStyles.billingCardLbl}>Paid</Text>
              <Text style={[detailStyles.billingCardVal, { color: '#2563eb' }]} numberOfLines={1}>
                {money(resident.paid)}
              </Text>
            </View>

            <View style={[detailStyles.billingCard, detailStyles.billingDueCard]}>
              <View style={[detailStyles.billingIconWrap, detailStyles.billingDueIcon]}>
                <Ionicons name="cash-outline" size={16} color="#c2410c" />
              </View>
              <Text style={detailStyles.billingCardLbl}>Outstanding</Text>
              <Text style={[detailStyles.billingCardVal, { color: '#c2410c' }]} numberOfLines={1}>
                {money(resident.due)}
              </Text>
            </View>
          </View>

          {/* ── Security Deposit Collected ── */}
          <View style={detailStyles.depositCard}>
            <View style={detailStyles.depositIconWrap}>
              <Ionicons name="shield-checkmark" size={18} color="#0f766e" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={detailStyles.depositLabel}>Security Deposit Collected</Text>
              <Text style={detailStyles.depositValue}>
                {money(resident.securityDeposit || 0)}
              </Text>
            </View>
            <View
              style={[
                detailStyles.depositBadge,
                {
                  backgroundColor:
                    (resident.securityDeposit || 0) > 0 ? '#ccfbf1' : '#f1f5f9',
                },
              ]}
            >
              <Text
                style={[
                  detailStyles.depositBadgeText,
                  {
                    color:
                      (resident.securityDeposit || 0) > 0 ? '#0f766e' : '#64748b',
                  },
                ]}
              >
                {(resident.securityDeposit || 0) > 0 ? 'Refundable Deposit' : 'No Deposit'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Segmented Control Bar ── */}
        <View style={detailStyles.segmentedRow}>
          {resident.stayType === 'DAILY' ? (
            <TouchableOpacity
              style={[detailStyles.segmentBtn, activeTab === 'months' && detailStyles.segmentBtnActive]}
              onPress={() => setActiveTab('months')}
            >
              <Ionicons name="calendar" size={14} color={activeTab === 'months' ? '#ffffff' : colors.muted} />
              <Text style={[detailStyles.segmentBtnText, activeTab === 'months' && detailStyles.segmentBtnTextActive]}>
                Summary
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[detailStyles.segmentBtn, activeTab === 'months' && detailStyles.segmentBtnActive]}
                onPress={() => setActiveTab('months')}
              >
                <Ionicons name="calendar" size={13} color={activeTab === 'months' ? '#ffffff' : colors.muted} />
                <Text style={[detailStyles.segmentBtnText, activeTab === 'months' && detailStyles.segmentBtnTextActive]}>
                  Months ({monthlyRecords.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[detailStyles.segmentBtn, activeTab === 'pending' && detailStyles.segmentBtnActive]}
                onPress={() => setActiveTab('pending')}
              >
                <Ionicons name="time-outline" size={13} color={activeTab === 'pending' ? '#ffffff' : colors.muted} />
                <Text style={[detailStyles.segmentBtnText, activeTab === 'pending' && detailStyles.segmentBtnTextActive]}>
                  Pending ({pendingMonths.length})
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[detailStyles.segmentBtn, activeTab === 'payments' && detailStyles.segmentBtnActive]}
            onPress={() => setActiveTab('payments')}
          >
            <Ionicons name="card-outline" size={13} color={activeTab === 'payments' ? '#ffffff' : colors.muted} />
            <Text style={[detailStyles.segmentBtnText, activeTab === 'payments' && detailStyles.segmentBtnTextActive]}>
              Payments ({payments.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[detailStyles.segmentBtn, activeTab === 'attachments' && detailStyles.segmentBtnActive, { flex: 0.5 }]}
            onPress={() => setActiveTab('attachments')}
          >
            <Ionicons name="attach" size={18} color={activeTab === 'attachments' ? '#ffffff' : colors.muted} />
          </TouchableOpacity>
        </View>

        {/* ── DAILY STAY SUMMARY VIEW ── */}
        {resident.stayType === 'DAILY' && activeTab === 'months' && (
          <View style={detailStyles.monthItemCard}>
            <View style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Exact Day Stay Calculation</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                    {formatDateTime(resident.checkInTime) || resident.joinedOn} → {resident.checkOutTime ? formatDateTime(resident.checkOutTime) : (resident.checkOutDate || 'Ongoing (Active)')}
                  </Text>
                </View>
                <View style={[detailStyles.paidPill, resident.due > 0 ? { backgroundColor: '#fee2e2' } : { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[detailStyles.paidPillText, resident.due > 0 ? { color: '#dc2626' } : { color: '#16a34a' }]}>
                    {resident.due > 0 ? `${money(resident.due)} due` : 'Paid up'}
                  </Text>
                </View>
              </View>

              <View style={detailStyles.detailRow}>
                <Text style={detailStyles.detailLabel}>Stay Type</Text>
                <Text style={[detailStyles.detailValue, { color: '#d97706', fontWeight: '700' }]}>Day-wise Stay</Text>
              </View>
              <View style={detailStyles.detailRow}>
                <Text style={detailStyles.detailLabel}>Check-in Date & Time</Text>
                <Text style={detailStyles.detailValue}>{formatDateTime(resident.checkInTime) || resident.joinedOn}</Text>
              </View>
              <View style={detailStyles.detailRow}>
                <Text style={detailStyles.detailLabel}>Check-out Date & Time</Text>
                <Text style={detailStyles.detailValue}>{resident.checkOutTime ? formatDateTime(resident.checkOutTime) : (resident.checkOutDate || 'Ongoing (Active)')}</Text>
              </View>
              <View style={detailStyles.detailRow}>
                <Text style={detailStyles.detailLabel}>Exact Duration Stayed</Text>
                <Text style={[detailStyles.detailValue, { fontWeight: '800', color: '#0f172a' }]}>
                  {resident.hoursStayed ? `${resident.hoursStayed} hours (${resident.daysStayed || 1} billed 24h cycles)` : `${resident.daysStayed || 1} days`}
                </Text>
              </View>
              <View style={detailStyles.detailRow}>
                <Text style={detailStyles.detailLabel}>Configured Daily Rate</Text>
                <Text style={detailStyles.detailValue}>{money(resident.dailyRate || resident.rent)} / day</Text>
              </View>
              <View style={detailStyles.detailRow}>
                <Text style={detailStyles.detailLabel}>Security Deposit</Text>
                <Text style={[detailStyles.detailValue, { color: '#0f766e', fontWeight: '700' }]}>
                  {money(resident.securityDeposit || 0)}
                </Text>
              </View>
              <View style={detailStyles.detailRow}>
                <Text style={detailStyles.detailLabel}>Total Billed Amount</Text>
                <Text style={[detailStyles.detailValue, { color: '#0f172a', fontWeight: '800' }]}>
                  {resident.daysStayed || 1} days × {money(resident.dailyRate || resident.rent)} = {money(resident.billed)}
                </Text>
              </View>
              <View style={detailStyles.detailRow}>
                <Text style={detailStyles.detailLabel}>Total Paid</Text>
                <Text style={[detailStyles.detailValue, { color: '#16a34a', fontWeight: '700' }]}>{money(resident.paid)}</Text>
              </View>
              <View style={detailStyles.detailRow}>
                <Text style={detailStyles.detailLabel}>Outstanding Due</Text>
                <Text style={[detailStyles.detailValue, { color: resident.due > 0 ? '#dc2626' : '#16a34a', fontWeight: '800' }]}>
                  {money(resident.due)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── TAB 1 & 2: MONTH-BY-MONTH BREAKDOWN (For Monthly residents) ── */}
        {resident.stayType !== 'DAILY' && (activeTab === 'months' || activeTab === 'pending') && (
          <View style={{ gap: 8 }}>
            <View style={detailStyles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time" size={16} color="#16a34a" />
                <Text style={detailStyles.sectionHeaderTitle}>
                  {activeTab === 'pending' ? 'Pending Rent Dues' : 'Monthly Rent Breakdown'}
                </Text>
              </View>
              <Text style={detailStyles.ordersCountText}>{displayMonths.length} months</Text>
            </View>

            {displayMonths.length === 0 && (
              <View style={detailStyles.emptyBox}>
                <Ionicons name="checkmark-circle-outline" size={36} color="#16a34a" />
                <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>No pending dues. All caught up!</Text>
              </View>
            )}

            {displayMonths.map((mItem) => {
              const isExpanded = expandedMonth === mItem.monthKey;
              const isPaid = mItem.status === 'PAID';
              const isDue = mItem.status === 'DUE';

              return (
                <View key={mItem.monthKey} style={detailStyles.monthItemCard}>
                  <TouchableOpacity
                    style={detailStyles.monthCardHeader}
                    activeOpacity={0.8}
                    onPress={() => setExpandedMonth(isExpanded ? null : mItem.monthKey)}
                  >
                    {/* Left: Month cycle and period */}
                    <View style={detailStyles.orderColLeft}>
                      <Text style={detailStyles.monthTitleText}>{mItem.periodLabel}</Text>
                      <Text style={detailStyles.monthYearText}>{mItem.monthName} (Due {mItem.billedDate})</Text>
                    </View>

                    {/* Center: Rent rate and details */}
                    <View style={detailStyles.orderColCenter}>
                      <Text style={detailStyles.orderCropTitle}>Rent</Text>
                      <Text style={detailStyles.orderAcresText}>{money(mItem.rent)}</Text>
                    </View>

                    {/* Right: Paid / Due status pill */}
                    <View style={detailStyles.orderColRight}>
                      <Text style={detailStyles.orderTotalText}>{money(mItem.rent)}</Text>
                      {isPaid ? (
                        <View style={detailStyles.paidPill}>
                          <Text style={detailStyles.paidPillText}>Paid</Text>
                        </View>
                      ) : (
                        <View style={[detailStyles.pendingPill, isDue ? { backgroundColor: '#fee2e2' } : { backgroundColor: '#ffedd5' }]}>
                          <Text style={[detailStyles.pendingPillText, isDue ? { color: '#dc2626' } : { color: '#ea580c' }]}>
                            {money(mItem.due)} due
                          </Text>
                        </View>
                      )}
                    </View>

                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.muted}
                      style={{ marginLeft: 6 }}
                    />
                  </TouchableOpacity>

                  {/* Expanded Breakdown */}
                  {isExpanded && (
                    <View style={detailStyles.expandedDetail}>
                      <View style={detailStyles.detailRow}>
                        <Text style={detailStyles.detailLabel}>Billing Period</Text>
                        <Text style={detailStyles.detailValue}>{mItem.periodLabel}</Text>
                      </View>
                      <View style={detailStyles.detailRow}>
                        <Text style={detailStyles.detailLabel}>Cycle Start / Due Date</Text>
                        <Text style={detailStyles.detailValue}>{mItem.billedDate}</Text>
                      </View>
                      <View style={detailStyles.detailRow}>
                        <Text style={detailStyles.detailLabel}>Monthly Rent Charge</Text>
                        <Text style={detailStyles.detailValue}>{money(mItem.rent)}</Text>
                      </View>
                      <View style={detailStyles.detailRow}>
                        <Text style={detailStyles.detailLabel}>Paid for this Period</Text>
                        <Text style={[detailStyles.detailValue, { color: '#16a34a' }]}>{money(mItem.paid)}</Text>
                      </View>
                      <View style={detailStyles.detailRow}>
                        <Text style={detailStyles.detailLabel}>Remaining Due</Text>
                        <Text style={[detailStyles.detailValue, { color: mItem.due > 0 ? '#dc2626' : '#16a34a', fontWeight: '800' }]}>
                          {money(mItem.due)}
                        </Text>
                      </View>

                      {mItem.payments.length > 0 && (
                        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 4 }}>
                            Payments in this Period:
                          </Text>
                          {mItem.payments.map((p) => (
                            <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                              <Text style={{ fontSize: 11, color: colors.muted }}>{p.date}</Text>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#16a34a' }}>+{money(p.amount)}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      <View style={detailStyles.detailFooter}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {mItem.due > 0 && (
                            <TouchableOpacity
                              style={detailStyles.collectBtn}
                              onPress={() => onRecordPayment(mItem.due)}
                            >
                              <Text style={detailStyles.collectBtnText}>Collect Payment</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[detailStyles.collectBtn, { backgroundColor: '#2563eb' }]}
                            onPress={() => onShare(mItem)}
                          >
                            <Text style={detailStyles.collectBtnText}>Share Statement</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── TAB 3: PAYMENTS HISTORY ── */}
        {activeTab === 'payments' && (
          <View style={{ gap: 8 }}>
            <View style={detailStyles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="card" size={16} color="#2563eb" />
                <Text style={detailStyles.sectionHeaderTitle}>Payment Receipts</Text>
              </View>
              <Text style={detailStyles.ordersCountText}>{payments.length} transactions</Text>
            </View>

            {payments.length === 0 && (
              <View style={detailStyles.emptyBox}>
                <Ionicons name="receipt-outline" size={36} color={colors.muted} />
                <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>No payments recorded yet.</Text>
              </View>
            )}

            {payments.map((p) => (
              <View key={p.id} style={detailStyles.paymentReceiptCard}>
                <View style={detailStyles.receiptIconBox}>
                  <Ionicons name="checkmark-done-circle" size={20} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={detailStyles.receiptTitle}>Payment Receipt #{p.id}</Text>
                  <Text style={detailStyles.receiptDate}>{p.date}</Text>
                </View>
                <Text style={detailStyles.receiptAmount}>+{money(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── TAB 4: ATTACHMENTS ── */}
        {activeTab === 'attachments' && (
          <View style={{ gap: 8 }}>
            <View style={detailStyles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="document-text" size={16} color="#2563eb" />
                <Text style={detailStyles.sectionHeaderTitle}>Rental Agreement & Documents</Text>
              </View>
            </View>

            {busy ? (
              <View style={detailStyles.emptyBox}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={{ fontSize: 13, color: colors.muted, marginTop: 8 }}>Processing file...</Text>
              </View>
            ) : resident.attachmentUrl ? (
              <Card style={{ padding: 16, backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="file-tray-full" size={24} color="#2563eb" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>Rental Agreement</Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Uploaded document / contract</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                  <TouchableOpacity
                    style={[detailStyles.bottomSecBtn, { flex: 1, height: 38, borderColor: '#cbd5e1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }]}
                    onPress={() => resident.attachmentUrl && Linking.openURL(resident.attachmentUrl)}
                  >
                    <Ionicons name="eye" size={16} color="#0f172a" />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#0f172a' }}>View File</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[detailStyles.bottomSecBtn, { flex: 1, height: 38, borderColor: colors.bad, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }]}
                    onPress={deleteAttachment}
                  >
                    <Ionicons name="trash" size={16} color={colors.bad} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.bad }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : (
              <View style={detailStyles.emptyBox}>
                <Ionicons name="document-attach-outline" size={40} color={colors.muted} />
                <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6, textAlign: 'center' }}>
                  No agreements or files attached yet.
                </Text>
                <TouchableOpacity
                  style={{
                    marginTop: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#eff6ff',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: '#bfdbfe'
                  }}
                  onPress={chooseAttachment}
                >
                  <Ionicons name="cloud-upload" size={16} color="#2563eb" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563eb' }}>Upload Document</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Fixed Bottom Actions Bar ── */}
      <View style={detailStyles.bottomBar}>
        <TouchableOpacity style={detailStyles.bottomSecBtn} onPress={onCall} activeOpacity={0.8}>
          <Ionicons name="call" size={17} color="#16a34a" />
          <Text style={detailStyles.bottomSecBtnText}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity style={detailStyles.bottomSecBtn} onPress={onWhatsApp} activeOpacity={0.8}>
          <Ionicons name="logo-whatsapp" size={17} color="#16a34a" />
          <Text style={detailStyles.bottomSecBtnText}>WhatsApp</Text>
        </TouchableOpacity>

        {resident.due > 0 && (
          <TouchableOpacity style={detailStyles.bottomPrimBtn} onPress={() => onRecordPayment()} activeOpacity={0.85}>
            <Ionicons name="cash-outline" size={18} color="#ffffff" />
            <Text style={detailStyles.bottomPrimBtnText}>Record Payment</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const resStyles = StyleSheet.create({
  topHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 8,
  },
  headingTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  headingSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  addResidentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b873f',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addResidentBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  kpiBox: {
    flex: 1,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
  },
  kpiIconWrap: { marginBottom: 4 },
  kpiVal: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  kpiLbl: { fontSize: 9, color: colors.muted, fontWeight: '500' },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a', paddingVertical: 0 },
  filterTuneBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  filterTabsList: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#16a34a',
    fontWeight: '700',
  },
  residentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  locationText: { fontSize: 11, color: colors.muted },
  rightActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  pendingBadge: {
    backgroundColor: '#fff7ed',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: '#ea580c' },
  clearedBadge: {
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  clearedBadgeText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  commButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionBtn: {
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
  smallActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 4,
  },
  pageBtnDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  pageBtnTextDisabled: {
    color: colors.muted,
  },
  pageInfoText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
});

const detailStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerWrap: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 52,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  headerActionBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 90,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  profileCenter: { flex: 1 },
  customerName: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  subInfoRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  subInfoText: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  changeRoomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
    gap: 3,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  changeRoomPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  vacateBedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
    gap: 3,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  vacateBedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e11d48',
  },
  miniStatsCol: {
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-end',
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 70,
  },
  miniStatVal: { fontSize: 12, fontWeight: '800' },
  miniStatLbl: { fontSize: 9, color: colors.muted, fontWeight: '600' },
  tagPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  activePill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
  },
  activePillText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  sincePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  sincePillText: { fontSize: 11, fontWeight: '600', color: '#16a34a' },
  billingRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  billingCard: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  billingTotalCard: { backgroundColor: '#f0fdf4', borderColor: '#d1fae5' },
  billingPaidCard: { backgroundColor: '#eff6ff', borderColor: '#dbeafe' },
  billingDueCard: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  billingIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  billingTotalIcon: { backgroundColor: '#dcfce7' },
  billingPaidIcon: { backgroundColor: '#dbeafe' },
  billingDueIcon: { backgroundColor: '#ffedd5' },
  billingCardLbl: { fontSize: 9, color: '#64748b', fontWeight: '600', marginBottom: 2 },
  billingCardVal: { fontSize: 12, fontWeight: '800' },
  depositCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    gap: 10,
  },
  depositIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositLabel: {
    fontSize: 11,
    color: '#0f766e',
    fontWeight: '600',
  },
  depositValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f766e',
    marginTop: 1,
  },
  depositBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  depositBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f766e',
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  segmentBtnActive: {
    backgroundColor: '#1b873f',
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionHeaderTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  ordersCountText: { fontSize: 11, color: colors.muted, fontWeight: '500' },
  monthItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  monthCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  orderColLeft: { flex: 1.4 },
  monthTitleText: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  monthYearText: { fontSize: 10, color: colors.muted, marginTop: 2 },
  orderColCenter: { width: 75, paddingHorizontal: 4 },
  orderCropTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  orderAcresText: { fontSize: 10, color: colors.muted, marginTop: 2 },
  orderColRight: { alignItems: 'flex-end', gap: 2 },
  orderTotalText: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  paidPill: {
    backgroundColor: '#f0fdf4',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
  },
  paidPillText: { fontSize: 9, fontWeight: '700', color: '#16a34a' },
  pendingPill: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
  },
  pendingPillText: { fontSize: 9, fontWeight: '700' },
  expandedDetail: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 12, color: colors.muted },
  detailValue: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  detailFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  collectBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  collectBtnText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  paymentReceiptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  receiptIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  receiptDate: { fontSize: 11, color: colors.muted, marginTop: 1 },
  receiptAmount: { fontSize: 14, fontWeight: '800', color: '#16a34a' },
  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  bottomSecBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#dcfce7',
    borderRadius: 10,
    height: 44,
    gap: 6,
  },
  bottomSecBtnText: { fontSize: 13, fontWeight: '700', color: '#16a34a' },
  bottomPrimBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1b873f',
    borderRadius: 10,
    height: 44,
    gap: 6,
  },
  bottomPrimBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
});

const compactLabel = { marginTop: 8, marginBottom: 4 } as const;

// Treat the common backend availability labels consistently.
const isVacantBed = (bed: Bed): boolean => {
  const status = String(bed.status ?? '').trim().toUpperCase().replace(/[ -]+/g, '_');
  return ['VACANT', 'AVAILABLE', 'FREE', 'UNOCCUPIED', 'EMPTY'].includes(status);
};

function Choice({
  label,
  sub,
  on,
  disabled,
  tone = 'neutral',
  onPress,
}: {
  label: string;
  sub?: string;
  on: boolean;
  disabled?: boolean;
  tone?: 'good' | 'bad' | 'neutral';
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[addStyles.choice, on && addStyles.choiceOn, disabled && addStyles.choiceOff]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled: !!disabled }}
    >
      <Text style={[addStyles.choiceLabel, on && addStyles.choiceLabelOn]} numberOfLines={1}>{label}</Text>
      {sub ? (
        <Text
          style={[
            addStyles.choiceSub,
            tone === 'good' && { color: '#15803d' },
            tone === 'bad' && { color: '#dc2626' },
            on && { color: '#dbeafe' },
          ]}
          numberOfLines={1}
        >
          {sub}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const addStyles = StyleSheet.create({
  sheet: { maxHeight: '92%', minHeight: 0, paddingHorizontal: 0, paddingBottom: 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8 },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 4 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' },
  progressOn: { backgroundColor: '#1b873f' },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: 16, paddingBottom: 12 },

  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 12, marginBottom: 6 },
  hint: { fontSize: 11, color: colors.muted, marginTop: 6 },
  warn: { fontSize: 12, fontWeight: '600', color: '#dc2626' },
  row: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  twoCol: { flexDirection: 'row', gap: 10 },

  // selectable options: same look as the filter pills on the list (soft green when selected)
  choice: {
    minWidth: 64,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOn: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  choiceOff: { opacity: 0.45 },
  choiceLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  choiceLabelOn: { color: '#15803d' },
  choiceSub: { fontSize: 10, fontWeight: '600', color: '#64748b', marginTop: 1 },

  roomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  roomPillText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#15803d' },
  roomPillLink: { fontSize: 12, fontWeight: '700', color: '#1b873f' },

  // same segmented control as the resident detail tabs: white track, solid green when active
  seg: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segBtnOn: { backgroundColor: '#1b873f' },
  segText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  segTextOn: { color: '#ffffff', fontWeight: '700' },

  note: { fontSize: 11, color: colors.muted, marginTop: 4 },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  summary: { fontSize: 12, color: '#475569', fontWeight: '600' },
  footerRow: { flexDirection: 'row', gap: 10 },
  backBtn: {
    flex: 0.8,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  primary: { marginTop: 0 },
});

export function AddResidentModal({
  visible,
  rooms,
  initialRequest,
  onClose,
  onAdded,
}: {
  visible: boolean;
  rooms: Room[];
  initialRequest?: BookingRequest | null;
  onClose: () => void;
  onAdded: () => void;
}) {
    const insets = useSafeAreaInsets();   // ← add this line

  // 1. Build floor list with statistics
  const floorOptions = useMemo(() => {
    const map = new Map<string, { totalRooms: number; vacantBeds: number }>();
    for (const r of rooms) {
      const f = r.floorName?.trim() || 'Ground Floor';
      const entry = map.get(f) || { totalRooms: 0, vacantBeds: 0 };
      entry.totalRooms += 1;
      entry.vacantBeds += r.vacant || 0;
      map.set(f, entry);
    }
    const entries = Array.from(map.entries());
    if (entries.length === 0) {
      return [{ floorName: 'Ground Floor', totalRooms: 0, vacantBeds: 0 }];
    }
    return entries.map(([floorName, stats]) => ({
      floorName,
      totalRooms: stats.totalRooms,
      vacantBeds: stats.vacantBeds,
    }));
  }, [rooms]);

  const requestedRoom = useMemo(() => {
    if (!initialRequest?.roomId) return null;
    return rooms.find((r) => r.id === initialRequest.roomId) || null;
  }, [rooms, initialRequest]);

  // Default to floor of requested room or floor with vacant beds or first floor
  const initialFloor = useMemo(() => {
    if (requestedRoom) {
      return requestedRoom.floorName?.trim() || 'Ground Floor';
    }
    const openFloor = floorOptions.find((f) => f.vacantBeds > 0);
    return openFloor ? openFloor.floorName : (floorOptions[0]?.floorName || 'Ground Floor');
  }, [floorOptions, requestedRoom]);

  const [selectedFloor, setSelectedFloor] = useState<string>(initialFloor);
  const [openDropdown, setOpenDropdown] = useState<'floor' | 'room' | 'section' | null>(null);

  // Filter rooms for selected floor
  const roomsOnFloor = useMemo(() => {
    return rooms.filter((r) => {
      const f = r.floorName?.trim() || 'Ground Floor';
      return f === selectedFloor;
    });
  }, [rooms, selectedFloor]);

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(() => {
    if (requestedRoom) return requestedRoom.id;
    const firstVacant = roomsOnFloor.find((r) => r.vacant > 0);
    return firstVacant ? firstVacant.id : (roomsOnFloor[0]?.id ?? null);
  });

  // Re-sync room if floor changed
  useEffect(() => {
    if (!roomsOnFloor.some((r) => r.id === selectedRoomId)) {
      const firstVacant = roomsOnFloor.find((r) => r.vacant > 0);
      setSelectedRoomId(firstVacant ? firstVacant.id : (roomsOnFloor[0]?.id ?? null));
    }
  }, [selectedFloor, roomsOnFloor, selectedRoomId]);

  const currentRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  // Only sections in selected room that have vacant beds
  const availableSections = useMemo(() => {
    if (!currentRoom?.sections) return [];
    return currentRoom.sections.filter((sec) => {
      if (sec.beds && sec.beds.length > 0) {
        return sec.beds.some((b) => isVacantBed(b));
      }
      return true;
    });
  }, [currentRoom]);

  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(() => {
    if (initialRequest?.sectionId) {
      const match = availableSections.find((s) => s.id === initialRequest.sectionId);
      if (match) return match.id;
    }
    return availableSections[0]?.id ?? null;
  });

  // Re-sync section if room changed
  useEffect(() => {
    if (availableSections.length > 0) {
      if (!availableSections.some((s) => s.id === selectedSectionId)) {
        setSelectedSectionId(availableSections[0].id);
      }
    } else {
      setSelectedSectionId(null);
    }
  }, [availableSections, selectedSectionId]);

  const currentSection = useMemo(() => {
    if (availableSections.length === 0) return null;
    return availableSections.find((s) => s.id === selectedSectionId) || availableSections[0] || null;
  }, [availableSections, selectedSectionId]);

  // Vacant beds in the selected section (or in room if no sections)
  const vacantBeds = useMemo(() => {
    if (!currentRoom) return [];
    if (currentSection && currentSection.beds) {
      return currentSection.beds
        .filter((b) => isVacantBed(b))
        .map((b) => ({
          bed: b,
          sectionName: currentSection.sectionName,
          rent: b.rent || currentSection.rentPerBed || currentRoom.rent,
        }));
    }
    const list: { bed: Bed; sectionName: string; rent: number }[] = [];
    if (currentRoom.sections) {
      for (const sec of currentRoom.sections) {
        if (sec.beds) {
          for (const b of sec.beds) {
            if (isVacantBed(b)) {
              list.push({
                bed: b,
                sectionName: sec.sectionName,
                rent: b.rent || sec.rentPerBed || currentRoom.rent,
              });
            }
          }
        }
      }
    }
    return list;
  }, [currentRoom, currentSection]);

  const [selectedBedId, setSelectedBedId] = useState<number | null>(initialRequest?.bedId ?? null);
  const [stayType, setStayType] = useState<StayType>('MONTHLY');
  const [name, setName] = useState(initialRequest?.name ?? '');
  const [phone, setPhone] = useState(initialRequest?.mobile ?? '');
  const [aadhaar, setAadhaar] = useState('');
  const [joinedOn, setJoinedOn] = useState(initialRequest?.expectedJoinDate || today());
  const [checkInTime, setCheckInTime] = useState(nowDateTime().replace('T', ' '));
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [rent, setRent] = useState(initialRequest?.rent ? String(initialRequest.rent) : '');
  const [securityDeposit, setSecurityDeposit] = useState(
    initialRequest?.deposit !== undefined && initialRequest?.deposit !== null ? String(initialRequest.deposit) : ''
  );
  const [dailyRate, setDailyRate] = useState('');
  const [photo, setPhoto] = useState<PickedFile[]>([]);
  const [idCard, setIdCard] = useState<PickedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (visible) setStep(1);
  }, [visible]);

  // Sync pricing defaults when section or room changes (unless initialRequest had explicit values)
  useEffect(() => {
    if (!initialRequest) {
      if (currentSection && currentSection.rentPerBed > 0) {
        setRent(String(currentSection.rentPerBed));
      } else if (currentRoom && currentRoom.rent > 0) {
        setRent(String(currentRoom.rent));
      }
      if (currentSection && currentSection.depositPerBed !== undefined && currentSection.depositPerBed !== null) {
        setSecurityDeposit(String(currentSection.depositPerBed));
      } else if (currentRoom?.sharingOptions?.[0]?.depositPerBed !== undefined && currentRoom?.sharingOptions?.[0]?.depositPerBed !== null) {
        setSecurityDeposit(String(currentRoom.sharingOptions[0].depositPerBed));
      } else {
        setSecurityDeposit('0');
      }
      if (currentRoom) {
        setDailyRate(
          currentRoom.dailyRent
            ? String(currentRoom.dailyRent)
            : String(Math.round((currentSection?.rentPerBed || currentRoom.rent || 6000) / 30) || 300)
        );
      }
      setSelectedBedId(null);
    }
  }, [currentSection, currentRoom, initialRequest]);

  const handleSelectBed = (bedItem: { bed: Bed; rent: number }) => {
    setSelectedBedId(bedItem.bed.id);
    if (bedItem.rent > 0) {
      setRent(String(bedItem.rent));
    }
  };

  const submit = async () => {
    if (!currentRoom) {
      Alert.alert('Missing Room', 'Please select a floor and room.');
      return;
    }
    if (currentRoom.vacant <= 0) {
      Alert.alert('Room Full', `Room ${currentRoom.number} is completely full. Please choose another room.`);
      return;
    }
    if (currentRoom.sections && currentRoom.sections.length > 0 && availableSections.length === 0) {
      Alert.alert('All Sections Full', `All sections in Room ${currentRoom.number} are occupied. Please select another room.`);
      return;
    }
    if (
      vacantBeds.length === 0 &&
      ((currentSection && currentSection.beds && currentSection.beds.length > 0) ||
        (currentRoom.sections && currentRoom.sections.length > 0))
    ) {
      Alert.alert('No Vacant Beds', 'The selected section or room has no vacant beds available.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Missing Field', 'Please enter resident name.');
      return;
    }
    if (stayType === 'DAILY') {
      const cleanIn = checkInTime.trim();
      if (!isDate(cleanIn) && !isDateTime(cleanIn)) {
        Alert.alert('Invalid Check-in Time', 'Check-in time must be formatted as YYYY-MM-DD or YYYY-MM-DD HH:mm.');
        return;
      }
      if (checkOutTime.trim() && !isDate(checkOutTime.trim()) && !isDateTime(checkOutTime.trim())) {
        Alert.alert('Invalid Check-out Time', 'Check-out time must be formatted as YYYY-MM-DD or YYYY-MM-DD HH:mm.');
        return;
      }
    } else {
      if (!isDate(joinedOn)) {
        Alert.alert('Invalid Date', 'Check-in date must be YYYY-MM-DD.');
        return;
      }
    }
    const cleanPhone = phone.trim();
    if (!/^\d{10,15}$/.test(cleanPhone)) {
      Alert.alert('Mobile number required', 'Please enter a valid 10-15 digit mobile number. It is the resident\'s login.');
      return;
    }
    const cleanAadhaar = aadhaar.replace(/\s/g, '');
    if (!/^\d{12}$/.test(cleanAadhaar)) {
      Alert.alert('Aadhaar number required', 'Please enter the 12-digit Aadhaar number. Its last 4 digits are the first password.');
      return;
    }

    let dailyRateVal: number | undefined = undefined;
    let rentAmount = parseFloat(rent);
    if (stayType === 'DAILY') {
      const parsedDaily = parseFloat(dailyRate);
      if (!(parsedDaily > 0)) {
        Alert.alert('Invalid Daily Rate', 'Please enter a valid amount per day.');
        return;
      }
      dailyRateVal = parsedDaily;
      rentAmount = parsedDaily;
    } else {
      if (!(rentAmount >= 0)) {
        Alert.alert('Invalid Rent', 'Please enter a valid monthly rent amount.');
        return;
      }
    }

    const finalBedId = selectedBedId || (vacantBeds.length > 0 ? vacantBeds[0].bed.id : null);

    setBusy(true);
    try {
      const cleanCheckInIso = stayType === 'DAILY' ? checkInTime.trim().replace(' ', 'T') : null;
      const cleanCheckOutIso = stayType === 'DAILY' && checkOutTime.trim() ? checkOutTime.trim().replace(' ', 'T') : null;
      const finalJoinedOn = stayType === 'DAILY' ? cleanCheckInIso!.slice(0, 10) : joinedOn;

      let created: { id: number } | null = null;
      const ok = await attempt(async () => {
        created = await (initialRequest
          ? post<{ id: number }>(`/api/booking-requests/${initialRequest.id}/approve`, {
              name: name.trim(),
              phone: cleanPhone,
              aadhaar: cleanAadhaar,
              roomId: currentRoom.id,
              sectionId: currentSection?.id ?? null,
              bedId: finalBedId,
              rent: rentAmount,
              securityDeposit: parseFloat(securityDeposit) || 0,
              joinedOn: finalJoinedOn,
            })
          : post<{ id: number }>('/api/residents', {
              name: name.trim(),
              phone: cleanPhone,
              aadhaar: cleanAadhaar,
              roomId: currentRoom.id,
              sectionId: currentSection?.id ?? null,
              bedId: finalBedId,
              sharingOptionId: null,
              stayType,
              dailyRate: dailyRateVal,
              checkInTime: cleanCheckInIso,
              checkOutTime: cleanCheckOutIso,
              checkOutDate: checkOutDate.trim() || (cleanCheckOutIso ? cleanCheckOutIso.slice(0, 10) : null),
              rentOverride: rentAmount,
              securityDeposit: parseFloat(securityDeposit) || 0,
              joinedOn: finalJoinedOn,
            }));
      });
      if (ok) {
        const residentId = (created as { id: number } | null)?.id;
        const problems = residentId
          ? [
              photo.length ? await uploadPictures(`/api/media/resident/${residentId}?kind=PHOTO`, photo) : null,
              idCard.length ? await uploadPictures(`/api/media/resident/${residentId}?kind=ID_CARD`, idCard) : null,
            ].filter(Boolean)
          : [];
        if (problems.length) Alert.alert('Resident added', problems.join('\n\n'));
        setPhoto([]);
        setIdCard([]);
        if (initialRequest) {
          Alert.alert('Booking Approved', `Resident ${name.trim()} has been assigned to Room ${currentRoom.number}.`);
        }
        onAdded();
      }
    } finally {
      setBusy(false);
    }
  };

  const stepTitle = step === 1 ? 'Select room' : 'Resident details';
  const bedLabel = selectedBedId
    ? vacantBeds.find((b) => b.bed.id === selectedBedId)?.bed.bedNumber
    : 'Auto bed';
  const summaryText = currentRoom
    ? `Room ${currentRoom.number} · ${currentSection?.sectionName || 'Main Room'} · ${bedLabel}`
    : 'Pick a floor and room';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, addStyles.sheet]}>
          <View style={s.handle} />

          <View style={addStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle}>{initialRequest ? 'Approve & assign bed' : 'Add resident'}</Text>
              <Text style={s.muted} numberOfLines={1}>
                {initialRequest ? `For ${initialRequest.name} · ` : ''}Step {step} of 2 · {stepTitle}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <View style={addStyles.progress}>
            <View style={[addStyles.progressSeg, addStyles.progressOn]} />
            <View style={[addStyles.progressSeg, step === 2 && addStyles.progressOn]} />
          </View>

          <ScrollView
            style={addStyles.body}
            contentContainerStyle={addStyles.bodyContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            {step === 1 && (
              <>
                <Text style={addStyles.label}>Floor</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={addStyles.row}>
                  {floorOptions.map((f) => (
                    <Choice
                      key={f.floorName}
                      label={shortFloor(f.floorName)}
                      sub={f.vacantBeds > 0 ? `${f.vacantBeds} open` : 'Full'}
                      tone={f.vacantBeds > 0 ? 'good' : 'bad'}
                      on={f.floorName === selectedFloor}
                      onPress={() => setSelectedFloor(f.floorName)}
                    />
                  ))}
                </ScrollView>

                <Text style={addStyles.label}>Room · {roomsOnFloor.length} on this floor</Text>
                {roomsOnFloor.length === 0 ? (
                  <Text style={addStyles.hint}>No rooms created on {selectedFloor} yet.</Text>
                ) : (
                  <View style={addStyles.wrap}>
                    {roomsOnFloor.map((r) => (
                      <Choice
                        key={r.id}
                        label={String(r.number)}
                        sub={r.vacant > 0 ? `${r.vacant} vacant` : 'Full'}
                        tone={r.vacant > 0 ? 'good' : 'bad'}
                        on={r.id === selectedRoomId}
                        disabled={r.vacant <= 0 && r.id !== selectedRoomId}
                        onPress={() => setSelectedRoomId(r.id)}
                      />
                    ))}
                  </View>
                )}
                {currentRoom ? (
                  <Text style={addStyles.hint}>
                    {currentRoom.roomType} · {currentRoom.acType === 'AC' ? 'AC' : 'Non-AC'}
                    {currentRoom.attachedBathroom ? ' · Attached bath' : ''}
                  </Text>
                ) : null}

                {(currentRoom?.sections?.length ?? 0) > 0 && (
                  <>
                    <Text style={addStyles.label}>Section / bedroom</Text>
                    {availableSections.length === 0 ? (
                      <Text style={addStyles.warn}>All sections in Room {currentRoom?.number} are full.</Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={addStyles.row}>
                        {availableSections.map((sec) => {
                          const vac = sec.beds ? sec.beds.filter((b) => isVacantBed(b)).length : sec.capacity;
                          return (
                            <Choice
                              key={sec.id}
                              label={sec.sectionName}
                              sub={`${vac} vacant · ${money(sec.rentPerBed)}`}
                              on={sec.id === selectedSectionId}
                              onPress={() => setSelectedSectionId(sec.id)}
                            />
                          );
                        })}
                      </ScrollView>
                    )}
                  </>
                )}

                {vacantBeds.length > 0 && (
                  <>
                    <Text style={addStyles.label}>Bed</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={addStyles.row}>
                      <Choice label="Auto" sub="any vacant" on={selectedBedId === null} onPress={() => setSelectedBedId(null)} />
                      {vacantBeds.map((item) => (
                        <Choice
                          key={item.bed.id}
                          label={String(item.bed.bedNumber)}
                          sub={money(item.rent)}
                          on={selectedBedId === item.bed.id}
                          onPress={() => handleSelectBed(item)}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <View style={addStyles.roomPill}>
                  <Ionicons name="bed-outline" size={16} color="#2563eb" />
                  <Text style={addStyles.roomPillText} numberOfLines={1}>{summaryText}</Text>
                  <Pressable onPress={() => setStep(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Change room">
                    <Text style={addStyles.roomPillLink}>Change</Text>
                  </Pressable>
                </View>

                <Text style={addStyles.label}>Stay type</Text>
                <View style={addStyles.seg}>
                  {(['MONTHLY', 'DAILY'] as StayType[]).map((t) => (
                    <Pressable
                      key={t}
                      style={[addStyles.segBtn, stayType === t && addStyles.segBtnOn]}
                      onPress={() => setStayType(t)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: stayType === t }}
                    >
                      <Text style={[addStyles.segText, stayType === t && addStyles.segTextOn]}>
                        {t === 'MONTHLY' ? 'Monthly' : 'Day-wise'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={addStyles.label}>Full name *</Text>
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. John Doe"
                  placeholderTextColor={colors.muted}
                />

                <View style={addStyles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={addStyles.label}>Mobile * (login)</Text>
                    <TextInput
                      style={s.input}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      maxLength={15}
                      placeholder="10-15 digits"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={addStyles.label}>Aadhaar *</Text>
                    <TextInput
                      style={s.input}
                      value={aadhaar}
                      onChangeText={(v) => setAadhaar(v.replace(/\D/g, ''))}
                      keyboardType="number-pad"
                      maxLength={12}
                      placeholder="12 digits"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>
                <Text style={addStyles.note}>
                  Login is the mobile number. First password is the last 4 Aadhaar digits (changed at first login). The
                  Aadhaar number is not saved.
                </Text>

                {stayType === 'DAILY' ? (
                  <>
                    <View style={addStyles.twoCol}>
                      <View style={{ flex: 1 }}>
                        <Text style={addStyles.label}>Daily rate *</Text>
                        <TextInput
                          style={s.input}
                          value={dailyRate}
                          onChangeText={setDailyRate}
                          keyboardType="number-pad"
                          placeholderTextColor={colors.muted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={addStyles.label}>Check-in *</Text>
                        <DateField value={checkInTime} onChange={setCheckInTime} time />
                      </View>
                    </View>
                    <Text style={addStyles.label}>Expected check-out (optional)</Text>
                    <DateField
                      value={checkOutTime}
                      onChange={setCheckOutTime}
                      time
                      clearable
                      min={checkInTime.slice(0, 10)}
                      placeholder="Open-ended (tap to set)"
                    />
                  </>
                ) : (
                  <>
                    <View style={addStyles.twoCol}>
                      <View style={{ flex: 1 }}>
                        <Text style={addStyles.label}>Monthly rent *</Text>
                        <TextInput
                          style={s.input}
                          value={rent}
                          onChangeText={setRent}
                          keyboardType="number-pad"
                          placeholderTextColor={colors.muted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={addStyles.label}>Security deposit</Text>
                        <TextInput
                          style={s.input}
                          value={securityDeposit}
                          onChangeText={setSecurityDeposit}
                          keyboardType="number-pad"
                          placeholderTextColor={colors.muted}
                        />
                      </View>
                    </View>
                    <Text style={addStyles.label}>Joining date *</Text>
                    <DateField value={joinedOn} onChange={setJoinedOn} />
                  </>
                )}

                <Text style={addStyles.label}>Photos (optional)</Text>
                <ImagePickerField label="Resident photo" files={photo} onChange={setPhoto} />
                <ImagePickerField label="ID card (Aadhaar, licence, etc.)" files={idCard} onChange={setIdCard} />
              </>
            )}
          </ScrollView>

          <View style={[addStyles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {step === 1 ? (
              <>
                <Text style={addStyles.summary} numberOfLines={1}>{summaryText}</Text>
                <Pressable
                  style={[s.saveBtn, addStyles.primary, { backgroundColor: '#2563eb' }]}
                  onPress={() => {
                    if (
                      !currentRoom ||
                      Number(currentRoom.vacant ?? 0) <= 0 ||
                      (
                        vacantBeds.length === 0 &&
                        (
                          (currentSection?.beds?.length ?? 0) > 0 ||
                          (currentRoom.sections?.length ?? 0) > 0
                        )
                      )
                    ) {
                      Alert.alert('Select available bed', 'Please select a room/section with at least one vacant bed.');
                      return;
                    }
                    if (selectedBedId != null && !vacantBeds.some((item) => item.bed.id === selectedBedId)) {
                      Alert.alert('Select available bed', 'The selected bed is no longer available. Please choose another bed.');
                      return;
                    }
                    setStep(2);
                  }}
                >
                  <Text style={s.saveText}>Continue to resident details</Text>
                  <Ionicons name="arrow-forward" size={17} color="#fff" />
                </Pressable>
              </>
            ) : (
              <View style={addStyles.footerRow}>
                <Pressable style={addStyles.backBtn} onPress={() => setStep(1)} disabled={busy}>
                  <Ionicons name="arrow-back" size={16} color="#334155" />
                  <Text style={{ color: '#334155', fontWeight: '700' }}>Back</Text>
                </Pressable>
                <Pressable
                  style={[s.saveBtn, addStyles.primary, { flex: 1.5 }, busy && { opacity: 0.6 }]}
                  onPress={submit}
                  disabled={busy}
                >
                  <Text style={s.saveText}>
                    {busy ? 'Assigning...' : initialRequest ? 'Approve & allocate bed' : 'Add resident'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MoveResidentModal({
  visible,
  resident,
  rooms,
  onClose,
  onMoved,
}: {
  visible: boolean;
  resident: Resident;
  rooms: Room[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const availableRooms = rooms.filter((r) => r.id !== resident.roomId && r.vacant > 0);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(
    availableRooms.length > 0 ? availableRooms[0].id : null
  );

  const targetRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;

  const [stayType, setStayType] = useState<StayType>(resident.stayType || 'MONTHLY');
  const [dailyRate, setDailyRate] = useState<string>(
    resident.dailyRate ? String(resident.dailyRate) : String(Math.round(resident.rent / 30) || 500)
  );
  const [checkOutDate, setCheckOutDate] = useState<string>(resident.checkOutDate || '');
  const [selectedSharingOptionId, setSelectedSharingOptionId] = useState<number | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<number | null>(null);
  const [rent, setRent] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (targetRoom) {
      if (targetRoom.sharingOptions && targetRoom.sharingOptions.length > 0) {
        const firstOpt = targetRoom.sharingOptions[0];
        setSelectedSharingOptionId(firstOpt.id ?? null);
        setRent(String(firstOpt.rentPerBed));
      } else {
        setSelectedSharingOptionId(null);
        setRent(String(targetRoom.rent));
      }
      setSelectedBedId(null);
    }
  }, [selectedRoomId]);

  const vacantBeds: { bed: Bed; sectionName: string; rent: number }[] = [];
  if (targetRoom?.sections) {
    for (const sec of targetRoom.sections) {
      if (sec.beds) {
        for (const b of sec.beds) {
          if (isVacantBed(b)) {
            vacantBeds.push({
              bed: b,
              sectionName: sec.sectionName,
              rent: b.rent || sec.rentPerBed || targetRoom.rent,
            });
          }
        }
      }
    }
  }

  const handleSelectSharing = (opt: SharingOption) => {
    setSelectedSharingOptionId(opt.id ?? null);
    if (opt.rentPerBed) {
      setRent(String(opt.rentPerBed));
    }
  };

  const handleSelectBed = (bedItem: { bed: Bed; rent: number }) => {
    setSelectedBedId(bedItem.bed.id);
    if (!selectedSharingOptionId) {
      setRent(String(bedItem.rent));
    }
  };

  const submit = async () => {
    if (!targetRoom) {
      Alert.alert('Select Room', 'Please select a destination room.');
      return;
    }
    if (targetRoom.vacant <= 0) {
      Alert.alert('Room Full', `Room ${targetRoom.number} has no vacancy.`);
      return;
    }
    let dailyRateVal: number | undefined = undefined;
    let rentAmount = parseFloat(rent);
    if (stayType === 'DAILY') {
      const parsedDaily = parseFloat(dailyRate);
      if (!(parsedDaily > 0)) {
        Alert.alert('Invalid Daily Rate', 'Please enter a valid amount per day.');
        return;
      }
      dailyRateVal = parsedDaily;
      rentAmount = parsedDaily;
    } else {
      if (!(rentAmount >= 0)) {
        Alert.alert('Invalid Rent', 'Please enter a valid rent amount.');
        return;
      }
    }

    const finalBedId = selectedBedId || (vacantBeds.length > 0 ? vacantBeds[0].bed.id : null);

    setBusy(true);
    try {
      const ok = await attempt(() =>
        post(`/api/residents/${resident.id}/move`, {
          roomId: targetRoom.id,
          bedId: finalBedId,
          sharingOptionId: stayType === 'MONTHLY' ? selectedSharingOptionId : null,
          stayType,
          dailyRate: dailyRateVal,
          checkOutDate: checkOutDate.trim() || null,
          rentOverride: rentAmount,
          securityDeposit: resident.securityDeposit || 0,
        })
      );
      if (ok) {
        Alert.alert('Success', `${resident.name} has been moved to Room ${targetRoom.number}.`);
        onMoved();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.sheetHeader}>
            <View>
              <Text style={s.sheetTitle}>Move Resident</Text>
              <Text style={s.muted}>
                {resident.name} (Current: Room {resident.roomNumber || '—'}
                {resident.bedNumber ? ` · ${resident.bedNumber}` : ''})
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetBody}>
            {availableRooms.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Ionicons name="alert-circle-outline" size={36} color="#ea580c" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 8 }}>
                  No Vacant Rooms Available
                </Text>
                <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 4 }}>
                  All other rooms are currently at full capacity.
                </Text>
              </View>
            ) : (
              <>
                <Text style={s.label}>Destination Room *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {availableRooms.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => setSelectedRoomId(r.id)}
                      style={[
                        s.chip,
                        selectedRoomId === r.id && s.chipOn,
                        { paddingVertical: 8, paddingHorizontal: 12 },
                      ]}
                    >
                      <Text style={[s.chipText, selectedRoomId === r.id && { color: '#fff', fontWeight: '700' }]}>
                        Room {r.number} ({r.vacant} vacant · {money(r.rent)}/mo)
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Sharing Plan Selection if available in destination room */}
                {targetRoom && targetRoom.sharingOptions && targetRoom.sharingOptions.length > 0 && (
                  <>
                    <Text style={s.label}>Sharing Plan</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      {targetRoom.sharingOptions.map((opt, idx) => (
                        <Pressable
                          key={opt.id ?? idx}
                          onPress={() => handleSelectSharing(opt)}
                          style={[s.chip, selectedSharingOptionId === opt.id && s.chipOn]}
                        >
                          <Text style={[s.chipText, selectedSharingOptionId === opt.id && { color: '#fff' }]}>
                            {opt.capacity}-Sharing ({money(opt.rentPerBed)}/mo)
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Bed Selection */}
                {vacantBeds.length > 0 && (
                  <>
                    <Text style={s.label}>Assign Bed in Room {targetRoom?.number}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      <Pressable
                        onPress={() => setSelectedBedId(null)}
                        style={[s.chip, selectedBedId === null && s.chipOn]}
                      >
                        <Text style={[s.chipText, selectedBedId === null && { color: '#fff' }]}>Auto-Assign</Text>
                      </Pressable>
                      {vacantBeds.map((item) => (
                        <Pressable
                          key={item.bed.id}
                          onPress={() => handleSelectBed(item)}
                          style={[s.chip, selectedBedId === item.bed.id && s.chipOn]}
                        >
                          <Text style={[s.chipText, selectedBedId === item.bed.id && { color: '#fff' }]}>
                            {item.sectionName !== 'Main Room' ? `${item.sectionName} - ` : ''}
                            {item.bed.bedNumber}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}

                <Text style={s.label}>New Monthly Rent (₹) *</Text>
                <TextInput
                  style={s.input}
                  value={rent}
                  onChangeText={setRent}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.muted}
                />

                <Pressable
                  style={[s.saveBtn, { backgroundColor: '#2563eb' }, busy && { opacity: 0.6 }]}
                  onPress={submit}
                  disabled={busy}
                >
                  <Text style={s.saveText}>{busy ? 'Moving Room...' : 'Confirm Room Move'}</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RejoinResidentModal({
  visible,
  resident,
  rooms,
  onClose,
  onRejoined,
}: {
  visible: boolean;
  resident: Resident;
  rooms: Room[];
  onClose: () => void;
  onRejoined: () => void;
}) {
  const availableRooms = rooms.filter((r) => r.vacant > 0);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(
    availableRooms.length > 0 ? availableRooms[0].id : null
  );

  const targetRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;

  const [stayType, setStayType] = useState<StayType>(resident.stayType || 'MONTHLY');
  const [dailyRate, setDailyRate] = useState<string>(
    resident.dailyRate ? String(resident.dailyRate) : String(Math.round(resident.rent / 30) || 500)
  );
  const [joinedOn, setJoinedOn] = useState<string>(today());
  const [checkInTime, setCheckInTime] = useState<string>(nowDateTime().replace('T', ' '));
  const [selectedSharingOptionId, setSelectedSharingOptionId] = useState<number | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<number | null>(null);
  const [rent, setRent] = useState<string>('');
  const [securityDeposit, setSecurityDeposit] = useState<string>(
    resident.securityDeposit ? String(resident.securityDeposit) : '0'
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (targetRoom) {
      if (targetRoom.sharingOptions && targetRoom.sharingOptions.length > 0) {
        const firstOpt = targetRoom.sharingOptions[0];
        setSelectedSharingOptionId(firstOpt.id ?? null);
        setRent(String(firstOpt.rentPerBed));
      } else {
        setSelectedSharingOptionId(null);
        setRent(String(targetRoom.rent));
      }
      setSelectedBedId(null);
    }
  }, [selectedRoomId]);

  const vacantBeds: { bed: Bed; sectionName: string; rent: number; deposit: number }[] = [];
  if (targetRoom?.sections) {
    for (const sec of targetRoom.sections) {
      if (sec.beds) {
        for (const b of sec.beds) {
          if (isVacantBed(b)) {
            vacantBeds.push({
              bed: b,
              sectionName: sec.sectionName,
              rent: b.rent || sec.rentPerBed || targetRoom.rent,
              deposit: sec.depositPerBed || 0,
            });
          }
        }
      }
    }
  }

  const handleSelectSharing = (opt: SharingOption) => {
    setSelectedSharingOptionId(opt.id ?? null);
    if (opt.rentPerBed) {
      setRent(String(opt.rentPerBed));
    }
  };

  const handleSelectBed = (bedItem: { bed: Bed; rent: number; deposit: number }) => {
    setSelectedBedId(bedItem.bed.id);
    if (!selectedSharingOptionId) {
      setRent(String(bedItem.rent));
    }
    if (bedItem.deposit > 0) {
      setSecurityDeposit(String(bedItem.deposit));
    }
  };

  const submit = async () => {
    if (!targetRoom) {
      Alert.alert('Select Room', 'Please select a room.');
      return;
    }
    if (targetRoom.vacant <= 0) {
      Alert.alert('Room Full', `Room ${targetRoom.number} has no vacancy.`);
      return;
    }
    if (stayType === 'DAILY') {
      const cleanIn = checkInTime.trim();
      if (!isDate(cleanIn) && !isDateTime(cleanIn)) {
        Alert.alert('Invalid Check-in Time', 'Check-in time must be formatted as YYYY-MM-DD or YYYY-MM-DD HH:mm.');
        return;
      }
    } else {
      if (!isDate(joinedOn)) {
        Alert.alert('Invalid Date', 'Please enter a valid join date (YYYY-MM-DD).');
        return;
      }
    }
    let dailyRateVal: number | undefined = undefined;
    let rentAmount = parseFloat(rent);
    if (stayType === 'DAILY') {
      const parsedDaily = parseFloat(dailyRate);
      if (!(parsedDaily > 0)) {
        Alert.alert('Invalid Daily Rate', 'Please enter a valid amount per day.');
        return;
      }
      dailyRateVal = parsedDaily;
      rentAmount = parsedDaily;
    } else {
      if (!(rentAmount >= 0)) {
        Alert.alert('Invalid Rent', 'Please enter a valid rent amount.');
        return;
      }
    }

    const finalBedId = selectedBedId || (vacantBeds.length > 0 ? vacantBeds[0].bed.id : null);
    const parsedDeposit = parseFloat(securityDeposit) || 0;
    const cleanCheckInIso = stayType === 'DAILY' ? checkInTime.trim().replace(' ', 'T') : null;
    const finalJoinedOn = stayType === 'DAILY' ? cleanCheckInIso!.slice(0, 10) : joinedOn;

    setBusy(true);
    try {
      const ok = await attempt(() =>
        post(`/api/residents/${resident.id}/rejoin`, {
          roomId: targetRoom.id,
          bedId: finalBedId,
          sharingOptionId: stayType === 'MONTHLY' ? selectedSharingOptionId : null,
          stayType,
          dailyRate: dailyRateVal,
          checkInTime: cleanCheckInIso,
          joinedOn: finalJoinedOn,
          rentOverride: rentAmount,
          securityDeposit: parsedDeposit,
        })
      );
      if (ok) {
        Alert.alert('Success', `${resident.name} has been re-admitted to Room ${targetRoom.number}.`);
        onRejoined();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.sheetHeader}>
            <View>
              <Text style={s.sheetTitle}>Re-admit Resident</Text>
              <Text style={s.muted}>{resident.name} · Allocate room & bed</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetBody}>
            {availableRooms.length === 0 ? (
              <View style={{ paddingVertical: 20 }}>
                <Text style={{ textAlign: 'center', color: '#dc2626', fontWeight: '600' }}>
                  No rooms with vacant beds available.
                </Text>
              </View>
            ) : (
              <>
                <Text style={s.label}>Stay Duration Plan</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <Pressable
                    onPress={() => setStayType('MONTHLY')}
                    style={[s.chip, { flex: 1, alignItems: 'center' }, stayType === 'MONTHLY' && s.chipOn]}
                  >
                    <Text style={[s.chipText, stayType === 'MONTHLY' && { color: '#fff' }]}>Monthly Stay</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setStayType('DAILY')}
                    style={[s.chip, { flex: 1, alignItems: 'center' }, stayType === 'DAILY' && s.chipOn]}
                  >
                    <Text style={[s.chipText, stayType === 'DAILY' && { color: '#fff' }]}>Daily / Short Stay</Text>
                  </Pressable>
                </View>

                {stayType === 'DAILY' ? (
                  <>
                    <Text style={s.label}>Daily Rate (₹/day) *</Text>
                    <TextInput
                      style={s.input}
                      value={dailyRate}
                      onChangeText={setDailyRate}
                      keyboardType="number-pad"
                      placeholderTextColor={colors.muted}
                    />
                    <Text style={s.label}>Check-in Date & Time *</Text>
                    <DateField value={checkInTime} onChange={setCheckInTime} time />
                  </>
                ) : (
                  <>
                    <Text style={s.label}>New Join Date *</Text>
                    <DateField value={joinedOn} onChange={setJoinedOn} />
                  </>
                )}

                <Text style={s.label}>Select Room *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {availableRooms.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => setSelectedRoomId(r.id)}
                      style={[
                        s.chip,
                        selectedRoomId === r.id && s.chipOn,
                        { borderColor: selectedRoomId === r.id ? '#16a34a' : '#cbd5e1', backgroundColor: selectedRoomId === r.id ? '#16a34a' : '#f8fafc' },
                      ]}
                    >
                      <Text style={[s.chipText, selectedRoomId === r.id && { color: '#fff', fontWeight: '700' }]}>
                        Room {r.number} ({r.vacant} vacant · {money(r.rent)}/mo)
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {targetRoom && targetRoom.sharingOptions && targetRoom.sharingOptions.length > 0 && (
                  <>
                    <Text style={s.label}>Sharing Plan</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      {targetRoom.sharingOptions.map((opt, idx) => (
                        <Pressable
                          key={opt.id ?? idx}
                          onPress={() => handleSelectSharing(opt)}
                          style={[s.chip, selectedSharingOptionId === opt.id && s.chipOn]}
                        >
                          <Text style={[s.chipText, selectedSharingOptionId === opt.id && { color: '#fff' }]}>
                            {opt.capacity}-Sharing ({money(opt.rentPerBed)}/mo)
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}

                {vacantBeds.length > 0 && (
                  <>
                    <Text style={s.label}>Assign Bed in Room {targetRoom?.number}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      <Pressable
                        onPress={() => setSelectedBedId(null)}
                        style={[s.chip, selectedBedId === null && s.chipOn]}
                      >
                        <Text style={[s.chipText, selectedBedId === null && { color: '#fff' }]}>Auto-Assign</Text>
                      </Pressable>
                      {vacantBeds.map((item) => (
                        <Pressable
                          key={item.bed.id}
                          onPress={() => handleSelectBed(item)}
                          style={[s.chip, selectedBedId === item.bed.id && s.chipOn]}
                        >
                          <Text style={[s.chipText, selectedBedId === item.bed.id && { color: '#fff' }]}>
                            {item.sectionName !== 'Main Room' ? `${item.sectionName} - ` : ''}
                            {item.bed.bedNumber}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}

                <Text style={s.label}>Monthly Rent (₹) *</Text>
                <TextInput
                  style={s.input}
                  value={rent}
                  onChangeText={setRent}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.muted}
                />

                <Text style={s.label}>Security Deposit (₹)</Text>
                <TextInput
                  style={s.input}
                  value={securityDeposit}
                  onChangeText={setSecurityDeposit}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.muted}
                />

                <Pressable
                  style={[s.saveBtn, { backgroundColor: '#16a34a' }, busy && { opacity: 0.6 }]}
                  onPress={submit}
                  disabled={busy}
                >
                  <Text style={s.saveText}>{busy ? 'Re-admitting...' : 'Confirm Re-admission'}</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const allocStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
    overflow: 'hidden',
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  selectorIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  selectorSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  optionsList: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    maxHeight: 220,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  optionItemSelected: {
    backgroundColor: '#f0fdf4',
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  optionSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
