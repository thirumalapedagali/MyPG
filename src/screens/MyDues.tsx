import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { get, post } from '../api';
import { useAuth } from '../auth';
import { attempt, useResource } from '../hooks';
import { MyDuesData, Payment } from '../types';
import { DateField } from '../dateField';
import { Badge, Card, Screen, colors, s } from '../ui';
import { isDate, money, monthLabel, today } from '../utils';

/** The signed-in resident's own dues. The server resolves "me" from the login; no id is sent. */
export default function MyDues() {
  const { data, error, loading, refreshing, refresh } = useResource(() => get<MyDuesData>('/api/me/dues'));
  const me = data?.resident;
  const pg = data?.pg;

  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);

  const roomBedText = [
    me?.roomNumber ? `Room ${me.roomNumber}` : null,
    me?.sectionName && me.sectionName !== 'Main Room' ? me.sectionName : null,
    me?.bedNumber ? me.bedNumber : null,
  ].filter(Boolean).join(' · ');

  const handleOpenUpi = async () => {
    if (!pg?.upiId) {
      Alert.alert(
        'UPI ID Not Configured',
        `The owner of ${pg?.name || 'this PG'} has not set up a UPI ID yet. Please contact the owner at ${pg?.ownerMobile || 'the front desk'} for payment details.`
      );
      return;
    }
    const dueAmount = me?.due && me.due > 0 ? me.due : (me?.rent || 5000);
    const pgName = pg?.upiName || pg?.name || 'PG Management';
    const cleanUpi = pg.upiId.trim();
    const upiUrl = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(pgName)}&am=${dueAmount}&cu=INR&tn=${encodeURIComponent(`Rent for ${me?.name || 'Resident'}`)}`;

    try {
      const supported = await Linking.canOpenURL(upiUrl);
      if (supported) {
        await Linking.openURL(upiUrl);
      } else {
        await Linking.openURL(upiUrl);
      }
    } catch {
      Alert.alert(
        'UPI Payment',
        `Pay ₹${dueAmount} to UPI ID:\n\n${cleanUpi}\n(${pgName})\n\nAfter completing the payment in GPay, PhonePe or Paytm, you can tap the WhatsApp button to notify the owner.`,
        [
          { text: 'OK' },
        ]
      );
    }
  };

  const handleNotifyOwner = async () => {
    const digits = (pg?.ownerMobile || '').replace(/\D/g, '');
    if (!digits) {
      Alert.alert('Owner number not available', 'The owner has not added a mobile number yet.');
      return;
    }
    const amount = me && me.due > 0 ? me.due : (data?.payments[0]?.amount ?? me?.rent ?? 0);
    const month = monthLabel(today().slice(0, 7));
    const text =
      `Hi, I have paid ${money(amount)} for ${month} rent` +
      `${pg?.name ? ` at ${pg.name}` : ''}. ` +
      `- ${me?.name || 'Resident'}${roomBedText ? ` (${roomBedText})` : ''}. Please confirm.`;
    const phone = digits.length === 10 ? `91${digits}` : digits;
    try {
      await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
    } catch {
      Alert.alert('WhatsApp', 'Could not open WhatsApp on this device.');
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

    setSubmitting(true);
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
        Alert.alert(
          'Payment Recorded',
          `Thank you ${me?.name}! Your UPI payment of ₹${amt} has been recorded and the owner of ${pg?.name || 'your PG'} has been notified.`
        );
        setShowPayModal(false);
        setUtrNumber('');
        setPayNotes('');
        refresh();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title="My Dues"
      loading={loading}
      error={error && !error.toLowerCase().includes('resident profile') ? error : null}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {data && me ? (
        <>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={s.muted}>Hello, {me.name}</Text>
              {pg?.genderType ? (
                <Badge
                  text={pg.genderType === 'GENTS' ? 'Gents PG' : pg.genderType === 'LADIES' ? 'Ladies PG' : 'Co-Living PG'}
                  color={pg.genderType === 'GENTS' ? '#2563eb' : pg.genderType === 'LADIES' ? '#db2777' : '#0d9488'}
                />
              ) : null}
            </View>
            <Text style={s.h2}>{pg?.name ? `${pg.name} · ` : ''}{roomBedText || 'Room -'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <Text style={[s.statValue, { color: me.due ? colors.bad : colors.good }]}>
                {me.due ? `${money(me.due)} due` : 'No Dues'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {me.due > 0 && (
                  <TouchableOpacity
                    style={[upiStyles.iconBtn, { backgroundColor: '#16a34a' }]}
                    onPress={handleOpenUpi}
                    accessibilityLabel="Pay with UPI app"
                  >
                    <Ionicons name="card" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[upiStyles.iconBtn, { backgroundColor: '#25D366' }]}
                  onPress={handleNotifyOwner}
                  accessibilityLabel="Notify owner on WhatsApp"
                >
                  <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[s.muted, { marginTop: 4 }]}>
              Rent: {money(me.rent)}/mo · Billed {money(me.billed)} · Paid {money(me.paid)}
            </Text>
          </Card>

          {me.noticeStatus && (
            <Card style={{ backgroundColor: me.noticeStatus === 'REQUESTED' ? '#fffbeb' : '#f0fdf4', borderColor: me.noticeStatus === 'REQUESTED' ? '#fef3c7' : '#dcfce7' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons
                  name={me.noticeStatus === 'REQUESTED' ? 'time-outline' : 'checkmark-circle-outline'}
                  size={20}
                  color={me.noticeStatus === 'REQUESTED' ? '#d97706' : '#16a34a'}
                />
                <Text style={{ fontSize: 15, fontWeight: '700', color: me.noticeStatus === 'REQUESTED' ? '#b45309' : '#15803d' }}>
                  {me.noticeStatus === 'REQUESTED' ? 'Notice to Vacate Requested' : 'Notice Approved'}
                </Text>
              </View>
              <Text style={{ marginTop: 6, color: me.noticeStatus === 'REQUESTED' ? '#78350f' : '#166534', fontSize: 13, lineHeight: 18 }}>
                {me.noticeStatus === 'REQUESTED'
                  ? `You have requested to vacate on ${me.vacateOn}. Waiting for the owner to approve your request.`
                  : `Your request to vacate on ${me.vacateOn} has been approved. Your refundable deposit of ${money(me.returnedDeposit || 0)} will be returned by the owner on checkout.`}
              </Text>
            </Card>
          )}

          {/* ── Rental Agreement Attachment ── */}
          {me.attachmentUrl && (
            <Card style={{ marginTop: 14, padding: 14, borderLeftWidth: 4, borderLeftColor: colors.primary }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="document-text" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>Rental Agreement</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Signed agreement and files</Text>
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#ffffff',
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    borderRadius: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4
                  }}
                  onPress={() => me.attachmentUrl && Linking.openURL(me.attachmentUrl)}
                >
                  <Ionicons name="eye" size={14} color="#0f172a" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>View</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* ── Payments & Receipts ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
            <Text style={s.h2}>Payments & Receipts</Text>
          </View>

          {data.payments.length === 0 && <Text style={s.muted}>No payments yet.</Text>}
          {data.payments.map((p) => (
            <Card key={p.id}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: '#0f172a' }}>{p.date}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Badge text={p.mode || 'UPI'} color="#16a34a" />
                    {p.transactionRef ? (
                      <Text style={{ fontSize: 11, color: colors.muted }}>UTR: {p.transactionRef}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontWeight: '800', fontSize: 16, color: colors.good }}>{money(p.amount)}</Text>
                  <TouchableOpacity style={upiStyles.receiptPill} onPress={() => setReceipt(p)}>
                    <Ionicons name="receipt-outline" size={12} color={colors.primary} />
                    <Text style={upiStyles.receiptPillText}>Receipt</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))}

          {/* ── Digital Receipt ── */}
          <Modal visible={!!receipt} transparent animationType="fade" onRequestClose={() => setReceipt(null)}>
            <View style={s.overlay}>
              <View style={upiStyles.receiptSheet}>
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                  <View style={upiStyles.receiptLogoWrap}>
                    <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a', marginTop: 4 }}>
                    {pg?.name || 'PG Management'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Official Payment Receipt</Text>
                </View>
                <View style={upiStyles.receiptDivider} />
                <View style={upiStyles.receiptRow}>
                  <Text style={s.muted}>Receipt ID:</Text>
                  <Text style={{ fontWeight: '700' }}>REC-{receipt?.id}</Text>
                </View>
                <View style={upiStyles.receiptRow}>
                  <Text style={s.muted}>Resident Name:</Text>
                  <Text style={{ fontWeight: '700' }}>{me.name}</Text>
                </View>
                <View style={upiStyles.receiptRow}>
                  <Text style={s.muted}>Room & Bed:</Text>
                  <Text style={{ fontWeight: '700' }}>{roomBedText || 'Standard'}</Text>
                </View>
                <View style={upiStyles.receiptRow}>
                  <Text style={s.muted}>Payment Date:</Text>
                  <Text style={{ fontWeight: '700' }}>{receipt?.date}</Text>
                </View>
                <View style={upiStyles.receiptRow}>
                  <Text style={s.muted}>Payment Mode:</Text>
                  <Text style={{ fontWeight: '700' }}>{receipt?.mode || 'UPI'}</Text>
                </View>
                {receipt?.transactionRef ? (
                  <View style={upiStyles.receiptRow}>
                    <Text style={s.muted}>UTR Reference:</Text>
                    <Text style={{ fontWeight: '700' }}>{receipt.transactionRef}</Text>
                  </View>
                ) : null}
                <View style={upiStyles.receiptDivider} />
                <View style={upiStyles.receiptRow}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Amount Paid:</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: colors.good }}>{money(receipt?.amount || 0)}</Text>
                </View>
                <TouchableOpacity style={[s.saveBtn, { marginTop: 16 }]} onPress={() => setReceipt(null)}>
                  <Text style={s.saveText}>Close Receipt</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* ── UPI Payment Confirmation Modal ── */}
          <Modal visible={showPayModal} transparent animationType="slide" onRequestClose={() => setShowPayModal(false)}>
            <View style={s.overlay}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPayModal(false)} />
              <View style={s.sheet}>
                <View style={s.handle} />
                <View style={s.sheetHeader}>
                  <View>
                    <Text style={s.sheetTitle}>Confirm UPI Payment</Text>
                    <Text style={s.muted}>Notify {pg?.name || 'PG Owner'} about your payment</Text>
                  </View>
                  <Pressable onPress={() => setShowPayModal(false)} hitSlop={10}>
                    <Ionicons name="close" size={22} color={colors.muted} />
                  </Pressable>
                </View>

                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetBody}>
                  {pg?.upiId ? (
                    <View style={upiStyles.upiNotice}>
                      <Ionicons name="information-circle" size={18} color="#2563eb" />
                      <Text style={upiStyles.upiNoticeText}>
                        PG UPI ID: <Text style={{ fontWeight: '800' }}>{pg.upiId}</Text>
                        {pg.upiName ? ` (${pg.upiName})` : ''}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={s.label}>Amount Paid (₹) *</Text>
                  <TextInput
                    style={s.input}
                    value={payAmount}
                    onChangeText={setPayAmount}
                    keyboardType="number-pad"
                    placeholder="e.g. 6000"
                    placeholderTextColor={colors.muted}
                  />

                  <Text style={s.label}>UPI Transaction / UTR Number</Text>
                  <TextInput
                    style={s.input}
                    value={utrNumber}
                    onChangeText={setUtrNumber}
                    placeholder="e.g. 12-digit UTR from GPay / PhonePe"
                    placeholderTextColor={colors.muted}
                  />

                  <Text style={s.label}>Payment Date *</Text>
                  <DateField value={payDate} onChange={setPayDate} max={today()} />

                  <Text style={s.label}>Notes / Remarks (Optional)</Text>
                  <TextInput
                    style={s.input}
                    value={payNotes}
                    onChangeText={setPayNotes}
                    placeholder="e.g. Paid for November rent"
                    placeholderTextColor={colors.muted}
                  />

                  <Pressable
                    style={[s.saveBtn, { backgroundColor: '#16a34a' }, submitting && { opacity: 0.6 }]}
                    onPress={handleRecordPayment}
                    disabled={submitting}
                  >
                    <Text style={s.saveText}>{submitting ? 'Submitting...' : 'Submit & Notify Owner'}</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </>
      ) : !loading && (
        <Card>
          <Text style={[s.h2, { marginBottom: 6 }]}>No Active Room Allocation</Text>
          <Text style={[s.muted, { lineHeight: 20 }]}>
            You do not have a room assigned yet. Once a PG manager approves your booking and assigns a bed, your monthly dues and payment receipts will be displayed here.
          </Text>
          <Text style={[s.muted, { marginTop: 10, lineHeight: 20 }]}>
            Tip: Switch to the <Text style={{ fontWeight: '700', color: colors.primary }}>Explore</Text> tab to discover verified stays and view availability!
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const upiStyles = StyleSheet.create({
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
  },
  receiptPillText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  receiptSheet: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
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
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  recordLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recordLinkText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  upiNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 14,
  },
  upiNoticeText: { fontSize: 12, color: '#1e40af', flex: 1 },
});
