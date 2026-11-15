import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { del, get, post } from '../api';
import { useAuth } from '../auth';
import { attempt, useResource } from '../hooks';
import { COMPLAINT_CATEGORY, useLookup } from '../lookups';
import { ResidentStorage } from '../residentService';
import {
  AttendanceRecord,
  Complaint,
  ComplaintPriority,
  FoodMenu,
  LeaveApplication,
  MealOccurrence,
  MealPreference,
  MyDuesData,
  PgDocument,
  SupportContact,
  VisitorPass,
} from '../types';
import { DateField } from '../dateField';
import { Avatar, Badge, Card, FormModal, Screen, colors, s } from '../ui';
import { clock12, isDate, money, today, ymd } from '../utils';

/** Earliest leaving date the server accepts: 30 days from now. */
const NOTICE_DAYS = 30;
const earliestLeave = () => {
  const d = new Date();
  d.setDate(d.getDate() + NOTICE_DAYS);
  return ymd(d);
};

type ActiveModal =
  | null
  | 'COMPLAINTS'
  | 'NEW_COMPLAINT'
  | 'FOOD'
  | 'ATTENDANCE'
  | 'VISITORS'
  | 'NEW_VISITOR'
  | 'LEAVE'
  | 'NEW_LEAVE'
  | 'ROOM'
  | 'DOCUMENTS'
  | 'NOTICE'
  | 'SUPPORT';

export default function ResidentDashboard({ navigation }: { navigation?: any }) {
  const { user } = useAuth();
  const { data, error, loading, refreshing, refresh } = useResource(() => get<MyDuesData>('/api/me/dues'));
  const me = data?.resident;
  const pg = data?.pg;

  // Active sub-module modal
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  // Contacts the owner chose to share under Support & Helpline.
  const supportContacts = useResource(() => get<SupportContact[]>('/api/support-contacts')).data ?? [];

  // Complaints live on the server so the owner / manager can see and resolve them.
  const complaintsRes = useResource(() => get<Complaint[]>('/api/me/complaints'));
  const complaints = complaintsRes.data ?? [];
  const updatedComplaints = complaints.filter((c) => !c.residentSeen).length;

  // Meals being served now and the next ones; empty when the property has no food menu.
  const mealsRes = useResource(() => get<MealOccurrence[]>('/api/me/meals').catch(() => [] as MealOccurrence[]));
  const nextMeals = (mealsRes.data ?? []).slice(0, 4);
  const [respondingMeal, setRespondingMeal] = useState<string | null>(null);
  const respondToMeal = async (m: MealOccurrence, attending: boolean) => {
  const key = `${m.mealId}@${m.date}`;
  setRespondingMeal(key);

  const ok = await attempt(() =>
    post('/api/me/meals/attend', {
      mealId: m.mealId,
      date: m.date,
      attending,
    })
  );

  setRespondingMeal(null);

  if (ok) mealsRes.reload();
};
  const categories = useLookup(COMPLAINT_CATEGORY);

  // Module state
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [visitors, setVisitors] = useState<VisitorPass[]>([]);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [documents, setDocuments] = useState<PgDocument[]>([]);
  const [mealPrefs, setMealPrefs] = useState<MealPreference>({
    dietType: 'VEG',
    breakfastOptIn: true,
    lunchOptIn: true,
    dinnerOptIn: true,
  });
  const weeklyMenu: FoodMenu[] = ResidentStorage.getWeeklyMenu();
  const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

  const [noticeOpen, setNoticeOpen] = useState(false);

  // Notice board: the property's rules. They rarely change, so ResidentStorage keeps a copy on the device.
  const [rules, setRules] = useState<string | null>(null);
  const openNoticeBoard = () => {
    setActiveModal('NOTICE');
    ResidentStorage.getRules(pg?.id).then(setRules);
  };

  // New Complaint Form
  const [cmpCategory, setCmpCategory] = useState('');
  const [cmpTitle, setCmpTitle] = useState('');
  const [cmpDesc, setCmpDesc] = useState('');
  const [cmpPriority, setCmpPriority] = useState<ComplaintPriority>('MEDIUM');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  // Until the resident picks one, the first option of the lookup table is used.
  const chosenCategory = cmpCategory || categories[0]?.code || '';

  // New Visitor Form
  const [visName, setVisName] = useState('');
  const [visPhone, setVisPhone] = useState('');
  const [visRel, setVisRel] = useState('Friend');
  const [visDate, setVisDate] = useState(today());
  const [visTime, setVisTime] = useState('06:00 PM');
  const [visPurpose, setVisPurpose] = useState('Visiting & study');

  // New Leave Form
  const [leaveStart, setLeaveStart] = useState(today());
  const [leaveEnd, setLeaveEnd] = useState(today());
  const [leaveReason, setLeaveReason] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Food Complaint Form
  const [foodFeedback, setFoodFeedback] = useState('');

  useEffect(() => {
    loadLocalData();
  }, [me?.id]);

  const loadLocalData = async () => {
    const resId = me?.id ?? user?.residentId;
    const [a, v, l, d, m] = await Promise.all([
      ResidentStorage.getAttendance(resId),
      ResidentStorage.getVisitors(resId),
      ResidentStorage.getLeaves(resId),
      ResidentStorage.getDocuments(),
      ResidentStorage.getMealPreferences(resId),
    ]);
    setAttendance(a);
    setVisitors(v);
    setLeaves(l);
    setDocuments(d);
    setMealPrefs(m);
  };

  const isCheckedIn = attendance.length === 0 || attendance[0]?.type === 'CHECK_IN';

  const handleToggleAttendance = async () => {
    const nextType = isCheckedIn ? 'CHECK_OUT' : 'CHECK_IN';
    const rec = await ResidentStorage.recordAttendance(me?.id, nextType);
    setAttendance((prev) => [rec, ...prev]);
    Alert.alert(
      nextType === 'CHECK_IN' ? 'Checked In' : 'Checked Out',
      `You marked your status as ${nextType === 'CHECK_IN' ? 'Inside PG' : 'Out of PG'} at ${rec.timestamp}.`
    );
  };

  const handleGiveNotice = async (v: Record<string, string>) => {
    if (!isDate(v.vacateOn) || v.vacateOn < earliestLeave()) {
      Alert.alert('Check the date', `Notice must be at least ${NOTICE_DAYS} days. Earliest leaving date is ${earliestLeave()}.`);
      return false;
    }
    const ok = await attempt(() => post('/api/me/vacate-notice', { vacateOn: v.vacateOn, reason: v.reason || null }));
    if (!ok) return false;
    setNoticeOpen(false);
    refresh();
  };

  const handleCancelNotice = () =>
    Alert.alert('Withdraw notice?', 'You will stay on as a resident.', [
      { text: 'Keep notice', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => del('/api/me/vacate-notice'))) refresh();
        },
      },
    ]);

  /** Opens the list and tells the server the resident has now seen any status changes. */
  const openComplaints = async () => {
    setActiveModal('COMPLAINTS');
    if (updatedComplaints > 0 && (await attempt(() => post('/api/me/complaints/seen')))) {
      complaintsRes.reload();
    }
  };

  const handleSaveComplaint = async () => {
    if (!cmpTitle.trim() || !cmpDesc.trim()) {
      Alert.alert('Missing Details', 'Please provide a title and description for your issue.');
      return;
    }
    if (!chosenCategory) {
      Alert.alert('Category needed', 'Please pick a category for your issue.');
      return;
    }
    setSubmittingComplaint(true);
    try {
      const created = await attempt(() =>
        post<Complaint>('/api/me/complaints', {
          category: chosenCategory,
          title: cmpTitle.trim(),
          description: cmpDesc.trim(),
          priority: cmpPriority,
        })
      );
      if (!created) return;
      setCmpTitle('');
      setCmpDesc('');
      setCmpCategory('');
      setCmpPriority('MEDIUM');
      setActiveModal('COMPLAINTS');
      complaintsRes.reload();
      Alert.alert('Complaint Raised', 'Your complaint has been sent to the owner. You will be notified when it is resolved.');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const handleSaveVisitor = async () => {
    if (!visName.trim() || !visPhone.trim()) {
      Alert.alert('Missing Details', 'Please enter visitor name and mobile number.');
      return;
    }
    const created = await ResidentStorage.addVisitor(me?.id, {
      visitorName: visName.trim(),
      visitorPhone: visPhone.trim(),
      relationship: visRel,
      visitDate: visDate,
      visitTime: visTime,
      purpose: visPurpose,
    });
    setVisitors((prev) => [created, ...prev]);
    setVisName('');
    setVisPhone('');
    setActiveModal('VISITORS');
    Alert.alert('Visitor Pass Created', `Visitor pass for ${created.visitorName} generated with Approved status.`);
  };

  const handleSaveLeave = async () => {
    if (!isDate(leaveStart) || !isDate(leaveEnd)) {
      Alert.alert('Invalid Dates', 'Please enter dates in YYYY-MM-DD format.');
      return;
    }
    if (!leaveReason.trim()) {
      Alert.alert('Missing Reason', 'Please provide a reason for your leave.');
      return;
    }
    const created = await ResidentStorage.applyLeave(me?.id, {
      startDate: leaveStart,
      endDate: leaveEnd,
      reason: leaveReason.trim(),
      emergencyContact: emergencyPhone.trim() || undefined,
    });
    setLeaves((prev) => [created, ...prev]);
    setLeaveReason('');
    setActiveModal('LEAVE');
    Alert.alert('Leave Application Submitted', `Leave request from ${leaveStart} to ${leaveEnd} registered.`);
  };

  const handleSaveMealPrefs = async (updated: MealPreference) => {
    setMealPrefs(updated);
    await ResidentStorage.saveMealPreferences(me?.id, updated);
  };

  const handleCall = (phone?: string | null) => {
    if (!phone) {
      Alert.alert('No Phone Number', 'Contact phone number is not available.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone?: string | null) => {
    if (!phone) {
      Alert.alert('No WhatsApp Number', 'Phone number is not available.');
      return;
    }
    const clean = phone.replace(/[^0-9]/g, '');
    const num = clean.length === 10 ? `91${clean}` : clean;
    Linking.openURL(`https://wa.me/${num}?text=Hi%2C%20I%20am%20${encodeURIComponent(me?.name || 'Resident')}%20from%20Room%20${me?.roomNumber || ''}.`);
  };

  // Opens the resident's UPI app (GPay / PhonePe / Paytm) with the owner's UPI ID and the amount due filled in.
  const handlePayUpi = async () => {
    if (!pg?.upiId) {
      Alert.alert(
        'UPI ID Not Configured',
        `The owner of ${pg?.name || 'this PG'} has not set up a UPI ID yet. Please contact the owner at ${pg?.ownerMobile || 'the front desk'} for payment details.`,
      );
      return;
    }
    const amount = me?.due ?? 0;
    const payee = pg.upiName || pg.name || 'PG Management';
    const note = `Rent for ${me?.name || 'Resident'}`;
    const url = `upi://pay?pa=${encodeURIComponent(pg.upiId.trim())}&pn=${encodeURIComponent(payee)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('No UPI app found', `Pay ${money(amount)} to UPI ID ${pg.upiId.trim()} (${payee}), then record the payment under My Dues.`);
    }
  };

  const roomBedSummary = [
    me?.roomNumber ? `Room ${me.roomNumber}` : null,
    me?.sectionName && me.sectionName !== 'Main Room' ? me.sectionName : null,
    me?.bedNumber ? `${me.bedNumber}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Screen
      title="Resident Hub"
      loading={loading}
      error={error && !error.toLowerCase().includes('resident profile') ? error : null}
      refreshing={refreshing}
      onRefresh={() => { refresh(); complaintsRes.refresh(); mealsRes.reload(); }}
    >
      {/* ── 1. Resident Hero Card / Room Details ── */}
      <View style={rdStyles.heroCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar name={me?.name || user?.username || 'Resident'} uri={me?.photoUrl} />
            <View>
              <Text style={rdStyles.heroGreeting}>Welcome back,</Text>
              <Text style={rdStyles.heroName}>{me?.name || user?.username || 'Resident'}</Text>
            </View>
          </View>
          {pg?.genderType ? (
            <Badge
              text={pg.genderType === 'GENTS' ? 'Gents PG' : pg.genderType === 'LADIES' ? 'Ladies PG' : 'Co-Living'}
              color="#3b82f6"
            />
          ) : null}
        </View>

        <View style={rdStyles.heroDivider} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={rdStyles.heroPgName}>{pg?.name || 'Stay Residency'}</Text>
              {pg?.stayType ? (
                <Badge
                  text={pg.stayType}
                  color={pg.stayType === 'APARTMENT' ? '#7c3aed' : pg.stayType === 'HOSTEL' ? '#ea580c' : '#2563eb'}
                />
              ) : null}
            </View>
            <Text style={rdStyles.heroRoomText}>{roomBedSummary || 'Room Allocated'}</Text>
            {pg?.locationUrl ? (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}
                onPress={() => Linking.openURL(pg.locationUrl!)}
              >
                <Ionicons name="navigate-circle-outline" size={14} color="#2563eb" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563eb' }}>Open Map Location</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      {/* ── 2. Dues & Quick Pay Banner ── */}
      {me && (
        <Card
          style={{
            ...rdStyles.duesCard,
            ...(me.due > 0
              ? { backgroundColor: '#fef2f2', borderLeftColor: colors.bad }
              : { backgroundColor: '#f0fdf4', borderLeftColor: colors.good }),
          }}
        >
          <View style={[s.row, { alignItems: 'center' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.muted, { fontWeight: '700' }]}>Current Balance / Due</Text>
              <Text style={[rdStyles.dueAmount, { color: me.due > 0 ? colors.bad : colors.good }]}>
                {me.due > 0 ? `${money(me.due)} due` : 'No Dues'}
              </Text>
              <Text style={[s.muted, { fontSize: 11, marginTop: 2 }]}>
                Monthly Rent: {money(me.rent)} · Paid: {money(me.paid)}
              </Text>
              <TouchableOpacity
                style={[rdStyles.receiptsBtn, { alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#ffffffcc' }]}
                onPress={() => navigation?.navigate('My Dues')}
              >
                <Text style={rdStyles.receiptsBtnText}>{me.due > 0 ? 'Pay & receipts' : 'Receipts'}</Text>
              </TouchableOpacity>
            </View>
            {me.due > 0 && (
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity style={rdStyles.payCircle} onPress={handlePayUpi} accessibilityLabel="Pay with UPI app">
                  <Ionicons name="wallet" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={rdStyles.payLabel}>Pay now</Text>
              </View>
            )}
          </View>
        </Card>
      )}

      {/* ── 2b. Notice to vacate ── */}
      {me && me.status !== 'CHECKED_OUT' && (
        <Card>
          {me.noticeStatus === 'REQUESTED' || me.noticeStatus === 'APPROVED' ? (
            <View style={s.row}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Leaving on {me.vacateOn}</Text>
                <Text style={[s.muted, { marginTop: 2 }]}>
                  {me.noticeStatus === 'APPROVED'
                    ? 'Approved by the owner. Your bed is listed as available from that date.'
                    : 'Waiting for the owner to approve your notice.'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Badge
                  text={me.noticeStatus === 'APPROVED' ? 'Approved' : 'Pending'}
                  color={me.noticeStatus === 'APPROVED' ? colors.good : colors.warn}
                />
                <TouchableOpacity onPress={handleCancelNotice}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.bad }}>Withdraw</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.row}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Planning to leave?</Text>
                <Text style={[s.muted, { marginTop: 2 }]}>
                  {me.noticeStatus === 'REJECTED'
                    ? 'Your last notice was declined by the owner. You can send a new one.'
                    : `Give at least ${NOTICE_DAYS} days notice so the owner can plan.`}
                </Text>
              </View>
              <TouchableOpacity style={rdStyles.receiptsBtn} onPress={() => setNoticeOpen(true)}>
                <Text style={rdStyles.receiptsBtnText}>Give notice</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>
      )}

      <FormModal
        visible={noticeOpen}
        title="Notice to vacate"
        submitLabel="Send notice"
        onClose={() => setNoticeOpen(false)}
        fields={[
          { key: 'vacateOn', label: `Leaving date (earliest ${earliestLeave()})`, initial: earliestLeave(), date: true, min: earliestLeave() },
          { key: 'reason', label: 'Reason (optional)', optional: true },
        ]}
        onSubmit={handleGiveNotice}
      />

      {/* ── 3. Meals: what is being served now and next, with "I will eat this" for the kitchen's headcount ── */}
      {nextMeals.length > 0 && (
        <Card>
          <View style={s.row}>
            <Text style={s.h2}>Meals</Text>
            <TouchableOpacity onPress={() => navigation?.navigate('FoodMenu')}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue }}>Full menu</Text>
            </TouchableOpacity>
          </View>
          {nextMeals.map((m) => {
            const key = `${m.mealId}@${m.date}`;
            const when = m.state === 'NOW' ? 'Now' : m.date === today() ? 'Today' : 'Tomorrow';
            return (
              <View key={key} style={rdStyles.nextMealRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={rdStyles.mealName}>{m.name}</Text>
                    <Badge text={when} color={m.state === 'NOW' ? colors.good : colors.blue} />
                  </View>
                  <Text style={[s.muted, { marginTop: 2 }]}>
                    {clock12(m.startTime)} – {clock12(m.endTime)}
                  </Text>
                  <Text style={rdStyles.mealItems} numberOfLines={2}>{m.items.join(', ')}</Text>
                </View>
                {m.canRespond && (
  <View style={rdStyles.mealResponseContainer}>
  <TouchableOpacity
    style={[
      rdStyles.mealCircleButton,
      { backgroundColor: m.attending ? '#2563EB' : '#EFF6FF' },
    ]}
    onPress={() => respondToMeal(m, true)}
    disabled={respondingMeal === key}
    accessibilityLabel="Attend meal"
  >
    <Ionicons
      name="checkmark"
      size={20}
      color={m.attending ? '#FFFFFF' : '#2563EB'}
    />
  </TouchableOpacity>

  <TouchableOpacity
    style={[
      rdStyles.mealCircleButton,
      { backgroundColor: m.attending === false ? '#DC2626' : '#FEF2F2' },
    ]}
    onPress={() => respondToMeal(m, false)}
    disabled={respondingMeal === key}
    accessibilityLabel="Not attending meal"
  >
    <Ionicons
      name="close"
      size={20}
      color={m.attending === false ? '#FFFFFF' : '#DC2626'}
    />
  </TouchableOpacity>
</View>
)}
              </View>
            );
          })}
          <Text style={[s.muted, { fontSize: 11, marginTop: 8 }]}>
            Tap Attend so the kitchen knows how many to cook for.
          </Text>
        </Card>
      )}

      {/* ── 5. All 12 Resident Functionality Modules Grid ── */}
      <Text style={[s.h2, { marginTop: 18, marginBottom: 8 }]}>Resident Services</Text>

      {/* Same tile style as the owner Dashboard quick actions. */}
      <View style={rdStyles.grid}>
        {/* <ServiceTile icon="bed" color="#2563eb" label="My Room" onPress={() => setActiveModal('ROOM')} /> */}
        <ServiceTile
          icon="construct"
          color="#0d9488"
          label="Complaints"
          badge={updatedComplaints || complaints.filter((c) => c.status !== 'RESOLVED').length}
          onPress={openComplaints}
        />
        {nextMeals.length > 0 && (
          <ServiceTile icon="restaurant" color="#ea580c" label="Food Menu" onPress={() => navigation?.navigate('FoodMenu')} />
        )}
        {/* Attendance, Visitors, Leave and Documents tiles are hidden for now. */}
        <ServiceTile icon="clipboard" color="#7c3aed" label="Notice Board" onPress={openNoticeBoard} />
        <ServiceTile icon="call" color="#ef4444" label="Support" onPress={() => setActiveModal('SUPPORT')} />
      </View>

      {/* ── Sub-Modals for each module ── */}

      {/* 🛠️ COMPLAINTS MODAL */}
      <Modal visible={activeModal === 'COMPLAINTS'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveModal(null)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Complaints & Issues</Text>
                <Text style={s.muted}>Track status and raise maintenance requests</Text>
              </View>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              <TouchableOpacity
                style={rdStyles.actionPrimaryBtn}
                onPress={() => setActiveModal('NEW_COMPLAINT')}
              >
                <Ionicons name="add-circle" size={18} color="#fff" />
                <Text style={rdStyles.actionPrimaryBtnText}>Raise New Complaint</Text>
              </TouchableOpacity>

              <Text style={[s.h2, { marginTop: 16, marginBottom: 8 }]}>Your Active & Past Issues</Text>
              {complaints.length === 0 && <Text style={s.muted}>No complaints raised yet.</Text>}

              {complaints.map((c) => (
                <View key={c.id} style={rdStyles.ticketCard}>
                  <View style={s.row}>
                    <Badge text={c.categoryLabel} color="#3b82f6" />
                    <Badge
                      text={c.status === 'RESOLVED' ? 'Resolved' : c.status === 'IN_PROGRESS' ? 'In Progress' : 'Open'}
                      color={c.status === 'RESOLVED' ? '#16a34a' : c.status === 'IN_PROGRESS' ? '#ea580c' : '#eab308'}
                    />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a', marginTop: 6 }}>{c.title}</Text>
                  <Text style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{c.description}</Text>

                  {c.resolutionNotes ? (
                    <View style={rdStyles.resolutionBox}>
                      <Ionicons name="checkmark-done" size={14} color="#16a34a" />
                      <Text style={{ fontSize: 12, color: '#166534', flex: 1 }}>
                        {c.resolutionNotes}
                        {c.handledBy ? ` — ${c.handledBy}` : ''}
                      </Text>
                    </View>
                  ) : null}

                  <View style={[s.row, { marginTop: 8 }]}>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      Raised: {c.createdAt?.slice(0, 10)}
                      {c.status === 'RESOLVED' && c.resolvedAt ? ` · Resolved: ${c.resolvedAt.slice(0, 10)}` : ''}
                    </Text>
                    <Badge
                      text={`Priority: ${c.priority}`}
                      color={c.priority === 'HIGH' ? '#dc2626' : c.priority === 'MEDIUM' ? '#ea580c' : '#64748b'}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🛠️ RAISE COMPLAINT MODAL */}
      <Modal visible={activeModal === 'NEW_COMPLAINT'} transparent animationType="slide" onRequestClose={() => setActiveModal('COMPLAINTS')}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Raise a Complaint</Text>
                <Text style={s.muted}>Select category and details</Text>
              </View>
              <Pressable onPress={() => setActiveModal('COMPLAINTS')} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              <Text style={s.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 12 }}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.code}
                    style={[rdStyles.catChip, chosenCategory === cat.code && rdStyles.catChipActive]}
                    onPress={() => setCmpCategory(cat.code)}
                  >
                    <Text style={[rdStyles.catChipText, chosenCategory === cat.code && rdStyles.catChipTextActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.label}>Issue Title *</Text>
              <TextInput
                style={s.input}
                value={cmpTitle}
                onChangeText={setCmpTitle}
                placeholder="e.g. Tap leaking in bathroom"
                placeholderTextColor={colors.muted}
              />

              <Text style={s.label}>Description & Details *</Text>
              <TextInput
                style={[s.input, { height: 75, textAlignVertical: 'top' }]}
                value={cmpDesc}
                onChangeText={setCmpDesc}
                placeholder="Describe the problem in detail..."
                placeholderTextColor={colors.muted}
                multiline
              />

              <Text style={s.label}>Priority</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[rdStyles.priBtn, cmpPriority === p && rdStyles.priBtnActive]}
                    onPress={() => setCmpPriority(p)}
                  >
                    <Text style={[rdStyles.priBtnText, cmpPriority === p && rdStyles.priBtnTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[s.saveBtn, submittingComplaint && { opacity: 0.6 }]}
                onPress={handleSaveComplaint}
                disabled={submittingComplaint}
              >
                <Text style={s.saveText}>{submittingComplaint ? 'Submitting...' : 'Submit Complaint'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🍲 FOOD & MESS MODAL */}
      <Modal visible={activeModal === 'FOOD'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveModal(null)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Mess & Food Schedule</Text>
                <Text style={s.muted}>Weekly timetable & meal opt-in settings</Text>
              </View>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              {/* Meal Preferences Box */}
              <View style={rdStyles.prefBox}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 8 }}>
                  Diet & Meal Preferences
                </Text>

                <View style={[s.row, { marginBottom: 8 }]}>
                  <Text style={{ fontSize: 13, color: '#334155' }}>Diet Type</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[rdStyles.dietPill, mealPrefs.dietType === 'VEG' && rdStyles.dietPillActive]}
                      onPress={() => handleSaveMealPrefs({ ...mealPrefs, dietType: 'VEG' })}
                    >
                      <Text style={[rdStyles.dietText, mealPrefs.dietType === 'VEG' && rdStyles.dietTextActive]}>Pure Veg</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[rdStyles.dietPill, mealPrefs.dietType === 'NON_VEG' && rdStyles.dietPillActive]}
                      onPress={() => handleSaveMealPrefs({ ...mealPrefs, dietType: 'NON_VEG' })}
                    >
                      <Text style={[rdStyles.dietText, mealPrefs.dietType === 'NON_VEG' && rdStyles.dietTextActive]}>Non-Veg</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[s.row, { paddingVertical: 4 }]}>
                  <Text style={{ fontSize: 13, color: '#334155' }}>Opt-in for Breakfast</Text>
                  <Switch
                    value={mealPrefs.breakfastOptIn}
                    onValueChange={(v) => handleSaveMealPrefs({ ...mealPrefs, breakfastOptIn: v })}
                    trackColor={{ true: colors.primary, false: '#cbd5e1' }}
                  />
                </View>
                <View style={[s.row, { paddingVertical: 4 }]}>
                  <Text style={{ fontSize: 13, color: '#334155' }}>Opt-in for Lunch</Text>
                  <Switch
                    value={mealPrefs.lunchOptIn}
                    onValueChange={(v) => handleSaveMealPrefs({ ...mealPrefs, lunchOptIn: v })}
                    trackColor={{ true: colors.primary, false: '#cbd5e1' }}
                  />
                </View>
                <View style={[s.row, { paddingVertical: 4 }]}>
                  <Text style={{ fontSize: 13, color: '#334155' }}>Opt-in for Dinner</Text>
                  <Switch
                    value={mealPrefs.dinnerOptIn}
                    onValueChange={(v) => handleSaveMealPrefs({ ...mealPrefs, dinnerOptIn: v })}
                    trackColor={{ true: colors.primary, false: '#cbd5e1' }}
                  />
                </View>
              </View>

              {/* Weekly Menu */}
              <Text style={[s.h2, { marginTop: 14, marginBottom: 8 }]}>7-Day Mess Menu</Text>
              {weeklyMenu.map((m) => {
                const isToday = m.day === todayDayName;
                return (
                  <View key={m.day} style={[rdStyles.menuCard, isToday && rdStyles.menuCardToday]}>
                    <View style={s.row}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: isToday ? '#1e40af' : '#0f172a' }}>
                        {m.day} {isToday ? '(Today)' : ''}
                      </Text>
                      {isToday && <Badge text="Current" color="#2563eb" />}
                    </View>
                    <Text style={rdStyles.mealDesc}><Text style={{ fontWeight: '700' }}>Breakfast: </Text>{m.breakfast}</Text>
                    <Text style={rdStyles.mealDesc}><Text style={{ fontWeight: '700' }}>Lunch: </Text>{m.lunch}</Text>
                    <Text style={rdStyles.mealDesc}><Text style={{ fontWeight: '700' }}>Snacks: </Text>{m.snacks}</Text>
                    <Text style={rdStyles.mealDesc}><Text style={{ fontWeight: '700' }}>Dinner: </Text>{m.dinner}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ⏱️ ATTENDANCE / GATE PASS MODAL */}
      <Modal visible={activeModal === 'ATTENDANCE'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveModal(null)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Attendance & Gate Log</Text>
                <Text style={s.muted}>Check-in / check-out history</Text>
              </View>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              <View style={rdStyles.attStatusBox}>
                <Text style={{ fontSize: 13, color: colors.muted }}>Current Presence Status</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: isCheckedIn ? '#16a34a' : '#dc2626', marginVertical: 4 }}>
                  {isCheckedIn ? 'Present inside PG' : 'Stepped Out / On Leave'}
                </Text>
                <TouchableOpacity
                  style={[rdStyles.attActionBtn, { backgroundColor: isCheckedIn ? '#dc2626' : '#16a34a' }]}
                  onPress={handleToggleAttendance}
                >
                  <Ionicons name={isCheckedIn ? 'exit-outline' : 'enter-outline'} size={18} color="#fff" />
                  <Text style={rdStyles.attActionBtnText}>
                    {isCheckedIn ? 'Check Out (Leaving PG)' : 'Check In (Entering PG)'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[s.h2, { marginTop: 16, marginBottom: 8 }]}>Recent Gate Entry Logs</Text>
              {attendance.map((rec) => (
                <View key={rec.id} style={rdStyles.attRow}>
                  <View style={[rdStyles.attIconCircle, { backgroundColor: rec.type === 'CHECK_IN' ? '#ecfdf5' : '#fef2f2' }]}>
                    <Ionicons
                      name={rec.type === 'CHECK_IN' ? 'enter-outline' : 'exit-outline'}
                      size={16}
                      color={rec.type === 'CHECK_IN' ? '#16a34a' : '#dc2626'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>
                      {rec.type === 'CHECK_IN' ? 'Check-In Entry' : 'Check-Out Exit'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>{rec.date} · {rec.location || 'Smart Gate'}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>{rec.timestamp}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 👥 VISITORS MODAL */}
      <Modal visible={activeModal === 'VISITORS'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveModal(null)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Visitors & Guests</Text>
                <Text style={s.muted}>Pre-register guest passes</Text>
              </View>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              <TouchableOpacity
                style={rdStyles.actionPrimaryBtn}
                onPress={() => setActiveModal('NEW_VISITOR')}
              >
                <Ionicons name="person-add" size={18} color="#fff" />
                <Text style={rdStyles.actionPrimaryBtnText}>Register New Visitor</Text>
              </TouchableOpacity>

              <Text style={[s.h2, { marginTop: 16, marginBottom: 8 }]}>Registered Visitor Passes</Text>
              {visitors.length === 0 && <Text style={s.muted}>No visitors registered.</Text>}
              {visitors.map((v) => (
                <View key={v.id} style={rdStyles.visitorCard}>
                  <View style={s.row}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>{v.visitorName}</Text>
                    <Badge text={v.status} color="#16a34a" />
                  </View>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                    Phone: {v.visitorPhone} · {v.relationship}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
                    Date & Time: {v.visitDate} at {v.visitTime}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Purpose: {v.purpose}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 👥 REGISTER VISITOR FORM */}
      <Modal visible={activeModal === 'NEW_VISITOR'} transparent animationType="slide" onRequestClose={() => setActiveModal('VISITORS')}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Visitor Details</Text>
                <Text style={s.muted}>Enter guest information</Text>
              </View>
              <Pressable onPress={() => setActiveModal('VISITORS')} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              <Text style={s.label}>Visitor Full Name *</Text>
              <TextInput style={s.input} value={visName} onChangeText={setVisName} placeholder="e.g. Ramesh Kumar" />

              <Text style={s.label}>Mobile Number *</Text>
              <TextInput style={s.input} value={visPhone} onChangeText={setVisPhone} keyboardType="phone-pad" placeholder="e.g. 9876543210" />

              <Text style={s.label}>Relationship</Text>
              <TextInput style={s.input} value={visRel} onChangeText={setVisRel} placeholder="Friend / Parent / Sibling" />

              <Text style={s.label}>Visit Date</Text>
              <DateField value={visDate} onChange={setVisDate} min={today()} />

              <Text style={s.label}>Expected Time</Text>
              <TextInput style={s.input} value={visTime} onChangeText={setVisTime} placeholder="e.g. 05:00 PM" />

              <Text style={s.label}>Purpose of Visit</Text>
              <TextInput style={s.input} value={visPurpose} onChangeText={setVisPurpose} placeholder="e.g. Study / Family meet" />

              <TouchableOpacity style={s.saveBtn} onPress={handleSaveVisitor}>
                <Text style={s.saveText}>Generate Visitor Pass</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ✈️ LEAVE MODAL */}
      <Modal visible={activeModal === 'LEAVE'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveModal(null)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Leave & Vacation</Text>
                <Text style={s.muted}>Apply for leave & inform PG management</Text>
              </View>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              <TouchableOpacity
                style={rdStyles.actionPrimaryBtn}
                onPress={() => setActiveModal('NEW_LEAVE')}
              >
                <Ionicons name="calendar" size={18} color="#fff" />
                <Text style={rdStyles.actionPrimaryBtnText}>Apply for Leave</Text>
              </TouchableOpacity>

              <Text style={[s.h2, { marginTop: 16, marginBottom: 8 }]}>Leave Requests History</Text>
              {leaves.length === 0 && <Text style={s.muted}>No leave applications yet.</Text>}
              {leaves.map((l) => (
                <View key={l.id} style={rdStyles.visitorCard}>
                  <View style={s.row}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>
                      {l.startDate} to {l.endDate}
                    </Text>
                    <Badge text={l.status} color="#16a34a" />
                  </View>
                  <Text style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>Reason: {l.reason}</Text>
                  {l.emergencyContact ? (
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                      Emergency Contact: {l.emergencyContact}
                    </Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ✈️ APPLY LEAVE FORM */}
      <Modal visible={activeModal === 'NEW_LEAVE'} transparent animationType="slide" onRequestClose={() => setActiveModal('LEAVE')}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Apply for Leave</Text>
                <Text style={s.muted}>Enter leave dates and details</Text>
              </View>
              <Pressable onPress={() => setActiveModal('LEAVE')} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              <Text style={s.label}>Start Date *</Text>
              <DateField
                value={leaveStart}
                onChange={(d) => {
                  setLeaveStart(d);
                  if (leaveEnd < d) setLeaveEnd(d);
                }}
                min={today()}
              />

              <Text style={s.label}>End Date *</Text>
              <DateField value={leaveEnd} onChange={setLeaveEnd} min={leaveStart || today()} />

              <Text style={s.label}>Reason for Leave *</Text>
              <TextInput
                style={[s.input, { height: 70, textAlignVertical: 'top' }]}
                value={leaveReason}
                onChangeText={setLeaveReason}
                placeholder="e.g. Going home for vacation / festival"
                multiline
              />

              <Text style={s.label}>Emergency Phone Number (Optional)</Text>
              <TextInput
                style={s.input}
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                placeholder="Parent / Guardian mobile"
                keyboardType="phone-pad"
              />

              <TouchableOpacity style={s.saveBtn} onPress={handleSaveLeave}>
                <Text style={s.saveText}>Submit Leave Application</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🛏️ ROOM & ROOMMATES MODAL */}
      <Modal visible={activeModal === 'ROOM'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveModal(null)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>My Room & Facilities</Text>
                <Text style={s.muted}>Bed allocation and room details</Text>
              </View>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              <View style={rdStyles.roomHero}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={rdStyles.roomIconWrap}>
                    <Ionicons name="bed" size={24} color="#2563eb" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a' }}>
                      {roomBedSummary || 'Room Allocated'}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {pg?.name || 'PG Residency'} · Monthly Rent: {money(me?.rent || 0)}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={[s.h2, { marginTop: 14, marginBottom: 8 }]}>Room Facilities & Amenities</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { name: 'Air Conditioning', icon: 'snow-outline', color: '#0284c7' },
                  { name: 'High-Speed Wi-Fi', icon: 'wifi-outline', color: '#2563eb' },
                  { name: 'Attached Bathroom', icon: 'water-outline', color: '#059669' },
                  { name: 'Geyser / Hot Water', icon: 'flame-outline', color: '#ea580c' },
                  { name: 'Personal Wardrobe', icon: 'file-tray-stacked-outline', color: '#7c3aed' },
                  { name: 'Balcony / Window', icon: 'grid-outline', color: '#d97706' },
                  { name: 'Daily Housekeeping', icon: 'sparkles-outline', color: '#16a34a' },
                ].map((f) => (
                  <View key={f.name} style={rdStyles.facChip}>
                    <Ionicons name={f.icon as any} size={15} color={f.color} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>{f.name}</Text>
                  </View>
                ))}
              </View>

              <Text style={[s.h2, { marginTop: 18, marginBottom: 8 }]}>Roommates in this Room</Text>
              <View style={rdStyles.roommateCard}>
                <View style={[s.row, { justifyContent: 'flex-start' }]}>
                  <Avatar name="Rahul Sharma" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>Rahul Sharma</Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>Bed B-1 · Joined Jan 2026</Text>
                  </View>
                  <TouchableOpacity
                    style={rdStyles.chatBtn}
                    onPress={() => handleWhatsApp('9876543210')}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#16a34a" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={rdStyles.roommateCard}>
                <View style={[s.row, { justifyContent: 'flex-start' }]}>
                  <Avatar name={me?.name || 'You'} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>{me?.name || 'You'}</Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>{me?.bedNumber || 'B-2'} (You)</Text>
                  </View>
                  <Badge text="Current User" color="#2563eb" />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 📄 DOCUMENTS MODAL */}
      <Modal visible={activeModal === 'DOCUMENTS'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveModal(null)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Documents & Agreements</Text>
                <Text style={s.muted}>Rental agreement, ID proofs & policies</Text>
              </View>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              {me?.attachmentUrl && (
                <View style={rdStyles.docCard}>
                  <View style={[rdStyles.docIconWrap, { backgroundColor: '#eff6ff' }]}>
                    <Ionicons name="document-text" size={20} color="#2563eb" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>Rental Agreement</Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>Signed agreement uploaded by owner · Active</Text>
                  </View>
                  <TouchableOpacity
                    style={rdStyles.docActionBtn}
                    onPress={() => me.attachmentUrl && Linking.openURL(me.attachmentUrl)}
                  >
                    <Ionicons name="eye-outline" size={16} color="#2563eb" />
                  </TouchableOpacity>
                </View>
              )}

              {documents.map((d) => (
                <View key={d.id} style={rdStyles.docCard}>
                  <View style={rdStyles.docIconWrap}>
                    <Ionicons name="document-text" size={20} color="#2563eb" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>{d.title}</Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>{d.fileSize} · {d.status}</Text>
                  </View>
                  <TouchableOpacity
                    style={rdStyles.docActionBtn}
                    onPress={() => Alert.alert('Document Viewer', `Viewing ${d.title}`)}
                  >
                    <Ionicons name="download-outline" size={16} color="#2563eb" />
                  </TouchableOpacity>
                </View>
              ))}

              {!me?.attachmentUrl && documents.length === 0 && (
                <Text style={[s.muted, { textAlign: 'center', paddingVertical: 16 }]}>No documents available.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 📋 NOTICE BOARD MODAL: the property's rules and regulations */}
      <Modal visible={activeModal === 'NOTICE'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
        <View style={[s.overlay, rdStyles.noticeOverlay]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveModal(null)} />
          <View style={[s.sheet, rdStyles.noticeCard]}>
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Notice Board</Text>
                <Text style={s.muted}>Rules & regulations{pg?.name ? ` · ${pg.name}` : ''}</Text>
              </View>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView
              style={rdStyles.noticeScroll}
              contentContainerStyle={s.sheetBody}
              showsVerticalScrollIndicator
              persistentScrollbar
              nestedScrollEnabled
            >
              {rules === null ? (
                <Text style={[s.muted, { textAlign: 'center', marginVertical: 16 }]}>Loading…</Text>
              ) : rules ? (
                // One highlighted bullet per line; a leading "1.", "-" or "•" the owner typed is dropped.
                rules
                  .split(/\r?\n/)
                  .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
                  .filter(Boolean)
                  .map((line, i) => (
                    <View key={i} style={rdStyles.ruleItem}>
                      <View style={rdStyles.ruleDot} />
                      <Text style={rdStyles.ruleText}>{line}</Text>
                    </View>
                  ))
              ) : (
                <Text style={[s.muted, { textAlign: 'center', marginVertical: 16 }]}>
                  Your property has not posted any rules yet.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 📞 SUPPORT & EMERGENCY MODAL */}
      <Modal visible={activeModal === 'SUPPORT'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveModal(null)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Support & Helpline</Text>
                <Text style={s.muted}>Contacts shared by your Owner</Text>
              </View>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              {/* Numbers the owner chose to share; nothing is hard-coded here. */}
              {supportContacts.length === 0 && (
                <Text style={[s.muted, { textAlign: 'center', marginVertical: 16 }]}>
                  Your PG has not added any contacts yet.
                </Text>
              )}
              {supportContacts.map((c) => (
                <View key={c.id} style={rdStyles.contactCard}>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>{c.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.muted }}>{c.phone}</Text>
                      {!!c.note && <Text style={{ fontSize: 12, color: colors.muted }}>{c.note}</Text>}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={rdStyles.callCircle} onPress={() => handleCall(c.phone)}>
                        <Ionicons name="call" size={16} color="#16a34a" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[rdStyles.callCircle, { backgroundColor: '#f0fdf4' }]}
                        onPress={() => handleWhatsApp(c.phone)}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color="#16a34a" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

/** Service shortcut: same look as the owner Dashboard quick actions (icon over a bold label, optional count badge). */
function ServiceTile({
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
    <TouchableOpacity style={rdStyles.gridTile} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label}>
      {badge ? (
        <View style={rdStyles.tileBadge}>
          <Text style={rdStyles.tileBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      <Ionicons name={icon} size={30} color={color} />
      <Text style={rdStyles.tileLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

const rdStyles = StyleSheet.create({
  nextMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  mealName: { fontSize: 15, fontWeight: '800', color: colors.text },
  mealItems: { fontSize: 12, color: '#475569', marginTop: 3 },
  attendBtn: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.good,
    backgroundColor: '#f0fdf4',
    minWidth: 78,
  },
  attendBtnOn: { backgroundColor: colors.good },
  attendText: { fontSize: 11, fontWeight: '700', color: colors.good },
  // Notice board pops up in the middle of the screen instead of sliding up from the bottom.
  noticeOverlay: { justifyContent: 'center', paddingHorizontal: 20 },
  noticeCard: { borderRadius: 20, maxHeight: '75%' },
  // Lets the list shrink to the card and scroll when there are many rules.
  noticeScroll: { flexShrink: 1 },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.primaryLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  ruleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 7 },
  ruleText: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.text, fontWeight: '600' },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 12,
  },
  heroGreeting: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  heroName: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  heroDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  heroPgName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  heroRoomText: { fontSize: 12, color: colors.muted, marginTop: 1 },
  attendancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  duesCard: {
    borderLeftWidth: 4,
    marginBottom: 12,
    borderRadius: 16,
    paddingVertical: 14,
  },
  dueAmount: { fontSize: 24, fontWeight: '900', marginTop: 2 },
  payCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payLabel: { fontSize: 10, fontWeight: '800', color: '#16a34a', marginTop: 3, textAlign: 'center' },
  quickPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  quickPayText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  receiptsBtn: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  receiptsBtnText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  foodCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  foodIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  mealItem: { flex: 1 },
  mealLabel: { fontSize: 11, fontWeight: '700', color: colors.muted },
  mealVal: { fontSize: 12, color: '#334155', fontWeight: '600', marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  gridTile: {
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
  tileBadge: {
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
  tileBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  tileLabel: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: colors.text, textAlign: 'center' },
  upiBox: {
    backgroundColor: '#f0fdf4',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 12,
  },
  paymentCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  viewReceiptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
  },
  receiptSheet: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  receiptLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 12 },
  receiptDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  actionPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  actionPrimaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  ticketCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  resolutionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  catChipActive: { backgroundColor: colors.primary },
  catChipText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  catChipTextActive: { color: '#fff' },
  priBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  priBtnActive: { backgroundColor: colors.primary },
  priBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  priBtnTextActive: { color: '#fff' },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    marginBottom: 14,
  },
  prefBox: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  dietPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  dietPillActive: { backgroundColor: '#16a34a' },
  dietText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  dietTextActive: { color: '#fff' },
  menuCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  menuCardToday: { borderColor: '#93c5fd', backgroundColor: '#f0f9ff' },
  mealDesc: { fontSize: 12, color: '#334155', marginTop: 3 },
  attStatusBox: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  attActionBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  attRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  attIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitorCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  roomHero: {
    backgroundColor: '#eff6ff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  roomIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  facChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roommateCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  chatBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  docIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  callCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emgBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 4,
  },
  emgText: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  mealResponseContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},

mealCircleButton: {
  width: 36,
  height: 36,
  borderRadius: 18,
  alignItems: 'center',
  justifyContent: 'center',
},

mealResponseButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  paddingHorizontal: 10,
  paddingVertical: 9,
  borderRadius: 10,
  backgroundColor: '#F8FAFC',
  borderWidth: 1,
  borderColor: '#E2E8F0',
},

mealAttendActive: {
  backgroundColor: '#16A34A',
  borderColor: '#16A34A',
},

mealNotAttendActive: {
  backgroundColor: '#DC2626',
  borderColor: '#DC2626',
},

mealResponseText: {
  fontSize: 11,
  fontWeight: '700',
  color: '#334155',
},

mealResponseTextActive: {
  color: '#FFFFFF',
},
});
