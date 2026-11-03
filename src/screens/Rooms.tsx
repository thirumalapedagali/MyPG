import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { del, get, post } from '../api';
import { useAuth } from '../auth';
import { attempt, useResource } from '../hooks';
import { AcType, GenderPolicy, Room, RoomType, SharingOption, SharingType } from '../types';
import { Badge, Button, Card, Chips, Empty, HeaderAction, Screen, SearchInput, colors, s } from '../ui';
import { money } from '../utils';

const STATUS_FILTERS = ['All', 'Vacant', 'Full'] as const;

const ROOM_TYPES: { key: RoomType; label: string }[] = [
  { key: 'STANDARD', label: 'Standard Room' },
  { key: 'FLAT_1BHK', label: '1BHK Flat' },
  { key: 'FLAT_2BHK', label: '2BHK Flat' },
  { key: 'FLAT_3BHK', label: '3BHK Flat' },
  { key: 'DORMITORY', label: 'Dormitory' },
  { key: 'STUDIO', label: 'Studio Apartment' },
];

const FLAT_TYPES = ROOM_TYPES.filter((t) => t.key.startsWith('FLAT_'));

const AC_TYPES: { key: AcType; label: string }[] = [
  { key: 'NON_AC', label: 'Non-AC' },
  { key: 'AC', label: 'AC' },
];

const GENDER_POLICIES: { key: GenderPolicy; label: string }[] = [
  { key: 'UNISEX', label: 'Unisex' },
  { key: 'MALE', label: 'Male Only' },
  { key: 'FEMALE', label: 'Female Only' },
  { key: 'COUPLE', label: 'Couples Allowed' },
];

/** "Ground Floor", "1st Floor", "2nd Floor"... for a PG with `total` floors above ground. */
function buildFloorNames(total?: number | null): string[] {
  const count = total && total > 0 ? total : 3;
  const list = ['Ground Floor'];
  for (let i = 1; i <= count; i++) {
    const suffix = i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th';
    list.push(`${i}${suffix} Floor`);
  }
  return list;
}

const ALL_FLOORS = 'All Floors';

/** Room list. Owners/managers can add/delete; residents see read-only availability. */
export default function Rooms({ editable = true }: { editable?: boolean }) {
  const { user } = useAuth();
  const { data, error, loading, refreshing, refresh, reload } = useResource(() => get<Room[]>('/api/rooms'));
  const [floorFilter, setFloorFilter] = useState<string>(ALL_FLOORS);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('All');
  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null);

  const all = data ?? [];
  const q = search.trim().toLowerCase();

  const roomFloor = (r: Room) => r.floorName?.trim() || 'Ground Floor';

  // Tabs follow the PG's floor count; floors found on rooms but not in the list are appended.
  const floorTabs = useMemo(() => {
    const names = buildFloorNames(user?.totalFloors);
    for (const r of data ?? []) {
      const f = r.floorName?.trim() || 'Ground Floor';
      if (!names.includes(f)) names.push(f);
    }
    return [ALL_FLOORS, ...names];
  }, [data, user?.totalFloors]);

  const rooms = all
    .filter((r) => floorFilter === ALL_FLOORS || roomFloor(r) === floorFilter)
    .filter((r) => {
      if (!q) return true;
      const numMatch = r.number.toLowerCase().includes(q);
      const nameMatch = (r.roomName ?? '').toLowerCase().includes(q);
      const bldMatch = (r.buildingName ?? '').toLowerCase().includes(q);
      const flrMatch = (r.floorName ?? '').toLowerCase().includes(q);
      const occMatch = editable && (r.occupants ?? []).some((o) => o.toLowerCase().includes(q));
      return numMatch || nameMatch || bldMatch || flrMatch || occMatch;
    })
    .filter((r) => statusFilter === 'All' || (statusFilter === 'Vacant' ? r.vacant > 0 : r.vacant === 0));

  const confirmDelete = (room: Room) =>
    Alert.alert('Delete room', `Delete room ${room.number}?${room.occupied ? ' Remove its residents first.' : ''}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => del(`/api/rooms/${room.id}`))) reload();
        },
      },
    ]);

  const formatRoomTypeLabel = (type?: RoomType) => {
    switch (type) {
      case 'FLAT_1BHK': return '1BHK Flat';
      case 'FLAT_2BHK': return '2BHK Flat';
      case 'FLAT_3BHK': return '3BHK Flat';
      case 'DORMITORY': return 'Dormitory';
      case 'STUDIO': return 'Studio';
      default: return 'Standard';
    }
  };

  return (
    <Screen
      title={editable ? 'Rooms' : 'Availability'}
      action={editable ? <HeaderAction label="Add" icon="add-circle" onPress={() => setOpen(true)} /> : undefined}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {all.length > 0 && (
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={editable ? 'Search room, building or resident' : 'Search room'}
          />
          <Chips options={floorTabs} value={floorFilter} onChange={setFloorFilter} />
          <Chips options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
        </>
      )}

      {data && all.length === 0 && <Empty text="No rooms yet. Add your first room." />}
      {all.length > 0 && rooms.length === 0 && <Empty text="No rooms match your filter." />}

      {rooms.map((room) => {
        const isExpanded = expandedRoomId === room.id;
        const locationText = [room.buildingName, room.floorName].filter(Boolean).join(' · ');
        const isFlat = room.roomType?.startsWith('FLAT_');

        return (
          <Card key={room.id} style={{ marginBottom: 12 }}>
            <Pressable onPress={() => setExpandedRoomId(isExpanded ? null : room.id)}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={s.h2}>{isFlat ? 'Flat' : 'Room'} {room.number}</Text>
                    {room.roomName && (
                      <Text style={[s.muted, { fontWeight: '600' }]}>({room.roomName})</Text>
                    )}
                  </View>
                  {locationText ? (
                    <Text style={[s.muted, { fontSize: 11, marginTop: 1 }]}>
                      {locationText}
                    </Text>
                  ) : null}
                </View>

                <Badge
                  text={isFlat ? (room.vacant ? 'Vacant' : 'Occupied') : room.vacant ? `${room.vacant} vacant` : 'Full'}
                  color={room.vacant ? colors.good : colors.bad}
                />
              </View>

              {/* Tag Badges */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                <Badge text={formatRoomTypeLabel(room.roomType)} color={colors.blue} />
                <Badge text={room.acType === 'AC' ? 'AC' : 'Non-AC'} color={room.acType === 'AC' ? '#0284c7' : '#64748b'} />
                {room.genderPolicy && room.genderPolicy !== 'UNISEX' && (
                  <Badge
                    text={room.genderPolicy === 'MALE' ? 'Male' : room.genderPolicy === 'FEMALE' ? 'Female' : 'Couples'}
                    color="#8b5cf6"
                  />
                )}
                {room.attachedBathroom && <Badge text="Attached Bath" color="#059669" />}
                {room.balcony && <Badge text="Balcony" color="#d97706" />}
              </View>

              {/* Sharing Plans */}
              {!isFlat && room.sharingOptions && room.sharingOptions.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {room.sharingOptions.map((opt, idx) => (
                    <View key={opt.id ?? idx} style={styles.sharingPill}>
                      <Text style={styles.sharingPillType}>
                        {opt.capacity}-Sharing:
                      </Text>
                      <Text style={styles.sharingPillRent}>
                        {money(opt.rentPerBed)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Occupancy */}
              {isFlat ? (
                <View style={[s.row, { marginTop: 10 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="home-outline" size={16} color={colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                      {room.vacant > 0 ? 'Available' : 'Occupied'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                    {money(room.rent)}/month
                  </Text>
                </View>
              ) : (
                <View style={[s.row, { marginTop: 10 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="bed-outline" size={16} color={colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                      {room.occupied}/{room.capacity} beds occupied
                    </Text>
                  </View>
                  <Text style={s.muted}>
                    {room.vacant > 0 ? `${room.vacant} vacant` : 'Full'}
                  </Text>
                </View>
              )}

              {/* Occupant names (staff only) */}
              {editable && room.occupants && room.occupants.length > 0 && !isExpanded && (
                <Text style={[s.muted, { marginTop: 4 }]} numberOfLines={1}>
                  Residents: {room.occupants.join(', ')}
                </Text>
              )}
            </Pressable>

            {/* Sections & Beds Breakdown */}
            {isExpanded && !isFlat && room.sections && room.sections.length > 0 && (
              <View style={styles.sectionsContainer}>
                <Text style={styles.sectionHeaderTitle}>Beds & Sections</Text>
                {room.sections.map((sec) => (
                  <View key={sec.id} style={styles.sectionItem}>
                    <View style={s.row}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                        {sec.sectionName}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                        {money(sec.rentPerBed)}/bed
                      </Text>
                    </View>

                    <View style={styles.bedList}>
                      {sec.beds && sec.beds.map((bed) => {
                        const isVacant = bed.status === 'VACANT';
                        return (
                          <View
                            key={bed.id}
                            style={[
                              styles.bedChip,
                              { backgroundColor: isVacant ? '#f0fdf4' : '#fef2f2', borderColor: isVacant ? '#86efac' : '#fca5a5' },
                            ]}
                          >
                            <Ionicons
                              name={isVacant ? 'bed-outline' : 'person'}
                              size={13}
                              color={isVacant ? colors.good : colors.bad}
                            />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: isVacant ? colors.good : colors.bad }}>
                              {bed.bedNumber}
                              {bed.residentName && editable ? `: ${bed.residentName}` : isVacant ? ' (Vacant)' : ' (Occupied)'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {editable && (
              <View style={[s.row, { marginTop: 10, justifyContent: 'flex-end', gap: 8 }]}>
                {!isFlat && (
                  <Button
                    small
                    kind="ghost"
                    label={isExpanded ? 'Hide Beds' : 'View Beds'}
                    onPress={() => setExpandedRoomId(isExpanded ? null : room.id)}
                  />
                )}
                <Button small kind="danger" label="Delete" onPress={() => confirmDelete(room)} />
              </View>
            )}
          </Card>
        );
      })}

      <AddRoomModal
        visible={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false);
          reload();
        }}
      />
    </Screen>
  );
}

type FacilityOption = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const BASE_FACILITIES: FacilityOption[] = [
  { key: 'AC', label: 'AC', icon: 'snow-outline' },
  { key: 'Non-AC', label: 'Non-AC', icon: 'leaf-outline' },
  { key: 'Attached Bathroom', label: 'Attached Bathroom', icon: 'water-outline' },
  { key: 'Common Bathroom', label: 'Common Bathroom', icon: 'rainy-outline' },
  { key: 'Wi-Fi', label: 'Wi-Fi', icon: 'wifi-outline' },
  { key: 'TV', label: 'TV', icon: 'tv-outline' },
  { key: 'Wardrobe', label: 'Wardrobe', icon: 'file-tray-stacked-outline' },
  { key: 'Balcony', label: 'Balcony', icon: 'grid-outline' },
  { key: 'Geyser', label: 'Geyser', icon: 'flame-outline' },
  { key: 'Other', label: 'Other', icon: 'ellipsis-horizontal' },
];

const SECTION_FACILITY_OPTIONS: FacilityOption[] = [
  { key: 'AC', label: 'AC', icon: 'snow-outline' },
  { key: 'Non-AC', label: 'Non-AC', icon: 'leaf-outline' },
  { key: 'Attached Bath', label: 'Attached Bath', icon: 'water-outline' },
  { key: 'Wi-Fi', label: 'Wi-Fi', icon: 'wifi-outline' },
  { key: 'TV', label: 'TV', icon: 'tv-outline' },
  { key: 'Wardrobe', label: 'Wardrobe', icon: 'file-tray-stacked-outline' },
];

const SHARING_TYPE_CHOICES: { key: SharingType; label: string; defaultBeds: number }[] = [
  { key: 'PRIVATE', label: '1 Sharing (1 bed)', defaultBeds: 1 },
  { key: 'TWO_SHARING', label: '2 Sharing (2 beds)', defaultBeds: 2 },
  { key: 'THREE_SHARING', label: '3 Sharing (3 beds)', defaultBeds: 3 },
  { key: 'FOUR_SHARING', label: '4 Sharing (4 beds)', defaultBeds: 4 },
  { key: 'DORM', label: 'Dormitory (6 beds)', defaultBeds: 6 },
  { key: 'WHOLE_ROOM', label: 'Entire Room', defaultBeds: 1 },
];

type SectionForm = {
  id: string;
  sectionName: string;
  sharingType: SharingType;
  capacity: number;
  rentPerBed: string;
  depositPerBed: string;
  facilities: string[];
};

function AddRoomModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Room Details
  const floorOptions = useMemo(() => buildFloorNames(user?.totalFloors), [user?.totalFloors]);

  const [floorDropdownOpen, setFloorDropdownOpen] = useState(false);
  const [buildingName, setBuildingName] = useState('Building A');
  const [floorName, setFloorName] = useState('Ground Floor');
  const [number, setNumber] = useState('');
  const [roomTypeKind, setRoomTypeKind] = useState<'SHARING' | 'PRIVATE'>('SHARING');
  const [facilities, setFacilities] = useState<string[]>(['AC', 'Wi-Fi']);
  const [photos, setPhotos] = useState<string[]>([]);

  // Apartment PGs rent whole flats (1BHK/2BHK/...) instead of beds.
  const [pgStayType, setPgStayType] = useState<string | null>(null);
  const [flatType, setFlatType] = useState<RoomType>('FLAT_2BHK');
  const isApartment = pgStayType === 'APARTMENT';
  const flatTypeLabel = FLAT_TYPES.find((t) => t.key === flatType)?.label ?? 'Flat';

  useEffect(() => {
    if (!visible) return;
    get<{ stayType?: string | null }>('/api/pg/profile')
      .then((p) => setPgStayType(p?.stayType ?? null))
      .catch(() => setPgStayType(null));
  }, [visible]);

  // Step 2: Sections & Sharing
  const [sections, setSections] = useState<SectionForm[]>([]);
  const [directCapacity, setDirectCapacity] = useState<number>(1);
  const [directSharingType, setDirectSharingType] = useState<SharingType>('PRIVATE');
  const [directRent, setDirectRent] = useState<string>('5000');
  const [directDeposit, setDirectDeposit] = useState<string>('5000');

  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setStep(1);
    setBuildingName('Building A');
    setFloorName('Ground Floor');
    setNumber('');
    setFlatType('FLAT_2BHK');
    setRoomTypeKind('SHARING');
    setFacilities(['AC', 'Wi-Fi']);
    setPhotos([]);
    setSections([]);
    setDirectCapacity(1);
    setDirectSharingType('PRIVATE');
    setDirectRent('5000');
    setDirectDeposit('5000');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const toggleFacility = (key: string) => {
    if (facilities.includes(key)) {
      setFacilities(facilities.filter((f) => f !== key));
    } else {
      setFacilities([...facilities, key]);
    }
  };

  const toggleSectionFacility = (secIndex: number, key: string) => {
    const updated = [...sections];
    const sec = updated[secIndex];
    if (sec.facilities.includes(key)) {
      sec.facilities = sec.facilities.filter((f) => f !== key);
    } else {
      sec.facilities = [...sec.facilities, key];
    }
    setSections(updated);
  };

  const handleAddSection = () => {
    const nextChar = String.fromCharCode(65 + sections.length);
    const newSection: SectionForm = {
      id: String(Date.now()),
      sectionName: nextChar,
      sharingType: 'TWO_SHARING',
      capacity: 2,
      rentPerBed: '5000',
      depositPerBed: '5000',
      facilities: ['Non-AC'],
    };
    setSections([...sections, newSection]);
  };

  const handleRemoveSection = (secIndex: number) => {
    setSections(sections.filter((_, idx) => idx !== secIndex));
  };

  const handleRemoveAllSections = () => {
    setSections([]);
  };

  const updateSection = (secIndex: number, field: keyof SectionForm, value: any) => {
    const updated = [...sections];
    updated[secIndex] = { ...updated[secIndex], [field]: value };
    setSections(updated);
  };

  const goToStep2 = () => {
    if (!number.trim()) {
      Alert.alert('Required Field', 'Please enter Room / Flat Number.');
      return;
    }
    setStep(2);
  };

  const goToStep3 = () => {
    if (isApartment) {
      if (!(parseFloat(directRent) >= 0)) {
        Alert.alert('Invalid Rent', 'Please enter a valid monthly rent amount.');
        return;
      }
    } else if (sections.length === 0) {
      if (!(directCapacity > 0)) {
        Alert.alert('Invalid Beds', 'Room must have at least 1 bed capacity.');
        return;
      }
      if (!(parseFloat(directRent) >= 0)) {
        Alert.alert('Invalid Rent', 'Please enter a valid monthly rent amount.');
        return;
      }
    } else {
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        if (!s.sectionName.trim()) {
          Alert.alert('Required Field', `Section ${i + 1} needs a name.`);
          return;
        }
        if (!(s.capacity > 0)) {
          Alert.alert('Invalid Beds', `Section ${s.sectionName} must have at least 1 bed.`);
          return;
        }
        if (!(parseFloat(s.rentPerBed) >= 0)) {
          Alert.alert('Invalid Rent', `Section ${s.sectionName} requires a valid monthly rent.`);
          return;
        }
      }
    }
    setStep(3);
  };

  const hasSections = !isApartment && sections.length > 0;
  // A flat is rented as one unit, so it has a single (internal) slot and no beds shown.
  const totalBeds = isApartment
    ? 1
    : hasSections
      ? sections.reduce((sum, s) => sum + (s.capacity || 0), 0)
      : directCapacity;
  const totalMonthlyRent = hasSections
    ? sections.reduce((sum, s) => sum + (s.capacity || 0) * (parseFloat(s.rentPerBed) || 0), 0)
    : directCapacity * (parseFloat(directRent) || 0);
  const totalSecurityDeposit = hasSections
    ? sections.reduce((sum, s) => sum + (s.capacity || 0) * (parseFloat(s.depositPerBed) || 0), 0)
    : directCapacity * (parseFloat(directDeposit) || 0);

  const submit = async () => {
    const num = number.trim();
    if (!num) {
      Alert.alert('Missing Field', 'Please enter room number.');
      return;
    }

    setBusy(true);
    try {
      let payloadSections: any[] | null = null;
      let payloadSharingOptions: any[] = [];

      if (hasSections) {
        payloadSections = sections.map((s) => ({
          sectionName: s.sectionName.trim() || 'Section',
          sharingType: s.sharingType,
          capacity: s.capacity,
          rentPerBed: parseFloat(s.rentPerBed) || 0,
          depositPerBed: parseFloat(s.depositPerBed) || 0,
          acType: s.facilities.includes('AC') ? ('AC' as AcType) : ('NON_AC' as AcType),
          attachedBathroom: s.facilities.includes('Attached Bath') || s.facilities.includes('Attached Bathroom'),
        }));

        payloadSharingOptions = sections.map((s) => ({
          sharingType: s.sharingType,
          capacity: s.capacity,
          rentPerBed: parseFloat(s.rentPerBed) || 0,
          depositPerBed: parseFloat(s.depositPerBed) || 0,
        }));
      } else {
        payloadSharingOptions = [
          {
            sharingType: isApartment ? ('WHOLE_ROOM' as SharingType) : directSharingType,
            capacity: totalBeds,
            rentPerBed: parseFloat(directRent) || 0,
            depositPerBed: parseFloat(directDeposit) || 0,
          },
        ];
      }

      const ok = await attempt(() =>
        post('/api/rooms', {
          number: num,
          roomName: null,
          buildingName: buildingName.trim() || null,
          floorName: floorName.trim() || null,
          roomType: isApartment ? flatType : 'STANDARD',
          acType: facilities.includes('AC') ? 'AC' : 'NON_AC',
          attachedBathroom: facilities.includes('Attached Bathroom'),
          balcony: facilities.includes('Balcony'),
          genderPolicy: 'UNISEX',
          capacity: totalBeds > 0 ? totalBeds : 1,
          rent: hasSections ? (totalBeds > 0 ? totalMonthlyRent / totalBeds : 0) : parseFloat(directRent) || 0,
          sections: payloadSections,
          sharingOptions: payloadSharingOptions,
        })
      );

      if (ok) {
        resetForm();
        onCreated();
      }
    } finally {
      setBusy(false);
    }
  };

  const propertyDisplayName = user?.pgName || 'Sri Lakshmi PG';

  const formatSharingLabelShort = (t: SharingType) => {
    switch (t) {
      case 'PRIVATE': return '1 Sharing';
      case 'TWO_SHARING': return '2 Sharing';
      case 'THREE_SHARING': return '3 Sharing';
      case 'FOUR_SHARING': return '4 Sharing';
      case 'DORM': return 'Dormitory';
      case 'WHOLE_ROOM': return 'Entire Room';
      default: return t;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={wizardStyles.container}>
        {/* Header Bar */}
        <View style={wizardStyles.header}>
          <Pressable
            onPress={() => {
              if (step === 3) setStep(2);
              else if (step === 2) setStep(1);
              else handleClose();
            }}
            hitSlop={10}
            style={wizardStyles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </Pressable>
          <Text style={wizardStyles.headerTitle}>{isApartment ? 'Add New Flat' : 'Add New Room'}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* 3-Step Stepper */}
        <View style={wizardStyles.stepperWrapper}>
          <View style={wizardStyles.stepperContainer}>
            {/* Step 1 */}
            <View style={wizardStyles.stepItem}>
              <View
                style={[
                  wizardStyles.stepCircle,
                  step >= 1 && wizardStyles.stepCircleDone,
                  step === 1 && wizardStyles.stepCircleActive,
                ]}
              >
                {step > 1 ? (
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                ) : (
                  <Text style={[wizardStyles.stepNumber, step === 1 && { color: '#ffffff' }]}>1</Text>
                )}
              </View>
              <Text style={[wizardStyles.stepLabel, step === 1 && wizardStyles.stepLabelActive]}>
                Room Details
              </Text>
            </View>

            {/* Connector 1-2 */}
            <View
              style={[
                wizardStyles.stepLine,
                step > 1 && wizardStyles.stepLineDone,
              ]}
            />

            {/* Step 2 */}
            <View style={wizardStyles.stepItem}>
              <View
                style={[
                  wizardStyles.stepCircle,
                  step >= 2 && wizardStyles.stepCircleDone,
                  step === 2 && wizardStyles.stepCircleActive,
                ]}
              >
                {step > 2 ? (
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                ) : (
                  <Text style={[wizardStyles.stepNumber, step === 2 && { color: '#ffffff' }]}>2</Text>
                )}
              </View>
              <Text style={[wizardStyles.stepLabel, step === 2 && wizardStyles.stepLabelActive]}>
                {isApartment ? 'Pricing' : 'Sections & Sharing'}
              </Text>
            </View>

            {/* Connector 2-3 */}
            <View
              style={[
                wizardStyles.stepLine,
                step > 2 && wizardStyles.stepLineDone,
              ]}
            />

            {/* Step 3 */}
            <View style={wizardStyles.stepItem}>
              <View
                style={[
                  wizardStyles.stepCircle,
                  step === 3 && wizardStyles.stepCircleActive,
                ]}
              >
                <Text style={[wizardStyles.stepNumber, step === 3 && { color: '#ffffff' }]}>3</Text>
              </View>
              <Text style={[wizardStyles.stepLabel, step === 3 && wizardStyles.stepLabelActive]}>
                Review & Save
              </Text>
            </View>
          </View>
        </View>

        {/* Scrollable Content Body */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={wizardStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* STEP 1: ROOM DETAILS */}
          {step === 1 && (
            <View style={{ gap: 16 }}>
              {/* Property Card */}
              <View style={wizardStyles.propertyCard}>
                <View style={wizardStyles.propertyIconBox}>
                  <Ionicons name="business" size={24} color="#15803d" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={wizardStyles.propertySubtext}>Property</Text>
                  <Text style={wizardStyles.propertyTitle}>{propertyDisplayName}</Text>
                  <Text style={wizardStyles.propertyMeta}>
                    Building A · {user?.totalFloors || 3} Floors
                  </Text>
                </View>
              </View>

              {/* Room Location */}
              <View>
                <Text style={wizardStyles.sectionTitle}>Room Location</Text>

                <Text style={wizardStyles.fieldLabel}>Building *</Text>
                <View style={wizardStyles.inputWithIcon}>
                  <Ionicons name="business-outline" size={20} color="#15803d" style={wizardStyles.fieldIcon} />
                  <TextInput
                    style={wizardStyles.fieldInput}
                    value={buildingName}
                    onChangeText={setBuildingName}
                    placeholder="Building A"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <Text style={[wizardStyles.fieldLabel, { marginTop: 12 }]}>Floor *</Text>
                <TouchableOpacity
                  style={[wizardStyles.inputWithIcon, { justifyContent: 'space-between' }]}
                  onPress={() => setFloorDropdownOpen(!floorDropdownOpen)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Ionicons name="layers-outline" size={20} color="#15803d" style={wizardStyles.fieldIcon} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a' }}>
                      {floorName}
                    </Text>
                  </View>
                  <Ionicons name={floorDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#64748b" />
                </TouchableOpacity>

                {floorDropdownOpen && (
                  <View style={wizardStyles.floorDropdownList}>
                    {floorOptions.map((f) => {
                      const isSelected = f === floorName;
                      return (
                        <TouchableOpacity
                          key={f}
                          style={[
                            wizardStyles.floorDropdownItem,
                            isSelected && wizardStyles.floorDropdownItemSelected,
                          ]}
                          onPress={() => {
                            setFloorName(f);
                            setFloorDropdownOpen(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                            size={18}
                            color={isSelected ? '#15803d' : '#94a3b8'}
                            style={{ marginRight: 10 }}
                          />
                          <Text
                            style={[
                              wizardStyles.floorDropdownItemText,
                              isSelected && { color: '#15803d', fontWeight: '700' },
                            ]}
                          >
                            {f}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <Text style={[wizardStyles.fieldLabel, { marginTop: 12 }]}>
                  {isApartment ? 'Flat Number / Name *' : 'Room Number / Name *'}
                </Text>
                <View style={wizardStyles.inputWithIcon}>
                  <Ionicons name="enter-outline" size={20} color="#64748b" style={wizardStyles.fieldIcon} />
                  <TextInput
                    style={wizardStyles.fieldInput}
                    value={number}
                    onChangeText={setNumber}
                    placeholder="101"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              {/* Flat Type (apartments) */}
              {isApartment && (
                <View>
                  <Text style={wizardStyles.sectionTitle}>Flat Type</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {FLAT_TYPES.map((t) => {
                      const on = flatType === t.key;
                      return (
                        <Pressable
                          key={t.key}
                          onPress={() => setFlatType(t.key)}
                          style={[wizardStyles.roomTypeCard, on && wizardStyles.roomTypeCardActive, { minWidth: '30%' }]}
                        >
                          <Ionicons name="home" size={28} color={on ? '#15803d' : '#64748b'} />
                          <Text style={[wizardStyles.roomTypeText, on && wizardStyles.roomTypeTextActive]}>
                            {t.label.replace(' Flat', '')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Room Type */}
              {!isApartment && (
              <View>
                <Text style={wizardStyles.sectionTitle}>Room Type</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Pressable
                    onPress={() => setRoomTypeKind('SHARING')}
                    style={[
                      wizardStyles.roomTypeCard,
                      roomTypeKind === 'SHARING' && wizardStyles.roomTypeCardActive,
                    ]}
                  >
                    <Ionicons
                      name="people"
                      size={28}
                      color={roomTypeKind === 'SHARING' ? '#15803d' : '#64748b'}
                    />
                    <Text
                      style={[
                        wizardStyles.roomTypeText,
                        roomTypeKind === 'SHARING' && wizardStyles.roomTypeTextActive,
                      ]}
                    >
                      Sharing Room
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setRoomTypeKind('PRIVATE')}
                    style={[
                      wizardStyles.roomTypeCard,
                      roomTypeKind === 'PRIVATE' && wizardStyles.roomTypeCardActive,
                    ]}
                  >
                    <Ionicons
                      name="person"
                      size={28}
                      color={roomTypeKind === 'PRIVATE' ? '#15803d' : '#64748b'}
                    />
                    <Text
                      style={[
                        wizardStyles.roomTypeText,
                        roomTypeKind === 'PRIVATE' && wizardStyles.roomTypeTextActive,
                      ]}
                    >
                      Private Room
                    </Text>
                  </Pressable>
                </View>
              </View>
              )}

              {/* Base Facilities (Optional) */}
              <View>
                <Text style={wizardStyles.sectionTitle}>Base Facilities (Optional)</Text>
                <View style={wizardStyles.facilitiesGrid}>
                  {BASE_FACILITIES.map((item) => {
                    const isSelected = facilities.includes(item.key);
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => toggleFacility(item.key)}
                        style={[
                          wizardStyles.facilityTile,
                          isSelected && wizardStyles.facilityTileActive,
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={20}
                          color={isSelected ? '#15803d' : '#64748b'}
                        />
                        <Text
                          style={[
                            wizardStyles.facilityTileText,
                            isSelected && wizardStyles.facilityTileTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Room Photos (Optional) */}
              <View>
                <Text style={wizardStyles.sectionTitle}>Room Photos (Optional)</Text>
                <Pressable
                  style={wizardStyles.photoUploadBox}
                  onPress={() => {
                    setPhotos([...photos, `Photo ${photos.length + 1}`]);
                  }}
                >
                  <Ionicons name="camera-outline" size={32} color="#64748b" />
                  <Text style={wizardStyles.photoUploadTitle}>Add Photos</Text>
                  <Text style={wizardStyles.photoUploadSubtext}>
                    {photos.length > 0 ? `${photos.length} photo(s) selected` : 'You can add multiple photos'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* STEP 2 (APARTMENT): FLAT PRICING — no beds or sections */}
          {step === 2 && isApartment && (
            <View style={{ gap: 16 }}>
              <View>
                <Text style={wizardStyles.sectionTitle}>Flat Pricing</Text>
                <Text style={wizardStyles.sectionSubtitle}>
                  The whole {flatTypeLabel} is rented as one unit. Rent and deposit apply to the entire flat.
                </Text>
              </View>

              <View style={[wizardStyles.sectionCard, { borderColor: '#c4b5fd', backgroundColor: '#f5f3ff' }]}>
                <Text style={wizardStyles.fieldLabel}>Monthly Rent (per flat) *</Text>
                <View style={wizardStyles.currencyInputBox}>
                  <Text style={wizardStyles.currencySymbol}>₹</Text>
                  <TextInput
                    style={wizardStyles.currencyInput}
                    value={directRent}
                    onChangeText={setDirectRent}
                    keyboardType="number-pad"
                    placeholder="15000"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <Text style={[wizardStyles.fieldLabel, { marginTop: 12 }]}>Security Deposit (per flat)</Text>
                <View style={wizardStyles.currencyInputBox}>
                  <Text style={wizardStyles.currencySymbol}>₹</Text>
                  <TextInput
                    style={wizardStyles.currencyInput}
                    value={directDeposit}
                    onChangeText={setDirectDeposit}
                    keyboardType="number-pad"
                    placeholder="30000"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
            </View>
          )}

          {/* STEP 2: SECTIONS & SHARING */}
          {step === 2 && !isApartment && (
            <View style={{ gap: 16 }}>
              <View style={[s.row, { alignItems: 'flex-start' }]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={wizardStyles.sectionTitle}>Room Structure & Pricing</Text>
                  <Text style={wizardStyles.sectionSubtitle}>
                    {sections.length === 0
                      ? 'Single room allocation without partitions. Beds and rent apply directly to the room.'
                      : 'Configure sharing and pricing for each section or partitioned space.'}
                  </Text>
                </View>
                {sections.length > 0 && (
                  <TouchableOpacity
                    onPress={handleRemoveAllSections}
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#fef2f2' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626' }}>Remove All Sections</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* IF NO SECTIONS: DIRECT ROOM ALLOCATION */}
              {sections.length === 0 && (
                <View style={[wizardStyles.sectionCard, { borderColor: '#86efac', backgroundColor: '#f0fdf4' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>Direct Room Allocation</Text>
                      <Text style={{ fontSize: 11, color: colors.muted }}>No sub-sections or partitions needed</Text>
                    </View>
                  </View>

                  {/* Sharing Type */}
                  <Text style={wizardStyles.fieldLabel}>Room Sharing Model *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {SHARING_TYPE_CHOICES.map((choice) => (
                      <Pressable
                        key={choice.key}
                        onPress={() => {
                          setDirectSharingType(choice.key);
                          setDirectCapacity(choice.defaultBeds);
                        }}
                        style={[
                          wizardStyles.choiceChip,
                          directSharingType === choice.key && wizardStyles.choiceChipActive,
                        ]}
                      >
                        <Ionicons
                          name="people"
                          size={15}
                          color={directSharingType === choice.key ? '#15803d' : '#64748b'}
                        />
                        <Text
                          style={[
                            wizardStyles.choiceChipText,
                            directSharingType === choice.key && wizardStyles.choiceChipTextActive,
                          ]}
                        >
                          {choice.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {/* Total Bed Capacity */}
                  <Text style={[wizardStyles.fieldLabel, { marginTop: 8 }]}>Total Bed Capacity *</Text>
                  <View style={wizardStyles.stepperBox}>
                    <Pressable
                      style={wizardStyles.stepperBtn}
                      onPress={() => setDirectCapacity(Math.max(1, directCapacity - 1))}
                    >
                      <Ionicons name="remove" size={18} color="#0f172a" />
                    </Pressable>
                    <Text style={wizardStyles.stepperValue}>{directCapacity}</Text>
                    <Pressable
                      style={wizardStyles.stepperBtn}
                      onPress={() => setDirectCapacity(directCapacity + 1)}
                    >
                      <Ionicons name="add" size={18} color="#0f172a" />
                    </Pressable>
                  </View>

                  {/* Monthly Rent */}
                  <Text style={[wizardStyles.fieldLabel, { marginTop: 12 }]}>Monthly Rent (per bed / flat) *</Text>
                  <View style={wizardStyles.currencyInputBox}>
                    <Text style={wizardStyles.currencySymbol}>₹</Text>
                    <TextInput
                      style={wizardStyles.currencyInput}
                      value={directRent}
                      onChangeText={setDirectRent}
                      keyboardType="number-pad"
                      placeholder="5000"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  {/* Security Deposit */}
                  <Text style={[wizardStyles.fieldLabel, { marginTop: 12 }]}>Security Deposit (per bed / flat)</Text>
                  <View style={wizardStyles.currencyInputBox}>
                    <Text style={wizardStyles.currencySymbol}>₹</Text>
                    <TextInput
                      style={wizardStyles.currencyInput}
                      value={directDeposit}
                      onChangeText={setDirectDeposit}
                      keyboardType="number-pad"
                      placeholder="5000"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
              )}

              {/* IF SECTIONS ARE CONFIGURED */}
              {sections.map((sec, idx) => (
                <View key={sec.id} style={wizardStyles.sectionCard}>
                  {/* Section Card Header */}
                  <View style={wizardStyles.sectionCardHeader}>
                    <Text style={wizardStyles.sectionCardTitle}>Section {idx + 1}</Text>
                    <Pressable
                      onPress={() => handleRemoveSection(idx)}
                      style={wizardStyles.removeSectionBtn}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      <Text style={wizardStyles.removeSectionText}>Remove Section</Text>
                    </Pressable>
                  </View>

                  {/* Section Name */}
                  <Text style={wizardStyles.fieldLabel}>Section Name *</Text>
                  <TextInput
                    style={wizardStyles.standardInput}
                    value={sec.sectionName}
                    onChangeText={(val) => updateSection(idx, 'sectionName', val)}
                    placeholder="e.g. A, B, C or Left, Right"
                    placeholderTextColor="#94a3b8"
                  />

                  {/* Sharing Type */}
                  <Text style={[wizardStyles.fieldLabel, { marginTop: 12 }]}>Sharing Type *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                    {SHARING_TYPE_CHOICES.map((choice) => (
                      <Pressable
                        key={choice.key}
                        onPress={() => {
                          updateSection(idx, 'sharingType', choice.key);
                          updateSection(idx, 'capacity', choice.defaultBeds);
                        }}
                        style={[
                          wizardStyles.choiceChip,
                          sec.sharingType === choice.key && wizardStyles.choiceChipActive,
                        ]}
                      >
                        <Ionicons
                          name="people"
                          size={15}
                          color={sec.sharingType === choice.key ? '#15803d' : '#64748b'}
                        />
                        <Text
                          style={[
                            wizardStyles.choiceChipText,
                            sec.sharingType === choice.key && wizardStyles.choiceChipTextActive,
                          ]}
                        >
                          {choice.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {/* Number of Beds */}
                  <Text style={[wizardStyles.fieldLabel, { marginTop: 8 }]}>Number of Beds *</Text>
                  <View style={wizardStyles.stepperBox}>
                    <Pressable
                      style={wizardStyles.stepperBtn}
                      onPress={() => updateSection(idx, 'capacity', Math.max(1, sec.capacity - 1))}
                    >
                      <Ionicons name="remove" size={18} color="#0f172a" />
                    </Pressable>
                    <Text style={wizardStyles.stepperValue}>{sec.capacity}</Text>
                    <Pressable
                      style={wizardStyles.stepperBtn}
                      onPress={() => updateSection(idx, 'capacity', sec.capacity + 1)}
                    >
                      <Ionicons name="add" size={18} color="#0f172a" />
                    </Pressable>
                  </View>

                  {/* Monthly Rent */}
                  <Text style={[wizardStyles.fieldLabel, { marginTop: 12 }]}>Monthly Rent (per bed) *</Text>
                  <View style={wizardStyles.currencyInputBox}>
                    <Text style={wizardStyles.currencySymbol}>₹</Text>
                    <TextInput
                      style={wizardStyles.currencyInput}
                      value={sec.rentPerBed}
                      onChangeText={(val) => updateSection(idx, 'rentPerBed', val)}
                      keyboardType="number-pad"
                      placeholder="5000"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  {/* Security Deposit */}
                  <Text style={[wizardStyles.fieldLabel, { marginTop: 12 }]}>Security Deposit (per bed)</Text>
                  <View style={wizardStyles.currencyInputBox}>
                    <Text style={wizardStyles.currencySymbol}>₹</Text>
                    <TextInput
                      style={wizardStyles.currencyInput}
                      value={sec.depositPerBed}
                      onChangeText={(val) => updateSection(idx, 'depositPerBed', val)}
                      keyboardType="number-pad"
                      placeholder="5000"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  {/* Facilities (Optional) */}
                  <Text style={[wizardStyles.fieldLabel, { marginTop: 12 }]}>Facilities (Optional)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {SECTION_FACILITY_OPTIONS.map((fItem) => {
                      const isChecked = sec.facilities.includes(fItem.key);
                      return (
                        <Pressable
                          key={fItem.key}
                          onPress={() => toggleSectionFacility(idx, fItem.key)}
                          style={[
                            wizardStyles.miniFacilityChip,
                            isChecked && wizardStyles.miniFacilityChipActive,
                          ]}
                        >
                          <Ionicons
                            name={fItem.icon}
                            size={14}
                            color={isChecked ? '#15803d' : '#64748b'}
                          />
                          <Text
                            style={[
                              wizardStyles.miniFacilityText,
                              isChecked && wizardStyles.miniFacilityTextActive,
                            ]}
                          >
                            {fItem.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              {/* Add Another Section Button */}
              <Pressable style={wizardStyles.addSectionBtn} onPress={handleAddSection}>
                <Ionicons name="add" size={20} color="#15803d" />
                <Text style={wizardStyles.addSectionText}>Add Another Section</Text>
              </Pressable>
            </View>
          )}

          {/* STEP 3: REVIEW & SAVE */}
          {step === 3 && (
            <View style={{ gap: 16 }}>
              {/* Review Room Details */}
              <View style={wizardStyles.reviewCard}>
                <View style={wizardStyles.reviewCardHeader}>
                  <Text style={wizardStyles.reviewCardTitle}>Room Details</Text>
                  <Pressable style={wizardStyles.editLink} onPress={() => setStep(1)}>
                    <Ionicons name="pencil-outline" size={16} color="#15803d" />
                    <Text style={wizardStyles.editLinkText}>Edit</Text>
                  </Pressable>
                </View>

                <View style={wizardStyles.reviewRow}>
                  <Ionicons name="business-outline" size={18} color="#64748b" style={{ width: 24 }} />
                  <Text style={wizardStyles.reviewLabel}>Property</Text>
                  <Text style={wizardStyles.reviewValue}>{propertyDisplayName}</Text>
                </View>

                <View style={wizardStyles.reviewRow}>
                  <Ionicons name="location-outline" size={18} color="#64748b" style={{ width: 24 }} />
                  <Text style={wizardStyles.reviewLabel}>Location</Text>
                  <Text style={wizardStyles.reviewValue}>{buildingName} · {floorName}</Text>
                </View>

                <View style={wizardStyles.reviewRow}>
                  <Ionicons name="enter-outline" size={18} color="#64748b" style={{ width: 24 }} />
                  <Text style={wizardStyles.reviewLabel}>Room Number</Text>
                  <Text style={wizardStyles.reviewValue}>{number}</Text>
                </View>

                <View style={wizardStyles.reviewRow}>
                  <Ionicons name="people-outline" size={18} color="#64748b" style={{ width: 24 }} />
                  <Text style={wizardStyles.reviewLabel}>{isApartment ? 'Flat Type' : 'Room Type'}</Text>
                  <Text style={wizardStyles.reviewValue}>
                    {isApartment ? flatTypeLabel : roomTypeKind === 'SHARING' ? 'Sharing Room' : 'Private Room'}
                  </Text>
                </View>

                <View style={wizardStyles.reviewRow}>
                  <Ionicons name="sparkles-outline" size={18} color="#64748b" style={{ width: 24 }} />
                  <Text style={wizardStyles.reviewLabel}>Facilities</Text>
                  <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
                    {facilities.map((f) => (
                      <Badge key={f} text={f} color="#15803d" />
                    ))}
                  </View>
                </View>
              </View>

              {/* Review Sections */}
              <View style={wizardStyles.reviewCard}>
                <View style={wizardStyles.reviewCardHeader}>
                  <Text style={wizardStyles.reviewCardTitle}>
                    {isApartment ? 'Flat Pricing' : sections.length > 0 ? 'Room Sections' : 'Direct Room Pricing'}
                  </Text>
                  <Pressable style={wizardStyles.editLink} onPress={() => setStep(2)}>
                    <Ionicons name="pencil-outline" size={16} color="#15803d" />
                    <Text style={wizardStyles.editLinkText}>Edit</Text>
                  </Pressable>
                </View>

                {isApartment ? (
                  <View style={wizardStyles.reviewSectionBlock}>
                    <View style={wizardStyles.reviewSectionTitleRow}>
                      <Text style={wizardStyles.reviewSectionName}>Entire Flat</Text>
                      <View style={{ flex: 1 }} />
                      <Badge text={flatTypeLabel} color="#7c3aed" />
                    </View>

                    <View style={wizardStyles.reviewDetailRow}>
                      <Ionicons name="cash-outline" size={16} color="#64748b" style={{ width: 22 }} />
                      <Text style={wizardStyles.reviewDetailLabel}>Monthly Rent (per flat)</Text>
                      <Text style={wizardStyles.reviewDetailValue}>₹ {money(parseFloat(directRent) || 0)}</Text>
                    </View>

                    <View style={wizardStyles.reviewDetailRow}>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#64748b" style={{ width: 22 }} />
                      <Text style={wizardStyles.reviewDetailLabel}>Security Deposit</Text>
                      <Text style={wizardStyles.reviewDetailValue}>₹ {money(parseFloat(directDeposit) || 0)}</Text>
                    </View>
                  </View>
                ) : sections.length === 0 ? (
                  <View style={wizardStyles.reviewSectionBlock}>
                    <View style={wizardStyles.reviewSectionTitleRow}>
                      <Text style={wizardStyles.reviewSectionName}>Single Room (No Sections)</Text>
                      <View style={{ flex: 1 }} />
                      <Badge text={formatSharingLabelShort(directSharingType)} color="#0284c7" />
                    </View>

                    <View style={wizardStyles.reviewDetailRow}>
                      <Ionicons name="bed-outline" size={16} color="#64748b" style={{ width: 22 }} />
                      <Text style={wizardStyles.reviewDetailLabel}>Total Bed Capacity</Text>
                      <Text style={wizardStyles.reviewDetailValue}>{directCapacity} Bed(s)</Text>
                    </View>

                    <View style={wizardStyles.reviewDetailRow}>
                      <Ionicons name="cash-outline" size={16} color="#64748b" style={{ width: 22 }} />
                      <Text style={wizardStyles.reviewDetailLabel}>Monthly Rent (per bed)</Text>
                      <Text style={wizardStyles.reviewDetailValue}>₹ {money(parseFloat(directRent) || 0)}</Text>
                    </View>

                    <View style={wizardStyles.reviewDetailRow}>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#64748b" style={{ width: 22 }} />
                      <Text style={wizardStyles.reviewDetailLabel}>Security Deposit</Text>
                      <Text style={wizardStyles.reviewDetailValue}>₹ {money(parseFloat(directDeposit) || 0)}</Text>
                    </View>
                  </View>
                ) : (
                  sections.map((sec) => (
                    <View key={sec.id} style={wizardStyles.reviewSectionBlock}>
                      <View style={wizardStyles.reviewSectionTitleRow}>
                        <View style={wizardStyles.letterCircle}>
                          <Text style={wizardStyles.letterCircleText}>{sec.sectionName.charAt(0)}</Text>
                        </View>
                        <Text style={wizardStyles.reviewSectionName}>Section {sec.sectionName}</Text>
                        <View style={{ flex: 1 }} />
                        <Badge text={formatSharingLabelShort(sec.sharingType)} color="#0284c7" />
                      </View>

                      <View style={wizardStyles.reviewDetailRow}>
                        <Ionicons name="bed-outline" size={16} color="#64748b" style={{ width: 22 }} />
                        <Text style={wizardStyles.reviewDetailLabel}>Number of Beds</Text>
                        <Text style={wizardStyles.reviewDetailValue}>{sec.capacity}</Text>
                      </View>

                      <View style={wizardStyles.reviewDetailRow}>
                        <Ionicons name="cash-outline" size={16} color="#64748b" style={{ width: 22 }} />
                        <Text style={wizardStyles.reviewDetailLabel}>Monthly Rent (per bed)</Text>
                        <Text style={wizardStyles.reviewDetailValue}>₹ {money(parseFloat(sec.rentPerBed) || 0)}</Text>
                      </View>

                      <View style={wizardStyles.reviewDetailRow}>
                        <Ionicons name="shield-checkmark-outline" size={16} color="#64748b" style={{ width: 22 }} />
                        <Text style={wizardStyles.reviewDetailLabel}>Security Deposit (per bed)</Text>
                        <Text style={wizardStyles.reviewDetailValue}>₹ {money(parseFloat(sec.depositPerBed) || 0)}</Text>
                      </View>

                      {sec.facilities.length > 0 && (
                        <View style={[wizardStyles.reviewDetailRow, { alignItems: 'flex-start' }]}>
                          <Ionicons name="sparkles-outline" size={16} color="#64748b" style={{ width: 22, marginTop: 2 }} />
                          <Text style={wizardStyles.reviewDetailLabel}>Facilities</Text>
                          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
                            {sec.facilities.map((f) => (
                              <Badge key={f} text={f} color="#15803d" />
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>

              {/* Review Summary */}
              <View style={wizardStyles.reviewCard}>
                <Text style={wizardStyles.reviewCardTitle}>Summary</Text>

                {!isApartment && (
                  <>
                    <View style={wizardStyles.reviewRow}>
                      <Ionicons name="layers-outline" size={18} color="#64748b" style={{ width: 24 }} />
                      <Text style={wizardStyles.reviewLabel}>Structure</Text>
                      <Text style={wizardStyles.reviewValue}>
                        {sections.length > 0 ? `${sections.length} Sections` : 'Direct Room'}
                      </Text>
                    </View>

                    <View style={wizardStyles.reviewRow}>
                      <Ionicons name="bed-outline" size={18} color="#64748b" style={{ width: 24 }} />
                      <Text style={wizardStyles.reviewLabel}>Total Beds</Text>
                      <Text style={wizardStyles.reviewValue}>{totalBeds}</Text>
                    </View>
                  </>
                )}

                <View style={wizardStyles.reviewRow}>
                  <Ionicons name="cash-outline" size={18} color="#64748b" style={{ width: 24 }} />
                  <Text style={wizardStyles.reviewLabel}>Total Monthly Rent</Text>
                  <Text style={[wizardStyles.reviewValue, { fontWeight: '800', color: '#15803d' }]}>
                    ₹ {money(totalMonthlyRent)}
                  </Text>
                </View>

                <View style={wizardStyles.reviewRow}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#64748b" style={{ width: 24 }} />
                  <Text style={wizardStyles.reviewLabel}>Total Security Deposit</Text>
                  <Text style={[wizardStyles.reviewValue, { fontWeight: '800' }]}>
                    ₹ {money(totalSecurityDeposit)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Sticky Action Bar */}
        <View style={wizardStyles.bottomBar}>
          {step === 1 && (
            <Pressable style={wizardStyles.primaryBtn} onPress={goToStep2}>
              <Text style={wizardStyles.primaryBtnText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
            </Pressable>
          )}

          {step === 2 && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable style={wizardStyles.secondaryBtn} onPress={() => setStep(1)}>
                <Ionicons name="arrow-back" size={18} color="#0f172a" style={{ marginRight: 6 }} />
                <Text style={wizardStyles.secondaryBtnText}>Back</Text>
              </Pressable>

              <Pressable style={[wizardStyles.primaryBtn, { flex: 1 }]} onPress={goToStep3}>
                <Text style={wizardStyles.primaryBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
              </Pressable>
            </View>
          )}

          {step === 3 && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable style={wizardStyles.secondaryBtn} onPress={() => setStep(2)}>
                <Ionicons name="arrow-back" size={18} color="#0f172a" style={{ marginRight: 6 }} />
                <Text style={wizardStyles.secondaryBtnText}>Back</Text>
              </Pressable>

              <Pressable
                style={[wizardStyles.primaryBtn, { flex: 1 }, busy && { opacity: 0.6 }]}
                onPress={submit}
                disabled={busy}
              >
                <Ionicons name="save-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={wizardStyles.primaryBtnText}>{busy ? 'Saving...' : 'Save Room'}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sharingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sharingPillType: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  sharingPillRent: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionsContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  bedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
});

const wizardStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  stepperWrapper: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#15803d',
  },
  stepCircleDone: {
    backgroundColor: '#15803d',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  stepLabelActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
    marginBottom: 16,
  },
  stepLineDone: {
    backgroundColor: '#15803d',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  propertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  propertyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertySubtext: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  propertyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1,
  },
  propertyMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    height: 46,
  },
  fieldIcon: {
    marginRight: 8,
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  standardInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
    color: '#0f172a',
  },
  roomTypeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  roomTypeCardActive: {
    borderColor: '#15803d',
    backgroundColor: '#f0fdf4',
  },
  roomTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  roomTypeTextActive: {
    color: '#15803d',
    fontWeight: '700',
  },
  facilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  facilityTile: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  facilityTileActive: {
    borderColor: '#15803d',
    backgroundColor: '#f0fdf4',
  },
  facilityTileText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
    flex: 1,
  },
  facilityTileTextActive: {
    color: '#15803d',
    fontWeight: '700',
  },
  photoUploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoUploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  photoUploadSubtext: {
    fontSize: 12,
    color: '#64748b',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  removeSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeSectionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  choiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    marginRight: 8,
  },
  choiceChipActive: {
    borderColor: '#15803d',
    backgroundColor: '#f0fdf4',
  },
  choiceChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  choiceChipTextActive: {
    color: '#15803d',
    fontWeight: '700',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    height: 44,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  currencyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    height: 44,
  },
  currencySymbol: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
    marginRight: 8,
  },
  currencyInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  miniFacilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  miniFacilityChipActive: {
    borderColor: '#15803d',
    backgroundColor: '#f0fdf4',
  },
  miniFacilityText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  miniFacilityTextActive: {
    color: '#15803d',
    fontWeight: '700',
  },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#15803d',
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    paddingVertical: 12,
  },
  addSectionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803d',
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 10,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  reviewCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  reviewValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  reviewSectionBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  reviewSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  letterCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterCircleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  reviewSectionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  reviewDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewDetailLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  reviewDetailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803d',
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  floorDropdownList: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginTop: 6,
    overflow: 'hidden',
  },
  floorDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  floorDropdownItemSelected: {
    backgroundColor: '#f0fdf4',
  },
  floorDropdownItemText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
});
