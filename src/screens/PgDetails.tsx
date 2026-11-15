import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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
import { DateField } from '../dateField';
import { useResource } from '../hooks';
import { ImageGallery } from '../images';
import { PublicBed, PublicPgDetail, PublicRoom } from '../types';
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
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<PublicRoom | null>(null);
  const [selectedBed, setSelectedBed] = useState<PublicBed | null>(null);
  const [expandedRoomId, setExpandedRoomId] = useState<PublicRoom['id'] | null>(null);
  const [showInquiryModal, setShowInquiryModal] = useState(false);

  const [inquiryName, setInquiryName] = useState(user?.username || '');
  const [inquiryMobile, setInquiryMobile] = useState(user?.username || '');
  const [inquiryDate, setInquiryDate] = useState(today());
  const [inquiryMsg, setInquiryMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const roomsList = pg?.rooms ?? [];
  const isApartment = pg?.stayType === 'APARTMENT';

  // Ground + every floor the property has (even if nothing is vacant there), plus any other floor named on a room.
  // A room without a floor is on the Ground Floor.
  const floorOf = (r: PublicRoom) => r.floorName?.trim() || 'Ground Floor';
  const floorRank = (name: string) => (/^ground/i.test(name) ? 0 : parseInt(name, 10) || Number.MAX_SAFE_INTEGER);
  const ordinal = (i: number) => `${i}${i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'} Floor`;
  const floors = [
    ...new Set([
      'Ground Floor',
      ...Array.from({ length: pg?.totalFloors && pg.totalFloors > 0 ? pg.totalFloors : 0 }, (_, i) => ordinal(i + 1)),
      ...roomsList.map(floorOf),
    ]),
  ].sort((a, b) => floorRank(a) - floorRank(b) || a.localeCompare(b));
  const floorLabel = (name: string) => (/^ground/i.test(name) ? 'G' : name.replace(/\s*floor\s*/i, '').trim() || name);

  // Filter rooms according to user's criteria
  const filteredRooms = roomsList.filter((r) => {
    if (floorFilter !== 'ALL' && floorOf(r) !== floorFilter) return false;
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
      msg = `Hello, I saw *${pg.name}* on MyStay and I want to book *Bed ${bedNumber} in Room ${roomNumber}* (Rent: ₹${rentAmount || '—'}/mo). Please share next steps!`;
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
      // A bed that is still occupied can only be joined once the current resident leaves.
      setInquiryDate(bed.availableFrom && bed.availableFrom > today() ? bed.availableFrom : today());
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

      {/* ── Property summary ── */}
      {pg && (
        <View style={styles.propertySummary}>
          <View style={styles.summaryLocationRow}>
            <View style={styles.summaryPin}>
              <Ionicons name="location-outline" size={17} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryAddress} numberOfLines={2}>
                {[pg.address, pg.city].filter(Boolean).join(', ') || 'Location not provided'}
              </Text>
              <Text style={styles.summaryType}>{pg.stayType || 'PG'} accommodation</Text>
            </View>
            {pg.locationUrl ? (
              <TouchableOpacity style={styles.mapIconButton} onPress={() => Linking.openURL(pg.locationUrl!)}>
                <Ionicons name="navigate-outline" size={18} color="#2563eb" />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryNumber}>{pg.totalRooms ?? 0}</Text>
              <Text style={styles.summaryLabel}>{isApartment ? 'Flats' : 'Rooms'}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryNumber}>{pg.totalBeds ?? 0}</Text>
              <Text style={styles.summaryLabel}>{isApartment ? 'Units' : 'Total beds'}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryNumber, { color: '#15803d' }]}>{pg.totalVacantBeds ?? 0}</Text>
              <Text style={styles.summaryLabel}>Available</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Navigation Segment Tabs ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'beds' && styles.tabItemActive]}
          onPress={() => setActiveTab('beds')}
        >
          <Ionicons name="bed-outline" size={16} color={activeTab === 'beds' ? '#2563eb' : colors.muted} />
          <Text style={[styles.tabItemText, activeTab === 'beds' && styles.tabItemTextActive]}>
            {isApartment ? 'Available Flats' : 'Available Beds'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'amenities' && styles.tabItemActive]}
          onPress={() => setActiveTab('amenities')}
        >
          <Ionicons name="sparkles-outline" size={16} color={activeTab === 'amenities' ? '#2563eb' : colors.muted} />
          <Text style={[styles.tabItemText, activeTab === 'amenities' && styles.tabItemTextActive]}>
            Amenities
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
          {pg?.images && pg.images.length > 0 && activeTab !== 'amenities' ? (
            <View style={{ marginBottom: 12 }}>
              <ImageGallery images={pg.images} height={156} />
            </View>
          ) : null}

          {/* ── TAB 1: VACANT BEDS & ROOMS ── */}
          {activeTab === 'beds' && (
            <View style={{ gap: 12 }}>
              {/* Floor filter */}
              {floors.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  <TouchableOpacity
                    style={[styles.subFilterChip, floorFilter === 'ALL' && styles.subFilterChipActive]}
                    onPress={() => setFloorFilter('ALL')}
                  >
                    <Ionicons name="layers-outline" size={12} color={floorFilter === 'ALL' ? '#fff' : '#64748b'} />
                    <Text style={[styles.subFilterText, floorFilter === 'ALL' && styles.subFilterTextActive]}>All Floors</Text>
                  </TouchableOpacity>
                  {floors.map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.subFilterChip, floorFilter === f && styles.subFilterChipActive]}
                      onPress={() => setFloorFilter(f)}
                    >
                      <Text style={[styles.subFilterText, floorFilter === f && styles.subFilterTextActive]}>{floorLabel(f)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Sharing filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.subFilterChip, sharingFilter === 'ALL' && styles.subFilterChipActive]}
                  onPress={() => setSharingFilter('ALL')}
                >
                  <Text style={[styles.subFilterText, sharingFilter === 'ALL' && styles.subFilterTextActive]}>
                    {isApartment ? 'All Flats' : 'All Rooms'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subFilterChip, sharingFilter === 'PRIVATE' && styles.subFilterChipActive]}
                  onPress={() => setSharingFilter('PRIVATE')}
                >
                  <Text style={[styles.subFilterText, sharingFilter === 'PRIVATE' && styles.subFilterTextActive]}>
                    {isApartment ? '1Bhk' : '1-Sharing Private'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subFilterChip, sharingFilter === 'TWO_SHARING' && styles.subFilterChipActive]}
                  onPress={() => setSharingFilter('TWO_SHARING')}
                >
                  <Text style={[styles.subFilterText, sharingFilter === 'TWO_SHARING' && styles.subFilterTextActive]}>
                    {isApartment ? '2Bhk' : '2-Sharing'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subFilterChip, sharingFilter === 'THREE_SHARING' && styles.subFilterChipActive]}
                  onPress={() => setSharingFilter('THREE_SHARING')}
                >
                  <Text style={[styles.subFilterText, sharingFilter === 'THREE_SHARING' && styles.subFilterTextActive]}>
                    {isApartment ? '3Bhk' : '3-Sharing'}
                  </Text>
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
                <Empty text={isApartment ? 'No vacant flats match your filter.' : 'No vacant rooms match your sharing plan filter.'} />
              )}

              {/* Room list: compact summary, expand for details */}
              {filteredRooms.map((room) => {
                const isExpanded = expandedRoomId === room.id;
                const totalVacant = room.allVacantBeds.length;
                const vacantNow = room.allVacantBeds.filter((bed) => !bed.availableFrom).length;
                const upcomingDates = room.allVacantBeds
                  .map((bed) => bed.availableFrom)
                  .filter((date): date is string => !!date)
                  .sort();

                return (
                  <View key={room.id} style={styles.roomCard}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={styles.roomSummaryButton}
                      onPress={() => setExpandedRoomId(isExpanded ? null : room.id)}
                    >
                      <View style={styles.roomSummaryContent}>
                        <View style={styles.roomHeadRow}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={styles.roomNum}>{isApartment ? 'Flat' : 'Room'} {room.number}</Text>
                              {room.attachedBathroom && <Badge text="Attached Bath" color="#0d9488" />}
                              {room.balcony && <Badge text="Balcony" color="#ea580c" />}
                            </View>
                            <Text style={styles.roomSubInfo}>
                              {[room.floorName, room.buildingName || 'Main Building', isApartment ? 'Apartment' : `${room.capacity}-bed capacity`]
                                .filter(Boolean).join(' · ')}
                            </Text>
                          </View>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color="#64748b"
                          />
                        </View>

                        <View style={styles.roomSummaryFooter}>
                          <View style={styles.vacancyCountWrap}>
                            <Ionicons name="bed-outline" size={15} color="#15803d" />
                            <Text style={styles.vacancyCountText}>
                              {totalVacant} {isApartment ? 'vacant' : 'vacant beds'}
                            </Text>
                          </View>
                          {vacantNow > 0 ? (
                            <Text style={styles.vacancyMeta}>{vacantNow} available now</Text>
                          ) : upcomingDates.length > 0 ? (
                            <Text style={styles.vacancyMeta}>Next vacancy: {upcomingDates[0]}</Text>
                          ) : (
                            <Text style={styles.fullMeta}>Currently full</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.expandedRoomContent}>
                        {room.images && room.images.length > 0 ? (
                          <ImageGallery images={room.images} height={112} />
                        ) : null}

                        <Text style={styles.vacantBedsHeading}>
                          {totalVacant > 0
                            ? isApartment ? 'Select a flat' : 'Select a vacant bed'
                            : isApartment ? 'No vacant flats' : 'No vacant beds in this room'}
                        </Text>

                        {totalVacant > 0 && (
                          <View style={styles.bedsGrid}>
                            {room.sections.filter((sec) => sec.vacantBeds.length > 0).map((sec) => {
                              const apartmentRoom = pg?.stayType === 'APARTMENT' || room.roomType?.startsWith('FLAT_') || room.roomType === 'STUDIO';
                              const planLabel = apartmentRoom
                                ? room.roomType === 'FLAT_1BHK' || sec.capacity === 1
                                  ? '1 BHK'
                                  : room.roomType === 'FLAT_2BHK' || sec.capacity === 2
                                  ? '2 BHK'
                                  : room.roomType === 'FLAT_3BHK' || sec.capacity === 3
                                  ? '3 BHK'
                                  : room.roomType === 'STUDIO'
                                  ? 'Studio'
                                  : `${sec.capacity}-Sharing`
                                : sec.capacity === 1
                                ? '1-Sharing Private'
                                : `${sec.capacity}-Sharing`;
                              const title = sec.sectionName !== 'Main Room' ? `${sec.sectionName} · ${planLabel}` : planLabel;
                              return (
                              <View key={sec.id} style={styles.secWrap}>
                                <View style={styles.secHeader}>
                                  <Text style={styles.secName} numberOfLines={1}>{title}</Text>
                                  <Text style={styles.secPrice}>
                                    {money(sec.rentPerBed)}
                                    <Text style={styles.perMonth}> / month</Text>
                                    {sec.depositPerBed > 0 ? <Text style={styles.perMonth}>  ·  Deposit {money(sec.depositPerBed)}</Text> : null}
                                  </Text>
                                </View>
                                <View style={styles.bedOptionsRow}>
                                  {sec.vacantBeds.map((bed) => {
                                    const isSelected = selectedBed?.id === bed.id;
                                    return (
                                      <TouchableOpacity
                                        key={bed.id}
                                        style={[styles.bedPill, isSelected && styles.bedPillSelected]}
                                        onPress={() => handleSelectBed(room, bed)}
                                      >
                                        <Ionicons
                                          name={isApartment ? 'home-outline' : 'bed-outline'}
                                          size={15}
                                          color={isSelected ? '#fff' : '#15803d'}
                                        />
                                        <Text style={[styles.bedPillText, isSelected && styles.bedPillTextSelected]}>
                                          {isApartment ? 'Book flat' : `${bed.bedNumber}`}
                                          {bed.availableFrom ? ` · From ${bed.availableFrom}` : ''}
                                        </Text>
                                        {isSelected ? <Ionicons name="checkmark-circle" size={14} color="#fff" /> : null}
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              </View>
                              );
                            })}
                          </View>
                        )}
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
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Sticky Bottom Bar when a Bed is Selected ── */}
      {selectedBed && selectedRoom && (
        <View style={[styles.bottomBar, { paddingBottom: 12 + Math.max(insets.bottom, 16) }]}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.bottomBarTitle}>
              {isApartment ? `Flat ${selectedRoom.number}` : `Room ${selectedRoom.number} · ${selectedBed.bedNumber}`}
            </Text>
            <Text style={styles.bottomBarPrice}>
              {money(selectedBed.rent)}<Text style={{ fontSize: 11, fontWeight: '400', color: colors.muted }}>/mo</Text>
              {(() => {
                const selectedSection = selectedRoom?.sections.find((s) => s.vacantBeds.some((b) => b.id === selectedBed?.id));
                const depositAmount = selectedSection?.depositPerBed;
                return depositAmount !== undefined && depositAmount > 0 ? (
                  <Text style={{ fontSize: 13, fontWeight: '500', color: colors.muted }}>
                    {` · Deposit: ${money(depositAmount)}`}
                  </Text>
                ) : null;
              })()}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.whatsAppQuickBtn}
              onPress={() => handleWhatsApp(isApartment ? 'Flat' : selectedBed.bedNumber, selectedRoom.number, selectedBed.rent)}
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
                  {pg?.name} · Room {selectedRoom?.number} · {selectedBed?.bedNumber}
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

              <Text style={s.label}>Expected Move-in / Joining Date *</Text>
              <DateField value={inquiryDate} onChange={setInquiryDate} min={today()} />

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
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18,
    paddingVertical: 13, backgroundColor: '#fff', gap: 12,
    borderBottomWidth: 1, borderBottomColor: '#edf0f5',
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#172033' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  propertySummary: { marginHorizontal: 16, marginTop: 12, marginBottom: 10, padding: 15, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e8edf4' },
  summaryLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryPin: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  summaryAddress: { fontSize: 13, fontWeight: '700', color: '#1e293b', lineHeight: 18 },
  summaryType: { fontSize: 11, color: colors.muted, marginTop: 3 },
  mapIconButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  summaryDivider: { height: 1, backgroundColor: '#edf0f5', marginVertical: 13 },
  summaryStats: { flexDirection: 'row', alignItems: 'center' },
  summaryStat: { flex: 1, alignItems: 'center', gap: 3 },
  summaryNumber: { fontSize: 19, fontWeight: '800', color: '#172033' },
  summaryLabel: { fontSize: 11, color: colors.muted, fontWeight: '500' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#edf0f5' },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: '#2563eb' },
  tabItemText: { fontSize: 11, fontWeight: '600', color: colors.muted },
  tabItemTextActive: { color: '#2563eb', fontWeight: '800' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 150, gap: 12 },
  filterRow: { gap: 8, paddingBottom: 3 },
  subFilterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  subFilterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  subFilterText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  subFilterTextActive: { color: '#fff' },
  roomCard: { backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#e8edf4', marginBottom: 2, overflow: 'hidden' },
  roomSummaryButton: { padding: 14 },
  roomSummaryContent: { gap: 10 },
  roomSummaryFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  vacancyCountWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ecfdf3', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  vacancyCountText: { fontSize: 11, fontWeight: '800', color: '#15803d' },
  vacancyMeta: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  fullMeta: { fontSize: 11, fontWeight: '700', color: '#b45309' },
  expandedRoomContent: { paddingHorizontal: 14, paddingBottom: 14, gap: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  roomHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  roomNum: { fontSize: 16, fontWeight: '800', color: '#172033' },
  roomSubInfo: { fontSize: 11, color: colors.muted, marginTop: 5, lineHeight: 16 },
  roomVacantBadge: { backgroundColor: '#ecfdf3', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  roomVacantBadgeText: { fontSize: 10, fontWeight: '800', color: '#15803d' },
  perMonth: { fontSize: 10, color: '#64748b', fontWeight: '500' },
  vacantBedsHeading: { fontSize: 12, fontWeight: '800', color: '#172033', marginTop: 4, marginBottom: 6 },
  bedsGrid: { gap: 10 },
  bedOptionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secWrap: { gap: 6 },
  secHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  secName: { flexShrink: 1, fontSize: 12, fontWeight: '800', color: '#172033' },
  secPrice: { fontSize: 13, fontWeight: '800', color: '#15803d' },
  bedPill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#f0fdf4', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0' },
  bedPillSelected: { backgroundColor: '#15803d', borderColor: '#15803d' },
  bedPillText: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  bedPillTextSelected: { color: '#fff' },
  amenitiesCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e8edf4' },
  sectionHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#172033' },
  sectionHeaderSub: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 14, lineHeight: 18 },
  amenityGridFull: { gap: 9 },
  amenityTile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#edf0f5' },
  amenityIconCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  amenityTileTitle: { fontSize: 13, fontWeight: '700', color: '#172033' },
  amenityTileDesc: { fontSize: 11, color: colors.muted, marginTop: 3, lineHeight: 15 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e8edf4' },
  infoDesc: { fontSize: 13, color: '#475569', lineHeight: 20, marginTop: 8 },
  divider: { height: 1, backgroundColor: '#edf0f5', marginVertical: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoLabel: { flex: 1, fontSize: 12, color: colors.muted },
  infoValue: { flex: 1.3, fontSize: 12, fontWeight: '700', color: '#172033', textAlign: 'right' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e8edf4', paddingHorizontal: 16, paddingTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 10 },
  bottomBarTitle: { fontSize: 12, fontWeight: '700', color: '#172033' },
  bottomBarPrice: { fontSize: 17, fontWeight: '800', color: '#15803d', marginTop: 3 },
  whatsAppQuickBtn: { width: 43, height: 43, borderRadius: 12, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' },
  bookNowBtn: { backgroundColor: '#2563eb', paddingHorizontal: 20, height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookNowBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
