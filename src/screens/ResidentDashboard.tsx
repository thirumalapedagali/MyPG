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
import { get, post } from '../api';
import { useAuth } from '../auth';
import { attempt, useResource } from '../hooks';
import { ResidentStorage } from '../residentService';
import {
  AttendanceRecord,
  Complaint,
  ComplaintPriority,
  FoodMenu,
  LeaveApplication,
  MealPreference,
  MyDuesData,
  PgDocument,
  PgNotice,
  VisitorPass,
} from '../types';
import { Avatar, Badge, Card, HeaderAction, Screen, colors, s } from '../ui';
import { isDate, money, today } from '../utils';

type ActiveModal =
  | null
  | 'PAYMENTS'
  | 'COMPLAINTS'
  | 'NEW_COMPLAINT'
  | 'FOOD'
  | 'ATTENDANCE'
  | 'VISITORS'
  | 'NEW_VISITOR'
  | 'LEAVE'
  | 'NEW_LEAVE'
  | 'ROOM'
  | 'NOTICES'
  | 'DOCUMENTS'
  | 'SUPPORT'
  | 'RECEIPT';

export default function ResidentDashboard({ navigation }: { navigation?: any }) {
  const { user, logout } = useAuth();
  const { data, error, loading, refreshing, refresh } = useResource(() => get<MyDuesData>('/api/me/dues'));
  const me = data?.resident;
  const pg = data?.pg;

  // Active sub-module modal
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  // Module state
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [visitors, setVisitors] = useState<VisitorPass[]>([]);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [notices, setNotices] = useState<PgNotice[]>([]);
  const [documents, setDocuments] = useState<PgDocument[]>([]);
  const [mealPrefs, setMealPrefs] = useState<MealPreference>({
    dietType: 'VEG',
    breakfastOptIn: true,
    lunchOptIn: true,
    dinnerOptIn: true,
  });
  const weeklyMenu: FoodMenu[] = ResidentStorage.getWeeklyMenu();
  const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  const todayMenu = weeklyMenu.find((m) => m.day === todayDayName) || weeklyMenu[0];

  // Forms
  const [payAmount, setPayAmount] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [payNotes, setPayNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // New Complaint Form
  const [cmpCategory, setCmpCategory] = useState<Complaint['category']>('Plumbing');
  const [cmpTitle, setCmpTitle] = useState('');
  const [cmpDesc, setCmpDesc] = useState('');
  const [cmpPriority, setCmpPriority] = useState<ComplaintPriority>('MEDIUM');
  const [hasPhoto, setHasPhoto] = useState(false);

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
    const [c, a, v, l, n, d, m] = await Promise.all([
      ResidentStorage.getComplaints(resId),
      ResidentStorage.getAttendance(resId),
      ResidentStorage.getVisitors(resId),
      ResidentStorage.getLeaves(resId),
      ResidentStorage.getNotices(),
      ResidentStorage.getDocuments(),
      ResidentStorage.getMealPreferences(resId),
    ]);
    setComplaints(c);
    setAttendance(a);
    setVisitors(v);
    setLeaves(l);
    setNotices(n);
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

  const handleOpenUpi = async () => {
    if (!pg?.upiId) {
      Alert.alert(
        'UPI ID Not Configured',
        `The owner has not configured a UPI ID yet. Please contact ${pg?.ownerMobile || 'the front desk'} for payment details.`
      );
      return;
    }
    const dueAmount = me?.due && me.due > 0 ? me.due : (me?.rent || 5000);
    const pgName = pg?.upiName || pg?.name || 'PG Management';
    const cleanUpi = pg.upiId.trim();
    const upiUrl = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(pgName)}&am=${dueAmount}&cu=INR&tn=${encodeURIComponent(`Rent for ${me?.name || 'Resident'}`)}`;

    try {
      await Linking.openURL(upiUrl);
    } catch {
      Alert.alert(
        'UPI Payment',
        `Pay ₹${dueAmount} to UPI ID:\n\n${cleanUpi}\n(${pgName})\n\nAfter paying in GPay/PhonePe, tap "Enter UTR" to record it.`,
        [
          {
            text: 'Enter UTR',
            onPress: () => {
              setPayAmount(String(dueAmount));
              setActiveModal('PAYMENTS');
            },
          },
          { text: 'OK' },
        ]
      );
    }
  };

  const handleRecordPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!(amt > 0)) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }
    if (!isDate(payDate)) {
      Alert.alert('Invalid Date', 'Date must be formatted as YYYY-MM-DD.');
      return;
    }

    setSubmittingPayment(true);
    try {
      const ok = await attempt(() =>
        post('/api/me/payments', {
          amount: amt,
          date: payDate,
          mode: 'UPI',
          transactionRef: utrNumber.trim() || null,
          notes: payNotes.trim() || null,
        })
      );
      if (ok) {
        Alert.alert('Payment Recorded', `Your payment of ₹${amt} has been recorded!`);
        setActiveModal(null);
        setUtrNumber('');
        setPayNotes('');
        refresh();
      }
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleSaveComplaint = async () => {
    if (!cmpTitle.trim() || !cmpDesc.trim()) {
      Alert.alert('Missing Details', 'Please provide a title and description for your issue.');
      return;
    }
    const created = await ResidentStorage.addComplaint(me?.id, {
      category: cmpCategory,
      title: cmpTitle.trim(),
      description: cmpDesc.trim(),
      priority: cmpPriority,
    });
    setComplaints((prev) => [created, ...prev]);
    setCmpTitle('');
    setCmpDesc('');
    setHasPhoto(false);
    setActiveModal('COMPLAINTS');
    Alert.alert('Complaint Raised', `Ticket #${created.id} submitted successfully. The maintenance team has been notified.`);
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

  const roomBedSummary = [
    me?.roomNumber ? `Room ${me.roomNumber}` : null,
    me?.sectionName && me.sectionName !== 'Main Room' ? me.sectionName : null,
    me?.bedNumber ? `Bed ${me.bedNumber}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Screen
      title="Resident Hub"
      action={<HeaderAction label="Log out" icon="log-out-outline" onPress={logout} />}
      loading={loading}
      error={error && !error.toLowerCase().includes('resident profile') ? error : null}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {/* ── 1. Resident Hero Card / Room Details ── */}
      <View style={rdStyles.heroCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar name={me?.name || user?.username || 'Resident'} />
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
          <TouchableOpacity
            style={[rdStyles.attendancePill, { backgroundColor: isCheckedIn ? '#ecfdf5' : '#fef2f2', borderColor: isCheckedIn ? '#86efac' : '#fca5a5' }]}
            onPress={handleToggleAttendance}
          >
            <View style={[rdStyles.statusDot, { backgroundColor: isCheckedIn ? '#16a34a' : '#dc2626' }]} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: isCheckedIn ? '#16a34a' : '#dc2626' }}>
              {isCheckedIn ? 'Inside PG' : 'Out of PG'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 2. Dues & Quick Pay Banner ── */}
      {me && (
        <Card style={rdStyles.duesCard}>
          <View style={s.row}>
            <View>
              <Text style={s.muted}>Current Balance / Due</Text>
              <Text style={[rdStyles.dueAmount, { color: me.due > 0 ? colors.bad : colors.good }]}>
                {me.due > 0 ? `${money(me.due)} due` : 'Paid in Full'}
              </Text>
              <Text style={[s.muted, { fontSize: 11, marginTop: 2 }]}>
                Monthly Rent: {money(me.rent)} · Paid: {money(me.paid)}
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              {me.due > 0 && (
                <TouchableOpacity style={rdStyles.quickPayBtn} onPress={handleOpenUpi}>
                  <Ionicons name="flash" size={14} color="#fff" />
                  <Text style={rdStyles.quickPayText}>Pay (UPI)</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={rdStyles.receiptsBtn}
                onPress={() => setActiveModal('PAYMENTS')}
              >
                <Text style={rdStyles.receiptsBtnText}>History & UTR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      )}

      {/* ── 3. Latest Announcement Banner ── */}
      {notices.length > 0 && (
        <TouchableOpacity
          style={rdStyles.noticeBanner}
          onPress={() => setActiveModal('NOTICES')}
          activeOpacity={0.8}
        >
          <View style={rdStyles.noticeIconWrap}>
            <Ionicons name="megaphone" size={18} color="#b45309" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Badge text={notices[0].category} color="#f59e0b" />
              <Text style={{ fontSize: 11, color: colors.muted }}>{notices[0].date}</Text>
            </View>
            <Text style={rdStyles.noticeTitle} numberOfLines={1}>{notices[0].title}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>
      )}

      {/* ── 4. Today's Food Sneak Peek ── */}
      <TouchableOpacity
        style={rdStyles.foodCard}
        onPress={() => setActiveModal('FOOD')}
        activeOpacity={0.8}
      >
        <View style={s.row}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={rdStyles.foodIconWrap}>
              <Ionicons name="restaurant" size={18} color="#ea580c" />
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>
                Today's Menu ({todayDayName})
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>Tap to view full meal plan & preferences</Text>
            </View>
          </View>
          <Badge text={mealPrefs.dietType} color={mealPrefs.dietType === 'VEG' ? '#16a34a' : '#dc2626'} />
        </View>

        <View style={rdStyles.mealRow}>
          <View style={rdStyles.mealItem}>
            <Text style={rdStyles.mealLabel}>Breakfast</Text>
            <Text style={rdStyles.mealVal} numberOfLines={1}>{todayMenu.breakfast}</Text>
          </View>
          <View style={rdStyles.mealItem}>
            <Text style={rdStyles.mealLabel}>Lunch</Text>
            <Text style={rdStyles.mealVal} numberOfLines={1}>{todayMenu.lunch}</Text>
          </View>
          <View style={rdStyles.mealItem}>
            <Text style={rdStyles.mealLabel}>Dinner</Text>
            <Text style={rdStyles.mealVal} numberOfLines={1}>{todayMenu.dinner}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── 5. All 12 Resident Functionality Modules Grid ── */}
      <Text style={[s.h2, { marginTop: 18, marginBottom: 10 }]}>Resident Services</Text>

      <View style={rdStyles.grid}>
        {/* Module 1: Room & Bed */}
        <TouchableOpacity
          style={rdStyles.gridTile}
          onPress={() => setActiveModal('ROOM')}
        >
          <View style={[rdStyles.tileIconWrap, { backgroundColor: '#eff6ff' }]}>
            <Ionicons name="bed" size={22} color="#2563eb" />
          </View>
          <Text style={rdStyles.tileTitle}>My Room</Text>
          <Text style={rdStyles.tileSub}>Bed & Facilities</Text>
        </TouchableOpacity>

        {/* Module 2: Payments & Dues */}
        <TouchableOpacity
          style={rdStyles.gridTile}
          onPress={() => setActiveModal('PAYMENTS')}
        >
          <View style={[rdStyles.tileIconWrap, { backgroundColor: '#f0fdf4' }]}>
            <Ionicons name="wallet" size={22} color="#16a34a" />
          </View>
          <Text style={rdStyles.tileTitle}>Payments</Text>
          <Text style={rdStyles.tileSub}>UPI & Receipts</Text>
        </TouchableOpacity>

        {/* Module 3: Complaints & Issues */}
        <TouchableOpacity
          style={rdStyles.gridTile}
          onPress={() => setActiveModal('COMPLAINTS')}
        >
          <View style={[rdStyles.tileIconWrap, { backgroundColor: '#fff7ed' }]}>
            <Ionicons name="construct" size={22} color="#ea580c" />
          </View>
          <Text style={rdStyles.tileTitle}>Complaints</Text>
          <Text style={rdStyles.tileSub}>
            {complaints.filter((c) => c.status !== 'RESOLVED').length} Active
          </Text>
        </TouchableOpacity>

        {/* Module 4: Food & Menu */}
        <TouchableOpacity
          style={rdStyles.gridTile}
          onPress={() => setActiveModal('FOOD')}
        >
          <View style={[rdStyles.tileIconWrap, { backgroundColor: '#fef2f2' }]}>
            <Ionicons name="restaurant" size={22} color="#dc2626" />
          </View>
          <Text style={rdStyles.tileTitle}>Mess & Food</Text>
          <Text style={rdStyles.tileSub}>Menu & Preferences</Text>
        </TouchableOpacity>

        {/* Module 5: Attendance / Gate Pass */}
        <TouchableOpacity
          style={rdStyles.gridTile}
          onPress={() => setActiveModal('ATTENDANCE')}
        >
          <View style={[rdStyles.tileIconWrap, { backgroundColor: '#f5f3ff' }]}>
            <Ionicons name="timer" size={22} color="#7c3aed" />
          </View>
          <Text style={rdStyles.tileTitle}>Attendance</Text>
          <Text style={rdStyles.tileSub}>{isCheckedIn ? 'In PG' : 'Out'}</Text>
        </TouchableOpacity>

        {/* Module 6: Visitors */}
        <TouchableOpacity
          style={rdStyles.gridTile}
          onPress={() => setActiveModal('VISITORS')}
        >
          <View style={[rdStyles.tileIconWrap, { backgroundColor: '#fdf4ff' }]}>
            <Ionicons name="people" size={22} color="#c026d3" />
          </View>
          <Text style={rdStyles.tileTitle}>Visitors</Text>
          <Text style={rdStyles.tileSub}>Guest Pass</Text>
        </TouchableOpacity>

        {/* Module 7: Leave */}
        <TouchableOpacity
          style={rdStyles.gridTile}
          onPress={() => setActiveModal('LEAVE')}
        >
          <View style={[rdStyles.tileIconWrap, { backgroundColor: '#ecfeff' }]}>
            <Ionicons name="airplane" size={22} color="#0891b2" />
          </View>
          <Text style={rdStyles.tileTitle}>Leave</Text>
          <Text style={rdStyles.tileSub}>Apply Vacation</Text>
        </TouchableOpacity>

        {/* Module 8: Notices */}
        <TouchableOpacity
          style={rdStyles.gridTile}
          onPress={() => setActiveModal('NOTICES')}
        >
          <View style={[rdStyles.tileIconWrap, { backgroundColor: '#fefce8' }]}>
            <Ionicons name="notifications" size={22} color="#ca8a04" />
          </View>
          <Text style={rdStyles.tileTitle}>Notices</Text>
          <Text style={rdStyles.tileSub}>{notices.length} Updates</Text>
        </TouchableOpacity>

        {/* Module 9: Documents */}
        <TouchableOpacity
          style={rdStyles.gridTile}
          onPress={() => setActiveModal('DOCUMENTS')}
        >
          <View style={[rdStyles.tileIconWrap, { backgroundColor: '#f1f5f9' }]}>
            <Ionicons name="document-text" size={22} color="#475569" />
          </View>
          <Text style={rdStyles.tileTitle}>Documents</Text>
          <Text style={rdStyles.tileSub}>Agreements & IDs</Text>
        </TouchableOpacity>

        {/* Module 10: Support & Emergency */}
        <TouchableOpacity
          style={rdStyles.gridTile}
          onPress={() => setActiveModal('SUPPORT')}
        >
          <View style={[rdStyles.tileIconWrap, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="call" size={22} color="#ef4444" />
          </View>
          <Text style={rdStyles.tileTitle}>Support</Text>
          <Text style={rdStyles.tileSub}>Owner & Helpline</Text>
        </TouchableOpacity>
      </View>

      {/* ── Sub-Modals for each module ── */}

      {/* 💳 PAYMENTS MODAL */}
      <Modal visible={activeModal === 'PAYMENTS'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveModal(null)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Payments & Receipts</Text>
                <Text style={s.muted}>UPI transfers, UTR confirmation & history</Text>
              </View>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              {/* Pay Now Section */}
              <View style={rdStyles.upiBox}>
                <View style={s.row}>
                  <View>
                    <Text style={{ fontSize: 13, color: colors.muted }}>Total Amount Due</Text>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: me?.due ? colors.bad : colors.good }}>
                      {money(me?.due || 0)}
                    </Text>
                  </View>
                  <TouchableOpacity style={rdStyles.quickPayBtn} onPress={handleOpenUpi}>
                    <Ionicons name="logo-google-playstore" size={15} color="#fff" />
                    <Text style={rdStyles.quickPayText}>Pay via UPI App</Text>
                  </TouchableOpacity>
                </View>
                {pg?.upiId ? (
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 8 }}>
                    Configured UPI ID: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{pg.upiId}</Text> ({pg.upiName || pg.name})
                  </Text>
                ) : null}
              </View>

              {/* Enter UTR form */}
              <Text style={[s.h2, { marginTop: 14, marginBottom: 8 }]}>Record UPI / Cash Payment</Text>
              <Text style={s.label}>Amount Paid (₹) *</Text>
              <TextInput
                style={s.input}
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="number-pad"
                placeholder={me?.due ? String(me.due) : '5000'}
                placeholderTextColor={colors.muted}
              />

              <Text style={s.label}>UPI Transaction ID / UTR Number</Text>
              <TextInput
                style={s.input}
                value={utrNumber}
                onChangeText={setUtrNumber}
                placeholder="12-digit UTR from GPay / PhonePe / Paytm"
                placeholderTextColor={colors.muted}
              />

              <Text style={s.label}>Payment Date</Text>
              <TextInput
                style={s.input}
                value={payDate}
                onChangeText={setPayDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
              />

              <TouchableOpacity
                style={[s.saveBtn, submittingPayment && { opacity: 0.6 }]}
                onPress={handleRecordPayment}
                disabled={submittingPayment}
              >
                <Text style={s.saveText}>{submittingPayment ? 'Submitting...' : 'Submit Payment'}</Text>
              </TouchableOpacity>

              {/* Payment History & Receipts */}
              <Text style={[s.h2, { marginTop: 20, marginBottom: 8 }]}>Payment Receipts & History</Text>
              {data?.payments && data.payments.length === 0 && <Text style={s.muted}>No previous payments found.</Text>}
              {data?.payments?.map((p) => (
                <View key={p.id} style={rdStyles.paymentCard}>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>{p.date}</Text>
                      <Text style={{ fontSize: 12, color: colors.muted }}>
                        Mode: {p.mode || 'UPI'} {p.transactionRef ? `· UTR: ${p.transactionRef}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.good }}>{money(p.amount)}</Text>
                      <TouchableOpacity
                        style={rdStyles.viewReceiptPill}
                        onPress={() => {
                          setSelectedReceipt(p);
                          setActiveModal('RECEIPT');
                        }}
                      >
                        <Ionicons name="receipt-outline" size={12} color="#2563eb" />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563eb' }}>Receipt</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 📄 DIGITAL RECEIPT MODAL */}
      <Modal visible={activeModal === 'RECEIPT'} transparent animationType="fade" onRequestClose={() => setActiveModal('PAYMENTS')}>
        <View style={s.overlay}>
          <View style={rdStyles.receiptSheet}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={rdStyles.receiptLogoWrap}>
                <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a', marginTop: 4 }}>
                {pg?.name || 'PG Management'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>Official Payment Receipt</Text>
            </View>

            <View style={rdStyles.receiptDivider} />

            <View style={rdStyles.receiptDetailRow}>
              <Text style={s.muted}>Receipt ID:</Text>
              <Text style={{ fontWeight: '700' }}>REC-{selectedReceipt?.id || '101'}</Text>
            </View>
            <View style={rdStyles.receiptDetailRow}>
              <Text style={s.muted}>Resident Name:</Text>
              <Text style={{ fontWeight: '700' }}>{me?.name || user?.username}</Text>
            </View>
            <View style={rdStyles.receiptDetailRow}>
              <Text style={s.muted}>Room & Bed:</Text>
              <Text style={{ fontWeight: '700' }}>{roomBedSummary || 'Standard'}</Text>
            </View>
            <View style={rdStyles.receiptDetailRow}>
              <Text style={s.muted}>Payment Date:</Text>
              <Text style={{ fontWeight: '700' }}>{selectedReceipt?.date || today()}</Text>
            </View>
            <View style={rdStyles.receiptDetailRow}>
              <Text style={s.muted}>Payment Mode:</Text>
              <Text style={{ fontWeight: '700' }}>{selectedReceipt?.mode || 'UPI'}</Text>
            </View>
            {selectedReceipt?.transactionRef ? (
              <View style={rdStyles.receiptDetailRow}>
                <Text style={s.muted}>UTR Reference:</Text>
                <Text style={{ fontWeight: '700' }}>{selectedReceipt.transactionRef}</Text>
              </View>
            ) : null}

            <View style={rdStyles.receiptDivider} />

            <View style={rdStyles.receiptDetailRow}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Amount Paid:</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.good }}>
                {money(selectedReceipt?.amount || 0)}
              </Text>
            </View>

            <TouchableOpacity
              style={[s.saveBtn, { marginTop: 16 }]}
              onPress={() => setActiveModal('PAYMENTS')}
            >
              <Text style={s.saveText}>Close Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                    <Badge text={c.category} color="#3b82f6" />
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
                      <Text style={{ fontSize: 12, color: '#166534', flex: 1 }}>{c.resolutionNotes}</Text>
                    </View>
                  ) : null}

                  <View style={[s.row, { marginTop: 8 }]}>
                    <Text style={{ fontSize: 11, color: colors.muted }}>Created: {c.createdAt}</Text>
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
                {(['Plumbing', 'Electrical', 'Wi-Fi', 'Cleaning', 'Food', 'Air Conditioning', 'Room Furniture', 'Other'] as const).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[rdStyles.catChip, cmpCategory === cat && rdStyles.catChipActive]}
                    onPress={() => setCmpCategory(cat)}
                  >
                    <Text style={[rdStyles.catChipText, cmpCategory === cat && rdStyles.catChipTextActive]}>{cat}</Text>
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

              <Text style={s.label}>Photo Attachment</Text>
              <TouchableOpacity
                style={rdStyles.photoBtn}
                onPress={() => {
                  setHasPhoto(!hasPhoto);
                  Alert.alert(hasPhoto ? 'Photo Removed' : 'Photo Attached', hasPhoto ? '' : 'Photo (bathroom_leakage.jpg) attached.');
                }}
              >
                <Ionicons name={hasPhoto ? 'checkmark-circle' : 'camera-outline'} size={18} color={hasPhoto ? '#16a34a' : colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: hasPhoto ? '#16a34a' : colors.primary }}>
                  {hasPhoto ? '1 Photo Attached (Tap to remove)' : 'Upload Issue Photo'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.saveBtn} onPress={handleSaveComplaint}>
                <Text style={s.saveText}>Submit Complaint</Text>
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

              <Text style={s.label}>Visit Date (YYYY-MM-DD)</Text>
              <TextInput style={s.input} value={visDate} onChangeText={setVisDate} />

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
              <Text style={s.label}>Start Date (YYYY-MM-DD) *</Text>
              <TextInput style={s.input} value={leaveStart} onChangeText={setLeaveStart} placeholder="YYYY-MM-DD" />

              <Text style={s.label}>End Date (YYYY-MM-DD) *</Text>
              <TextInput style={s.input} value={leaveEnd} onChangeText={setLeaveEnd} placeholder="YYYY-MM-DD" />

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
                    <Text style={{ fontSize: 11, color: colors.muted }}>Bed {me?.bedNumber || 'B-2'} (You)</Text>
                  </View>
                  <Badge text="Current User" color="#2563eb" />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 📢 NOTICES MODAL */}
      <Modal visible={activeModal === 'NOTICES'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveModal(null)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>PG Notices & Announcements</Text>
                <Text style={s.muted}>Updates and guidelines from management</Text>
              </View>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              {notices.map((n) => (
                <View key={n.id} style={rdStyles.noticeFullCard}>
                  <View style={s.row}>
                    <Badge text={n.category} color={n.important ? '#dc2626' : '#2563eb'} />
                    <Text style={{ fontSize: 11, color: colors.muted }}>{n.date}</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a', marginTop: 6 }}>{n.title}</Text>
                  <Text style={{ fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 18 }}>{n.content}</Text>
                </View>
              ))}
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
                <Text style={s.muted}>Direct contact with PG staff & emergency services</Text>
              </View>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody}>
              {/* Owner / Manager Contact */}
              <View style={rdStyles.contactCard}>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>
                      {pg?.name ? `${pg.name} Owner` : 'PG Owner / Manager'}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {pg?.ownerMobile ? `Phone: ${pg.ownerMobile}` : 'Front Desk & Escalations'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={rdStyles.callCircle}
                      onPress={() => handleCall(pg?.ownerMobile || '9876543210')}
                    >
                      <Ionicons name="call" size={16} color="#16a34a" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[rdStyles.callCircle, { backgroundColor: '#f0fdf4' }]}
                      onPress={() => handleWhatsApp(pg?.ownerMobile || '9876543210')}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color="#16a34a" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Warden / Caretaker */}
              <View style={rdStyles.contactCard}>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>PG Warden / Caretaker</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Available 24/7 at Ground Floor Desk</Text>
                  </View>
                  <TouchableOpacity
                    style={rdStyles.callCircle}
                    onPress={() => handleCall('9848011223')}
                  >
                    <Ionicons name="call" size={16} color="#16a34a" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Emergency Speed Dial */}
              <Text style={[s.h2, { marginTop: 16, marginBottom: 8 }]}>Emergency Numbers</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[rdStyles.emgBtn, { backgroundColor: '#fef2f2' }]}
                  onPress={() => handleCall('112')}
                >
                  <Ionicons name="shield-checkmark" size={20} color="#dc2626" />
                  <Text style={[rdStyles.emgText, { color: '#dc2626' }]}>Police & Emergency (112)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[rdStyles.emgBtn, { backgroundColor: '#eff6ff' }]}
                  onPress={() => handleCall('108')}
                >
                  <Ionicons name="medkit" size={20} color="#2563eb" />
                  <Text style={[rdStyles.emgText, { color: '#2563eb' }]}>Ambulance (108)</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const rdStyles = StyleSheet.create({
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
    borderLeftColor: '#3b82f6',
    marginBottom: 12,
  },
  dueAmount: { fontSize: 20, fontWeight: '900', marginTop: 2 },
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
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  noticeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: '#92400e', marginTop: 2 },
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridTile: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tileIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tileTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  tileSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
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
  noticeFullCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
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
});
