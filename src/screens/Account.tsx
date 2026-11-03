import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { get, post, put } from '../api';
import { useAuth } from '../auth';
import { attempt } from '../hooks';
import { WhatsappConfig } from '../types';
import { Button, Card, FormModal, HeaderAction, Screen, colors, s } from '../ui';

const ROLE_LABEL = { SUPER_ADMIN: 'Super admin', OWNER: 'Owner', MANAGER: 'Manager', RESIDENT: 'Resident' } as const;

/** Old + new password form shared by the Account screen and the forced first-login gate. */
function ChangePasswordForm({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone?: () => void }) {
  const { changePassword } = useAuth();
  return (
    <FormModal
      visible={visible}
      title="Change password"
      fields={[
        { key: 'old', label: 'Current password', secure: true },
        { key: 'next', label: 'New password (min 8 characters)', secure: true },
        { key: 'again', label: 'Repeat new password', secure: true },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        if (v.next.length < 8) {
          Alert.alert('Too short', 'Use at least 8 characters.');
          return false;
        }
        if (v.next !== v.again) {
          Alert.alert('Mismatch', 'The new passwords do not match.');
          return false;
        }
        if (!(await attempt(() => changePassword(v.old, v.next)))) return false;
        onClose();
        Alert.alert('Done', 'Your password was updated.');
        onDone?.();
      }}
    />
  );
}

/** Modal to configure WhatsApp Cloud API settings and notification preferences. */
function WhatsappSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [apiVersion, setApiVersion] = useState('v22.0');
  const [hasToken, setHasToken] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [notifyOnPayment, setNotifyOnPayment] = useState(true);
  const [notifyOnDueReminder, setNotifyOnDueReminder] = useState(true);
  const [notifyOnOnboarding, setNotifyOnOnboarding] = useState(true);
  const [notifyOnMove, setNotifyOnMove] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    get<WhatsappConfig>('/api/notification-config/whatsapp')
      .then((cfg) => {
        if (!active) return;
        if (cfg) {
          setPhoneNumberId(cfg.phoneNumberId || '');
          setWabaId(cfg.wabaId || '');
          setApiVersion(cfg.apiVersion || 'v22.0');
          setHasToken(!!cfg.hasAccessToken);
          setEnabled(!!cfg.enabled);
          setNotifyOnPayment(cfg.notifyOnPayment ?? true);
          setNotifyOnDueReminder(cfg.notifyOnDueReminder ?? true);
          setNotifyOnOnboarding(cfg.notifyOnOnboarding ?? true);
          setNotifyOnMove(cfg.notifyOnMove ?? true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await attempt(() =>
      put('/api/notification-config/whatsapp', {
        phoneNumberId,
        wabaId,
        apiVersion,
        accessToken: accessToken ? accessToken : undefined,
        enabled,
        notifyOnPayment,
        notifyOnDueReminder,
        notifyOnOnboarding,
        notifyOnMove,
      }),
    );
    setSaving(false);
    if (ok) {
      Alert.alert('Saved', 'WhatsApp notification configuration updated successfully.');
      onClose();
    }
  };

  const handleTest = async () => {
    if (!testPhone.trim()) {
      Alert.alert('Test Phone Required', 'Enter a 10-digit mobile number to send a test message.');
      return;
    }
    setTesting(true);
    const ok = await attempt(() => post(`/api/notification-config/whatsapp/test?testPhone=${encodeURIComponent(testPhone.trim())}`));
    setTesting(false);
    if (ok) {
      Alert.alert('Test Sent', `Test WhatsApp message sent to ${testPhone.trim()}. Check the recipient's phone.`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>WhatsApp Notifications</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 18, color: colors.muted, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
          ) : (
            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Enable WhatsApp Cloud API</Text>
                  <Text style={styles.toggleSub}>Send automated receipts & dues notifications</Text>
                </View>
                <Switch value={enabled} onValueChange={setEnabled} trackColor={{ true: '#16a34a' }} />
              </View>

              <Text style={styles.fieldLabel}>Phone Number ID *</Text>
              <TextInput
                style={styles.input}
                value={phoneNumberId}
                onChangeText={setPhoneNumberId}
                placeholder="e.g. 104829104812345"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>WhatsApp Business Account ID (WABA ID)</Text>
              <TextInput
                style={styles.input}
                value={wabaId}
                onChangeText={setWabaId}
                placeholder="e.g. 109827346152345 (optional)"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>
                Access Token {hasToken ? '(leave blank to keep existing)' : '*'}
              </Text>
              <TextInput
                style={styles.input}
                value={accessToken}
                onChangeText={setAccessToken}
                placeholder={hasToken ? '••••••••••••••••••••••••' : 'Meta Cloud API access token'}
                secureTextEntry
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>API Version</Text>
              <TextInput
                style={styles.input}
                value={apiVersion}
                onChangeText={setApiVersion}
                placeholder="v22.0"
                autoCapitalize="none"
              />

              <Text style={[styles.sectionHeading, { marginTop: 14 }]}>Notification Triggers</Text>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Payment Receipts</Text>
                <Switch value={notifyOnPayment} onValueChange={setNotifyOnPayment} trackColor={{ true: '#16a34a' }} />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Payment Due Reminders</Text>
                <Switch value={notifyOnDueReminder} onValueChange={setNotifyOnDueReminder} trackColor={{ true: '#16a34a' }} />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Resident Welcome / Check-in</Text>
                <Switch value={notifyOnOnboarding} onValueChange={setNotifyOnOnboarding} trackColor={{ true: '#16a34a' }} />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Room Shift / Relocation</Text>
                <Switch value={notifyOnMove} onValueChange={setNotifyOnMove} trackColor={{ true: '#16a34a' }} />
              </View>

              <Text style={[styles.sectionHeading, { marginTop: 14 }]}>Send Test Message</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={testPhone}
                  onChangeText={setTestPhone}
                  placeholder="10-digit mobile number"
                  keyboardType="phone-pad"
                />
                <Button label={testing ? 'Testing...' : 'Test'} onPress={testing ? () => {} : handleTest} />
              </View>

              <View style={{ height: 16 }} />
              <Button label={saving ? 'Saving...' : 'Save Configuration'} onPress={saving ? () => {} : handleSave} />
              <View style={{ height: 8 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Shown instead of the app while the server says this login must pick a new password. */
export function MustChangePassword() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <Screen title="Set a new password" action={<HeaderAction label="Log out" icon="log-out-outline" onPress={logout} />}>
      <Card>
        <Text style={s.h2}>Welcome, {user?.username}</Text>
        <Text style={[s.muted, { marginVertical: 8 }]}>
          Your password was set by an administrator. Choose your own password to continue.
        </Text>
        <Button label="Choose new password" onPress={() => setOpen(true)} />
      </Card>
      <ChangePasswordForm visible={open} onClose={() => setOpen(false)} />
    </Screen>
  );
}

function PgProfileSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [stayType, setStayType] = useState<'APARTMENT' | 'PG' | 'HOSTEL' | 'COLIVING' | 'STUDIO'>('APARTMENT');
  const [unitLabel, setUnitLabel] = useState('Flat');
  const [locationUrl, setLocationUrl] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [genderType, setGenderType] = useState<'GENTS' | 'LADIES' | 'CO_LIVING'>('CO_LIVING');
  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');
  const [startingPrice, setStartingPrice] = useState('5000');
  const [description, setDescription] = useState('');
  const [amenities, setAmenities] = useState('Lift, Bike Parking, Watchman, Wi-Fi');
  const [customAmenity, setCustomAmenity] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    get<any>('/api/pg/profile')
      .then((p) => {
        if (p) {
          setName(p.name || '');
          setStayType(
            p.stayType === 'APARTMENT' || p.stayType === 'HOSTEL' || p.stayType === 'COLIVING' || p.stayType === 'STUDIO'
              ? p.stayType
              : 'PG'
          );
          setUnitLabel(p.unitLabel || (p.stayType === 'APARTMENT' ? 'Flat' : p.stayType === 'HOSTEL' ? 'Dorm' : 'Room'));
          setLocationUrl(p.locationUrl || '');
          setOwnerName(p.ownerName || '');
          setMobile(p.mobile || '');
          setEmail(p.email || '');
          setAddress(p.address || '');
          setCity(p.city || '');
          setState(p.state || '');
          setGenderType(
            p.genderType === 'GENTS' || p.genderType === 'LADIES' ? p.genderType : 'CO_LIVING'
          );
          setUpiId(p.upiId || '');
          setUpiName(p.upiName || '');
          setStartingPrice(p.startingPrice ? String(p.startingPrice) : '5000');
          setDescription(p.description || '');
          setAmenities(p.amenities || 'Lift, Bike Parking, Watchman, Wi-Fi');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter PG Name.');
      return;
    }
    setSaving(true);
    try {
      const ok = await attempt(() =>
        put('/api/pg/profile', {
          name: name.trim(),
          stayType,
          unitLabel: unitLabel.trim() || (stayType === 'APARTMENT' ? 'Flat' : stayType === 'HOSTEL' ? 'Dorm' : 'Room'),
          locationUrl: locationUrl.trim() || undefined,
          ownerName: ownerName.trim() || undefined,
          mobile: mobile.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          genderType,
          upiId: upiId.trim() || undefined,
          upiName: upiName.trim() || undefined,
          startingPrice: parseFloat(startingPrice) || 5000,
          description: description.trim() || undefined,
          amenities: amenities.trim() || undefined,
        })
      );
      if (ok) {
        Alert.alert('Saved', 'PG Profile & UPI settings updated successfully.');
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>PG Profile & UPI Settings</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>PG Type, Payment UPI ID & Details</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={{ fontSize: 20, color: colors.muted, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 30 }} size="large" color={colors.primary} />
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.inputLabel}>Property / Stay Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Siri Apartments / Siri PG" />

              {/* ── STAY TYPE (APARTMENT / PG / HOSTEL / COLIVING) ── */}
              <Text style={styles.inputLabel}>Type of Stay *</Text>
              <View style={pgSettingsStyles.typeRow}>
                {(['APARTMENT', 'PG', 'HOSTEL', 'COLIVING', 'STUDIO'] as const).map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[pgSettingsStyles.typeBtn, stayType === st && pgSettingsStyles.typeBtnActive]}
                    onPress={() => {
                      setStayType(st);
                      setUnitLabel(st === 'APARTMENT' ? 'Flat' : st === 'HOSTEL' ? 'Dorm' : 'Room');
                    }}
                  >
                    <Text style={[pgSettingsStyles.typeBtnText, stayType === st && pgSettingsStyles.typeBtnTextActive]}>
                      {st === 'APARTMENT' ? '🏢 Apartment' : st === 'PG' ? '🏠 PG' : st === 'HOSTEL' ? '🛏️ Hostel' : st === 'COLIVING' ? '🤝 Co-Living' : '🛋️ Studio'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Unit Label (e.g. Flat, Room, Dorm)</Text>
              <TextInput
                style={styles.input}
                value={unitLabel}
                onChangeText={setUnitLabel}
                placeholder="e.g. Flat, Room, Dorm"
              />

              {/* ── LOCATION URL ── */}
              <Text style={styles.inputLabel}>Map / Google Location URL</Text>
              <TextInput
                style={styles.input}
                value={locationUrl}
                onChangeText={setLocationUrl}
                autoCapitalize="none"
                placeholder="e.g. https://maps.app.goo.gl/..."
              />

              {/* ── OCCUPANCY POLICY (Gents / Ladies / Co-Living) ── */}
              <Text style={styles.inputLabel}>Occupancy Policy *</Text>
              <View style={pgSettingsStyles.typeRow}>
                {(['CO_LIVING', 'GENTS', 'LADIES'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[pgSettingsStyles.typeBtn, genderType === t && pgSettingsStyles.typeBtnActive]}
                    onPress={() => setGenderType(t)}
                  >
                    <Text style={[pgSettingsStyles.typeBtnText, genderType === t && pgSettingsStyles.typeBtnTextActive]}>
                      {t === 'GENTS' ? '👨 Gents' : t === 'LADIES' ? '👩 Ladies' : '👫 Co-Living / Unisex'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── DYNAMIC AMENITIES ── */}
              <Text style={styles.inputLabel}>Property Amenities (Configurable)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {['Lift', 'Bike Parking', 'Car Parking', 'Watchman', 'Wi-Fi', 'Power Backup', 'RO Drinking Water', 'Washing Machine', 'CCTV Security', 'Geyser', 'Daily Cleaning', 'Food / Mess', 'Gym', 'Swimming Pool'].map((amenity) => {
                  const currentList = amenities.split(',').map((a) => a.trim()).filter(Boolean);
                  const isSelected = currentList.includes(amenity);
                  return (
                    <TouchableOpacity
                      key={amenity}
                      style={[
                        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
                        isSelected && { backgroundColor: '#2563eb', borderColor: '#2563eb' },
                      ]}
                      onPress={() => {
                        let next: string[];
                        if (isSelected) {
                          next = currentList.filter((a) => a !== amenity);
                        } else {
                          next = [...currentList, amenity];
                        }
                        setAmenities(next.join(', '));
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#fff' : '#334155' }}>
                        {isSelected ? '✓ ' : '+ '}{amenity}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Add custom amenity */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={customAmenity}
                  onChangeText={setCustomAmenity}
                  placeholder="Add custom amenity (e.g. Garden)"
                />
                <Button
                  small
                  label="Add"
                  onPress={() => {
                    if (customAmenity.trim()) {
                      const currentList = amenities.split(',').map((a) => a.trim()).filter(Boolean);
                      if (!currentList.includes(customAmenity.trim())) {
                        setAmenities([...currentList, customAmenity.trim()].join(', '));
                      }
                      setCustomAmenity('');
                    }
                  }}
                />
              </View>

              {/* ── UPI PAYMENT ID ── */}
              <View style={pgSettingsStyles.upiSection}>
                <Text style={[styles.inputLabel, { color: '#16a34a', fontWeight: '800' }]}>
                  ⚡ UPI ID for Rent Collections *
                </Text>
                <TextInput
                  style={[styles.input, { borderColor: '#86efac', backgroundColor: '#f0fdf4' }]}
                  value={upiId}
                  onChangeText={setUpiId}
                  autoCapitalize="none"
                  placeholder="e.g. 9876543210@paytm or balaji@okaxis"
                />
                <Text style={{ fontSize: 11, color: '#15803d', marginTop: -4, marginBottom: 10 }}>
                  Residents will click this link to open GPay, PhonePe or Paytm to pay you directly.
                </Text>

                <Text style={styles.inputLabel}>UPI Account Name (Payee Name)</Text>
                <TextInput
                  style={styles.input}
                  value={upiName}
                  onChangeText={setUpiName}
                  placeholder="e.g. Balaji PG / Owner Name"
                />
              </View>

              <Text style={styles.inputLabel}>Owner / Contact Mobile</Text>
              <TextInput style={styles.input} value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />

              <Text style={styles.inputLabel}>Starting Monthly Rent (₹)</Text>
              <TextInput style={styles.input} value={startingPrice} onChangeText={setStartingPrice} keyboardType="number-pad" />

              <Text style={styles.inputLabel}>Address & Area</Text>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="e.g. #42, 5th Cross, HSR Layout" />

              <Text style={styles.inputLabel}>City</Text>
              <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Bangalore" />

              <Text style={styles.inputLabel}>Description (Overview for residents)</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Homely food, high-speed Wi-Fi, daily cleaning..."
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#16a34a' }, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save PG Profile & UPI Details</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function Account() {
  const { user, logout } = useAuth();
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const [open, setOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [pgProfileOpen, setPgProfileOpen] = useState(false);
  if (!user) return null;

  const canManageStaff = (user.role === 'OWNER' || user.role === 'SUPER_ADMIN') && user.pgId !== null;
  const canManagePg = (user.role === 'OWNER' || user.role === 'MANAGER' || user.role === 'SUPER_ADMIN') && user.pgId !== null;
  const confirmLogout = () =>
    Alert.alert('Log out', 'Log out of My PG?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);

  return (
    <Screen title="Account">
      <Card>
        <Text style={s.h2}>{user.username}</Text>
        <Text style={s.muted}>
          {ROLE_LABEL[user.role]}
          {user.pgName ? ` · ${user.pgName}` : ''}
        </Text>
      </Card>
      <View style={{ gap: 10 }}>
        {canManagePg && (
          <Button
            label="PG Profile & UPI Settings"
            onPress={() => setPgProfileOpen(true)}
          />
        )}
        {canManageStaff && <Button label="Manage users" onPress={() => nav.navigate('Users')} />}
        {canManagePg && (
          <Button
            label="WhatsApp Notifications"
            onPress={() => setWhatsappOpen(true)}
          />
        )}
        {user.role === 'SUPER_ADMIN' && <Button label="Manage PGs" onPress={() => nav.navigate('Pgs')} />}
        <Button kind="ghost" label="Change password" onPress={() => setOpen(true)} />
        <Button kind="danger" label="Log out" onPress={confirmLogout} />
      </View>
      <ChangePasswordForm visible={open} onClose={() => setOpen(false)} />
      <WhatsappSettingsModal visible={whatsappOpen} onClose={() => setWhatsappOpen(false)} />
      <PgProfileSettingsModal visible={pgProfileOpen} onClose={() => setPgProfileOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  toggleSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
    marginBottom: 4,
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});

const pgSettingsStyles = StyleSheet.create({
  typeRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  typeBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  typeBtnText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  typeBtnTextActive: { color: '#2563eb', fontWeight: '800' },
  upiSection: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
});
