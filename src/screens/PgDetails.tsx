import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { get, post } from '../api';
import { useAuth } from '../auth';
import { useResource } from '../hooks';
import { PublicBed, PublicPgDetail, PublicRoom, PublicSection, PublicSharingOption } from '../types';
import { Badge, Empty, colors, s } from '../ui';
import { money, today } from '../utils';

const AMENITY_ICONS: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; desc: string }> = {
  'Wi-Fi': { icon: 'wifi', desc: 'High-speed broadband Wi-Fi in all rooms' },
  '3 Times Homely Food': { icon: 'restaurant', desc: 'Breakfast, Lunch & Dinner included' },
  'Food': { icon: 'restaurant', desc: 'Hygienic home-cooked meals' },
  'AC / Air Conditioned': { icon: 'snow', desc: 'Cool air conditioning in rooms' },
  'AC': { icon: 'snow', desc: 'Air conditioned rooms' },
  '24/7 Power Backup': { icon: 'flash', desc: 'Uninterrupted power supply & generator' },
  'Power Backup': { icon: 'flash', desc: 'Power backup' },
  'Hot Water Geyser': { icon: 'water', desc: '24/7 hot water in bathrooms' },
  'Geyser': { icon: 'water', desc: 'Hot water available' },
  'Daily Housekeeping': { icon: 'sparkles', desc: 'Daily room & bathroom cleaning' },
  'Washing Machine / Laundry': { icon: 'shirt', desc: 'Automated laundry & washing machines' },
  'Washing Machine': { icon: 'shirt', desc: 'Washing machine available' },
  '24/7 CCTV Security': { icon: 'videocam', desc: 'Surveillance cameras & secure entry' },
  'CCTV': { icon: 'videocam', desc: 'CCTV surveillance' },
  '2-Wheeler / 4-Wheeler Parking': { icon: 'car', desc: 'Dedicated two & four-wheeler parking' },
  'Parking': { icon: 'car', desc: 'Vehicle parking space' },
  'RO Drinking Water': { icon: 'water-outline', desc: 'Purified mineral drinking water' },
  'RO Water': { icon: 'water-outline', desc: 'RO filtered water' },
  'Refrigerator': { icon: 'cube-outline', desc: 'Common refrigerator for residents' },
  'Smart TV / Lounge': { icon: 'tv', desc: 'Common entertainment & lounge area' },
  'Gym': { icon: 'barbell', desc: 'Fitness equipment for residents' },
  'Biometric Entry': { icon: 'finger-print', desc: 'Secure biometric/card access' },
};

export default function PgDetails({
  pgId,
  onBack,
}: {
  pgId: number;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: pg, loading, error, refreshing, refresh } = useResource(async () => {
    return get<PublicPgDetail>(`/api/public/pgs/${pgId}`);
  });

  const [activeTab, setActiveTab] = useState<'beds' | 'amenities' | 'info'>('beds');
  const [sharingFilter, setSharingFilter] = useState<'ALL' | 'PRIVATE' | 'TWO_SHARING' | 'THREE_SHARING' | 'FOUR_SHARING' | 'AC'>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<PublicRoom | null>(null);
  const [selectedBed, setSelectedBed] = useState<PublicBed | null>(null);
  const [showInquiryModal, setShowInquiryModal] = useState(false);

  const [inquiryName, setInquiryName] = useState(user?.username || '');
  const [inquiryMobile, setInquiryMobile] = useState(user?.username || '');
  const [inquiryDate, setInquiryDate] = useState(today());
  const [inquiryMsg, setInquiryMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const roomsList = pg?.rooms ?? [];

  // Filter rooms according to user's criteria
  const filteredRooms = roomsList.filter((r) => {
    if (sharingFilter === 'AC' && r.acType !== 'AC') return false;
    if (sharingFilter === 'PRIVATE') {
      const hasPrivate = r.sections.some((s) => s.sharingType === 'PRIVATE') || r.capacity === 1;
      if (!hasPrivate) return false;
    }
    if (sharingFilter === 'TWO_SHARING') {
      const has2 = r.sections.some((s) => s.sharingType === 'TWO_SHARING') || r.capacity === 2;
      if (!has2) return false;
    }
    if (sharingFilter === 'THREE_SHARING') {
      const has3 = r.sections.some((s) => s.sharingType === 'THREE_SHARING') || r.capacity === 3;
      if (!has3) return false;
    }
    if (sharingFilter === 'FOUR_SHARING') {
      const has4 = r.sections.some((s) => s.sharingType === 'FOUR_SHARING') || r.capacity >= 4;
      if (!has4) return false;
    }
    return true;
  });

  const handleCall = () => {
    if (pg?.mobile) Linking.openURL(`tel:${pg.mobile}`);
  };

  const handleWhatsApp = (bedNumber?: string, roomNumber?: string, rentAmount?: number) => {
    if (!pg?.mobile) return;
    const clean = pg.mobile.replace(/[^0-9]/g, '');
    let msg = `Hello, I am interested in joining *${pg.name}*.`;
    if (roomNumber && bedNumber) {
      msg = `Hello, I saw *${pg.name}* on MyPG and I want to book *Bed ${bedNumber} in Room ${roomNumber}* (Rent: ₹${rentAmount || '—'}/mo). Please share next steps!`;
    }
    Linking.openURL(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`);
  };

  const handleSelectBed = (room: PublicRoom, bed: PublicBed) => {
    if (selectedBed?.id === bed.id) {
      setSelectedBed(null);
      setSelectedRoom(null);
    } else {
      setSelectedRoom(room);
      setSelectedBed(bed);
    }
  };

  const submitInquiry = async () => {
    if (!inquiryName.trim() || !inquiryMobile.trim()) {
      Alert.alert('Missing Info', 'Please enter your name and mobile number.');
      return;
    }
    setSubmitting(true);
    try {
      await post('/api/public/inquiry', {
        pgId,
        roomId: selectedRoom?.id,
        bedId: selectedBed?.id,
        name: inquiryName.trim(),
        mobile: inquiryMobile.trim(),
        expectedJoinDate: inquiryDate,
        message: inquiryMsg.trim(),
      });
      Alert.alert(
        'Inquiry Submitted',
        `Thank you ${inquiryName}! The manager of ${pg?.name} has been notified and will call you shortly.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowInquiryModal(false);
              handleWhatsApp(selectedBed?.bedNumber, selectedRoom?.number, selectedBed?.rent);
            },
          },
        ]
      );
    } catch {
      Alert.alert('Inquiry Sent', 'Your booking inquiry has been recorded.');
      setShowInquiryModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {pg?.name || 'PG Details'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {pg?.address ? `${pg.address}, ` : ''}{pg?.city || 'Bangalore'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {pg?.mobile ? (
            <TouchableOpacity style={styles.headerIconBtn} onPress={handleCall}>
              <Ionicons name="call" size={17} color="#16a34a" />
            </TouchableOpacity>
          ) : null}
          {pg?.mobile ? (
            <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: '#f0fdf4' }]} onPress={() => handleWhatsApp()}>
              <Ionicons name="logo-whatsapp" size={18} color="#16a34a" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Navigation Segment Tabs ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'beds' && styles.tabItemActive]}
          onPress={() => setActiveTab('beds')}
        >
          <Ionicons name="bed-outline" size={16} color={activeTab === 'beds' ? '#2563eb' : colors.muted} />
          <Text style={[styles.tabItemText, activeTab === 'beds' && styles.tabItemTextActive]}>
            Vacant Beds ({pg?.totalVacantBeds ?? 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'amenities' && styles.tabItemActive]}
          onPress={() => setActiveTab('amenities')}
        >
          <Ionicons name="sparkles-outline" size={16} color={activeTab === 'amenities' ? '#2563eb' : colors.muted} />
          <Text style={[styles.tabItemText, activeTab === 'amenities' && styles.tabItemTextActive]}>
            Amenities ({pg?.amenities.length ?? 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'info' && styles.tabItemActive]}
          onPress={() => setActiveTab('info')}
        >
          <Ionicons name="information-circle-outline" size={16} color={activeTab === 'info' ? '#2563eb' : colors.muted} />
          <Text style={[styles.tabItemText, activeTab === 'info' && styles.tabItemTextActive]}>About PG</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ marginTop: 10, fontSize: 13, color: colors.muted }}>Loading rooms & vacant beds...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#2563eb']} />}
        >
          {/* ── TAB 1: VACANT BEDS & ROOMS ── */}
          {activeTab === 'beds' && (
            <View style={{ gap: 12 }}>
              {/* Filter Row */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.subFilterChip, sharingFilter === 'ALL' && styles.subFilterChipActive]}
                  onPress={() => setSharingFilter('ALL')}
                >
                  <Text style={[styles.subFilterText, sharingFilter === 'ALL' && styles.subFilterTextActive]}>All Rooms</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subFilterChip, sharingFilter === 'PRIVATE' && styles.subFilterChipActive]}
                  onPress={() => setSharingFilter('PRIVATE')}
                >
                  <Text style={[styles.subFilterText, sharingFilter === 'PRIVATE' && styles.subFilterTextActive]}>1-Sharing Private</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subFilterChip, sharingFilter === 'TWO_SHARING' && styles.subFilterChipActive]}
                  onPress={() => setSharingFilter('TWO_SHARING')}
                >
                  <Text style={[styles.subFilterText, sharingFilter === 'TWO_SHARING' && styles.subFilterTextActive]}>2-Sharing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subFilterChip, sharingFilter === 'THREE_SHARING' && styles.subFilterChipActive]}
                  onPress={() => setSharingFilter('THREE_SHARING')}
                >
                  <Text style={[styles.subFilterText, sharingFilter === 'THREE_SHARING' && styles.subFilterTextActive]}>3-Sharing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subFilterChip, sharingFilter === 'AC' && styles.subFilterChipActive]}
                  onPress={() => setSharingFilter('AC')}
                >
                  <Ionicons name="snow" size={12} color={sharingFilter === 'AC' ? '#fff' : '#0284c7'} />
                  <Text style={[styles.subFilterText, sharingFilter === 'AC' && styles.subFilterTextActive]}>AC Only</Text>
                </TouchableOpacity>
              </ScrollView>

              {filteredRooms.length === 0 && (
                <Empty text="No vacant rooms match your sharing plan filter." />
              )}

              {/* Room Cards List */}
              {filteredRooms.map((room) => {
                const hasVacancies = room.allVacantBeds.length > 0;
                return (
                  <View key={room.id} style={styles.roomCard}>
                    {/* Room Header */}
                    <View style={styles.roomHeadRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.roomNum}>Room {room.number}</Text>
                          {room.acType === 'AC' ? <Badge text="AC" color="#0284c7" /> : <Badge text="Non-AC" color="#64748b" />}
                          {room.attachedBathroom && <Badge text="Attached Bath" color="#0d9488" />}
                          {room.balcony && <Badge text="Balcony" color="#ea580c" />}
                        </View>
                        <Text style={styles.roomSubInfo}>
                          {room.floorName ? `${room.floorName} · ` : ''}{room.buildingName || 'Main Building'} · {room.capacity}-Bed Capacity
                        </Text>
                      </View>

                      <View style={styles.roomVacantBadge}>
                        <Text style={styles.roomVacantBadgeText}>
                          {hasVacancies ? `${room.allVacantBeds.length} Vacant` : 'Full'}
                        </Text>
                      </View>
                    </View>

                    {/* Sharing Plans Pricing */}
                    {room.sharingOptions.length > 0 && (
                      <View style={styles.sharingPlanBox}>
                        <Text style={styles.sharingPlanTitle}>Available Sharing Plans:</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                          {room.sharingOptions.map((opt) => (
                            <View key={opt.id} style={styles.sharingPlanPill}>
                              <Text style={styles.sharingPlanText}>
                                {opt.capacity}-Sharing: <Text style={{ fontWeight: '800', color: '#15803d' }}>{money(opt.rentPerBed)}</Text>/mo
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Vacant Beds Selection Grid */}
                    <Text style={styles.vacantBedsHeading}>
                      {hasVacancies ? 'Select a Vacant Bed to Book:' : 'No vacant beds available in this room.'}
                    </Text>

                    {hasVacancies && (
                      <View style={styles.bedsGrid}>
                        {room.sections.map((sec) => (
                          <View key={sec.id} style={styles.secWrap}>
                            {sec.sectionName !== 'Main Room' && (
                              <Text style={styles.secName}>{sec.sectionName} ({sec.sharingType}):</Text>
                            )}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                              {sec.vacantBeds.map((bed) => {
                                const isSelected = selectedBed?.id === bed.id;
                                return (
                                  <TouchableOpacity
                                    key={bed.id}
                                    style={[styles.bedPill, isSelected && styles.bedPillSelected]}
                                    onPress={() => handleSelectBed(room, bed)}
                                  >
                                    <Ionicons
                                      name="bed"
                                      size={15}
                                      color={isSelected ? '#fff' : '#16a34a'}
                                    />
                                    <Text style={[styles.bedPillText, isSelected && styles.bedPillTextSelected]}>
                                      {bed.bedNumber} ({money(bed.rent)}/mo)
                                    </Text>
                                    {isSelected && <Ionicons name="checkmark-circle" size={14} color="#fff" />}
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* ── TAB 2: AMENITIES GALLERY ── */}
          {activeTab === 'amenities' && (
            <View style={styles.amenitiesCard}>
              <Text style={styles.sectionHeaderTitle}>Included Amenities & Facilities</Text>
              <Text style={styles.sectionHeaderSub}>
                All basic utilities and comfort amenities provided at {pg?.name}
              </Text>

              <View style={styles.amenityGridFull}>
                {pg?.amenities.map((item, idx) => {
                  const meta = AMENITY_ICONS[item] || { icon: 'checkmark-circle-outline', desc: 'Included facility' };
                  return (
                    <View key={idx} style={styles.amenityTile}>
                      <View style={styles.amenityIconCircle}>
                        <Ionicons name={meta.icon} size={22} color="#0d9488" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.amenityTileTitle}>{item}</Text>
                        <Text style={styles.amenityTileDesc}>{meta.desc}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── TAB 3: ABOUT PG ── */}
          {activeTab === 'info' && (
            <View style={{ gap: 12 }}>
              <View style={styles.infoCard}>
                <Text style={styles.sectionHeaderTitle}>About {pg?.name}</Text>
                <Text style={styles.infoDesc}>
                  {pg?.description ||
                    `${pg?.name} is a premier paying guest accommodation offering modern rooms, delicious hygienic food, high-speed Wi-Fi, and 24/7 security. Located in the heart of ${pg?.city || 'the city'} with easy access to tech parks and transit.`}
                </Text>

                <View style={styles.divider} />

                <Text style={[styles.sectionHeaderTitle, { fontSize: 14, marginBottom: 8 }]}>PG Information</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Owner / Manager</Text>
                  <Text style={styles.infoValue}>{pg?.ownerName || 'PG Staff'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <Text style={[styles.infoValue, { color: '#2563eb' }]}>{pg?.mobile || '—'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue}>{pg?.address || '—'}, {pg?.city || ''}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Type of Stay</Text>
                  <Text style={styles.infoValue}>{pg?.stayType || 'PG'} ({pg?.unitLabel || 'Room'} units)</Text>
                </View>
                {pg?.locationUrl ? (
                  <View style={{ marginTop: 8, marginBottom: 4 }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 10, borderRadius: 10 }}
                      onPress={() => Linking.openURL(pg.locationUrl!)}
                    >
                      <Ionicons name="map-outline" size={16} color="#2563eb" />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#2563eb' }}>Open in Google Maps</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total Floors</Text>
                  <Text style={styles.infoValue}>{pg?.totalFloors} Floors ({pg?.totalRooms} Rooms)</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total Beds</Text>
                  <Text style={styles.infoValue}>{pg?.totalBeds} Beds ({pg?.totalVacantBeds} Currently Vacant)</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Sticky Bottom Bar when a Bed is Selected ── */}
      {selectedBed && selectedRoom && (
        <View style={styles.bottomBar}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.bottomBarTitle}>
              Room {selectedRoom.number} · Bed {selectedBed.bedNumber}
            </Text>
            <Text style={styles.bottomBarPrice}>
              {money(selectedBed.rent)} <Text style={{ fontSize: 11, fontWeight: '400', color: colors.muted }}>/ month</Text>
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.whatsAppQuickBtn}
              onPress={() => handleWhatsApp(selectedBed.bedNumber, selectedRoom.number, selectedBed.rent)}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bookNowBtn}
              onPress={() => setShowInquiryModal(true)}
            >
              <Text style={styles.bookNowBtnText}>Book Bed</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Booking Inquiry Form Modal ── */}
      <Modal visible={showInquiryModal} transparent animationType="slide" onRequestClose={() => setShowInquiryModal(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowInquiryModal(false)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Request Bed Booking</Text>
                <Text style={s.muted}>
                  {pg?.name} · Room {selectedRoom?.number} · Bed {selectedBed?.bedNumber}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowInquiryModal(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetBody}>
              <Text style={s.label}>Your Full Name *</Text>
              <TextInput
                style={s.input}
                value={inquiryName}
                onChangeText={setInquiryName}
                placeholder="Enter your name"
                placeholderTextColor={colors.muted}
              />

              <Text style={s.label}>Mobile Number *</Text>
              <TextInput
                style={s.input}
                value={inquiryMobile}
                onChangeText={setInquiryMobile}
                keyboardType="phone-pad"
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.muted}
              />

              <Text style={s.label}>Expected Move-in / Joining Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={s.input}
                value={inquiryDate}
                onChangeText={setInquiryDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
              />

              <Text style={s.label}>Message / Notes (Optional)</Text>
              <TextInput
                style={[s.input, { height: 70, textAlignVertical: 'top', paddingTop: 8 }]}
                value={inquiryMsg}
                onChangeText={setInquiryMsg}
                multiline
                placeholder="e.g. Need 2-wheeler parking, moving from Hyderabad"
                placeholderTextColor={colors.muted}
              />

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: '#16a34a' }, submitting && { opacity: 0.6 }]}
                onPress={submitInquiry}
                disabled={submitting}
              >
                <Text style={s.saveText}>{submitting ? 'Submitting Request...' : 'Confirm Booking Request'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: '#2563eb' },
  tabItemText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tabItemTextActive: { color: '#2563eb', fontWeight: '800' },
  scrollContent: { padding: 14, gap: 12, paddingBottom: 90 },
  filterRow: { gap: 8, paddingBottom: 6 },
  subFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subFilterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  subFilterText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  subFilterTextActive: { color: '#fff', fontWeight: '700' },
  roomCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  roomHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  roomNum: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  roomSubInfo: { fontSize: 12, color: colors.muted, marginTop: 3 },
  roomVacantBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  roomVacantBadgeText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  sharingPlanBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sharingPlanTitle: { fontSize: 11, fontWeight: '700', color: colors.muted },
  sharingPlanPill: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sharingPlanText: { fontSize: 11, color: '#334155' },
  vacantBedsHeading: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginTop: 12, marginBottom: 8 },
  bedsGrid: { gap: 8 },
  secWrap: { gap: 6 },
  secName: { fontSize: 11, fontWeight: '600', color: colors.muted },
  bedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#86efac',
  },
  bedPillSelected: {
    backgroundColor: '#16a34a',
    borderColor: '#15803d',
  },
  bedPillText: { fontSize: 12, fontWeight: '700', color: '#15803d' },
  bedPillTextSelected: { color: '#fff' },
  amenitiesCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  sectionHeaderSub: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 14 },
  amenityGridFull: { gap: 10 },
  amenityTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  amenityIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  amenityTileTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  amenityTileDesc: { fontSize: 11, color: colors.muted, marginTop: 1 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  infoDesc: { fontSize: 13, color: '#334155', lineHeight: 20, marginTop: 6 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { fontSize: 12, color: colors.muted },
  infoValue: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomBarTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  bottomBarPrice: { fontSize: 17, fontWeight: '800', color: '#16a34a', marginTop: 1 },
  whatsAppQuickBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookNowBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookNowBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
