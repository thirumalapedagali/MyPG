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
import { MyDuesData } from '../types';
import { Badge, Card, Empty, HeaderAction, Screen, colors, s } from '../ui';
import { isDate, money, today } from '../utils';

/** The signed-in resident's own dues. The server resolves "me" from the login; no id is sent. */
export default function MyDues() {
  const { logout } = useAuth();
  const { data, error, loading, refreshing, refresh } = useResource(() => get<MyDuesData>('/api/me/dues'));
  const me = data?.resident;
  const pg = data?.pg;

  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        `Pay ₹${dueAmount} to UPI ID:\n\n${cleanUpi}\n(${pgName})\n\nAfter completing the payment in GPay, PhonePe or Paytm, tap "Record / Confirm Payment" below to notify the owner.`,
        [
          {
            text: 'Record Payment',
            onPress: () => {
              setPayAmount(String(dueAmount));
              setShowPayModal(true);
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
      action={<HeaderAction label="Log out" icon="log-out-outline" onPress={logout} />}
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
            <Text style={[s.statValue, { color: me.due ? colors.bad : colors.good, marginTop: 10 }]}>
              {me.due ? `${money(me.due)} due` : 'All paid up'}
            </Text>
            <Text style={[s.muted, { marginTop: 4 }]}>
              Rent: {money(me.rent)}/mo · Billed {money(me.billed)} · Paid {money(me.paid)}
            </Text>
          </Card>

          {/* ── UPI Payment Actions ── */}
          {me.due > 0 && (
            <View style={upiStyles.payCard}>
              <View style={upiStyles.payTopRow}>
                <View style={upiStyles.upiIconWrap}>
                  <Ionicons name="flash" size={20} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={upiStyles.payTitle}>Pay Outstanding Rent via UPI</Text>
                  <Text style={upiStyles.paySub}>
                    {pg?.upiId ? `Pay to: ${pg.upiId}` : 'Pay instantly using any UPI app'}
                  </Text>
                </View>
              </View>

              <View style={upiStyles.payActions}>
                <TouchableOpacity style={upiStyles.upiPayBtn} onPress={handleOpenUpi}>
                  <Ionicons name="card" size={16} color="#fff" />
                  <Text style={upiStyles.upiPayBtnText}>Pay {money(me.due)} (UPI)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={upiStyles.confirmBtn}
                  onPress={() => {
                    setPayAmount(String(me.due));
                    setShowPayModal(true);
                  }}
                >
                  <Ionicons name="checkmark-done" size={16} color="#0f172a" />
                  <Text style={upiStyles.confirmBtnText}>I have Paid / Enter UTR</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Payment History ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
            <Text style={s.h2}>Payment history</Text>
            <TouchableOpacity
              onPress={() => {
                setPayAmount(String(me.due > 0 ? me.due : me.rent));
                setShowPayModal(true);
              }}
              style={upiStyles.recordLink}
            >
              <Ionicons name="add-circle-outline" size={15} color={colors.primary} />
              <Text style={upiStyles.recordLinkText}>Record Payment</Text>
            </TouchableOpacity>
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
                <Text style={{ fontWeight: '800', fontSize: 16, color: colors.good }}>{money(p.amount)}</Text>
              </View>
            </Card>
          ))}

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

                  <Text style={s.label}>Payment Date (YYYY-MM-DD) *</Text>
                  <TextInput
                    style={s.input}
                    value={payDate}
                    onChangeText={setPayDate}
                    placeholderTextColor={colors.muted}
                  />

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
            Tip: Switch to the <Text style={{ fontWeight: '700', color: colors.primary }}>Explore</Text> tab to discover verified PGs and view available beds!
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const upiStyles = StyleSheet.create({
  payCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  payTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  upiIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  payTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  paySub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  payActions: { flexDirection: 'row', gap: 8 },
  upiPayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    borderRadius: 10,
  },
  upiPayBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  confirmBtnText: { color: '#0f172a', fontSize: 12, fontWeight: '700' },
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
