import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
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
import { get } from '../api';
import { useResource } from '../hooks';
import { PublicPgSummary } from '../types';
import { Badge, Empty, colors } from '../ui';
import { money } from '../utils';

const AMENITY_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'Wi-Fi': 'wifi',
  '3 Times Homely Food': 'restaurant',
  'Food': 'restaurant',
  'AC / Air Conditioned': 'snow',
  'AC': 'snow',
  '24/7 Power Backup': 'flash',
  'Power Backup': 'flash',
  'Hot Water Geyser': 'water',
  'Geyser': 'water',
  'Daily Housekeeping': 'sparkles',
  'Washing Machine / Laundry': 'shirt',
  'Washing Machine': 'shirt',
  '24/7 CCTV Security': 'videocam',
  'CCTV': 'videocam',
  '2-Wheeler / 4-Wheeler Parking': 'car',
  'Parking': 'car',
  'RO Drinking Water': 'water-outline',
  'RO Water': 'water-outline',
  'Refrigerator': 'cube-outline',
  'Smart TV / Lounge': 'tv',
  'Gym': 'barbell',
  'Biometric Entry': 'finger-print',
};

const getAmenityIcon = (name: string): React.ComponentProps<typeof Ionicons>['name'] => {
  for (const [key, icon] of Object.entries(AMENITY_ICONS)) {
    if (name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(name.toLowerCase())) {
      return icon;
    }
  }
  return 'checkmark-circle-outline';
};

export default function ExplorePgs({
  onSelectPg,
  onBack,
  showBack = false,
}: {
  onSelectPg: (pgId: number) => void;
  onBack?: () => void;
  showBack?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { data: pgs, loading, error, refreshing, refresh } = useResource(async () => {
    return get<PublicPgSummary[]>('/api/public/pgs');
  });

  const [search, setSearch] = useState('');
  const [selectedGender, setSelectedGender] = useState<'ALL' | 'GENTS' | 'LADIES' | 'CO_LIVING'>('ALL');
  const [selectedAmenity, setSelectedAmenity] = useState<string | null>(null);

  const list = pgs ?? [];
  const q = search.trim().toLowerCase();

  const filteredPgs = list.filter((p) => {
    if (q) {
      const matchSearch =
        p.name.toLowerCase().includes(q) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        p.amenities.some((a) => a.toLowerCase().includes(q));
      if (!matchSearch) return false;
    }
    if (selectedGender !== 'ALL') {
      const g = (p.genderType || 'CO_LIVING').toUpperCase();
      if (selectedGender === 'GENTS' && !g.includes('GENT') && !g.includes('MALE')) return false;
      if (selectedGender === 'LADIES' && !g.includes('LAD') && !g.includes('FEMALE')) return false;
      if (selectedGender === 'CO_LIVING' && !g.includes('CO') && !g.includes('UNI')) return false;
    }
    if (selectedAmenity) {
      const hasAmenity = p.amenities.some((a) => a.toLowerCase().includes(selectedAmenity.toLowerCase()));
      if (!hasAmenity) return false;
    }
    return true;
  });

  const handleCall = (mobile?: string) => {
    if (mobile) Linking.openURL(`tel:${mobile}`);
  };

  const handleWhatsApp = (pg: PublicPgSummary) => {
    if (!pg.mobile) return;
    const clean = pg.mobile.replace(/[^0-9]/g, '');
    const msg = `Hello, I saw *${pg.name}* on MyPG and would like to know more about vacant room/bed availability.`;
    Linking.openURL(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        {showBack && onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
        ) : (
          <View style={styles.logoWrap}>
            <Ionicons name="business" size={20} color="#fff" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Explore PGs & Hostels</Text>
          <Text style={styles.headerSub}>Find verified PGs with amenities & vacant beds</Text>
        </View>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by PG name, city, location, Wi-Fi, Food..."
            placeholderTextColor={colors.muted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filter Tabs / Chips ── */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, selectedGender === 'ALL' && !selectedAmenity && styles.filterChipActive]}
            onPress={() => {
              setSelectedGender('ALL');
              setSelectedAmenity(null);
            }}
          >
            <Text style={[styles.filterChipText, selectedGender === 'ALL' && !selectedAmenity && styles.filterChipTextActive]}>
              All PGs ({list.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedGender === 'GENTS' && styles.filterChipActive]}
            onPress={() => setSelectedGender(selectedGender === 'GENTS' ? 'ALL' : 'GENTS')}
          >
            <Ionicons name="man-outline" size={13} color={selectedGender === 'GENTS' ? '#fff' : colors.muted} />
            <Text style={[styles.filterChipText, selectedGender === 'GENTS' && styles.filterChipTextActive]}>Gents</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedGender === 'LADIES' && styles.filterChipActive]}
            onPress={() => setSelectedGender(selectedGender === 'LADIES' ? 'ALL' : 'LADIES')}
          >
            <Ionicons name="woman-outline" size={13} color={selectedGender === 'LADIES' ? '#fff' : colors.muted} />
            <Text style={[styles.filterChipText, selectedGender === 'LADIES' && styles.filterChipTextActive]}>Ladies</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedGender === 'CO_LIVING' && styles.filterChipActive]}
            onPress={() => setSelectedGender(selectedGender === 'CO_LIVING' ? 'ALL' : 'CO_LIVING')}
          >
            <Ionicons name="people-outline" size={13} color={selectedGender === 'CO_LIVING' ? '#fff' : colors.muted} />
            <Text style={[styles.filterChipText, selectedGender === 'CO_LIVING' && styles.filterChipTextActive]}>Co-Living</Text>
          </TouchableOpacity>

          {['Wi-Fi', 'Food', 'AC', 'Power Backup', 'Parking', 'Washing Machine'].map((amenity) => (
            <TouchableOpacity
              key={amenity}
              style={[styles.filterChip, selectedAmenity === amenity && styles.filterChipActive]}
              onPress={() => setSelectedAmenity(selectedAmenity === amenity ? null : amenity)}
            >
              <Ionicons
                name={getAmenityIcon(amenity)}
                size={13}
                color={selectedAmenity === amenity ? '#fff' : colors.muted}
              />
              <Text style={[styles.filterChipText, selectedAmenity === amenity && styles.filterChipTextActive]}>
                {amenity}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── PG List ── */}
      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ marginTop: 10, fontSize: 13, color: colors.muted }}>Loading verified PGs...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#2563eb']} />}
        >
          {filteredPgs.length === 0 && (
            <Empty text="No PGs match your search filters. Try clearing your filters." />
          )}

          {filteredPgs.map((pg) => {
            const hasVacancies = pg.vacantBeds > 0;
            const genderLabel =
              pg.genderType === 'GENTS' ? 'Gents PG' : pg.genderType === 'LADIES' ? 'Ladies PG' : 'Co-Living PG';
            const genderColor =
              pg.genderType === 'GENTS' ? '#2563eb' : pg.genderType === 'LADIES' ? '#db2777' : '#0d9488';

            return (
              <Pressable
                key={pg.id}
                style={styles.pgCard}
                onPress={() => onSelectPg(pg.id)}
                android_ripple={{ color: '#f1f5f9' }}
              >
                {/* Top Row: Name, Gender & Vacancy Pill */}
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <Text style={styles.pgName}>{pg.name}</Text>
                      <Badge
                        text={pg.stayType || 'PG'}
                        color={pg.stayType === 'APARTMENT' ? '#7c3aed' : pg.stayType === 'HOSTEL' ? '#ea580c' : '#2563eb'}
                      />
                      <Badge text={genderLabel} color={genderColor} />
                    </View>
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={13} color={colors.muted} />
                      <Text style={styles.locationText} numberOfLines={1}>
                        {pg.address ? `${pg.address}, ` : ''}{pg.city || ''} {pg.state ? `(${pg.state})` : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.priceBox}>
                    <Text style={styles.priceSub}>Starts from</Text>
                    <Text style={styles.priceVal}>{money(pg.startingPrice)}</Text>
                    <Text style={styles.priceMonth}>/month</Text>
                  </View>
                </View>

                {/* Description if present */}
                {pg.description ? (
                  <Text style={styles.descText} numberOfLines={2}>
                    {pg.description}
                  </Text>
                ) : null}

                {/* Amenities Badges Row */}
                <View style={styles.amenitiesRow}>
                  {pg.amenities.slice(0, 5).map((amenity, idx) => (
                    <View key={idx} style={styles.amenityBadge}>
                      <Ionicons name={getAmenityIcon(amenity)} size={12} color="#0f766e" />
                      <Text style={styles.amenityText}>{amenity}</Text>
                    </View>
                  ))}
                  {pg.amenities.length > 5 && (
                    <View style={[styles.amenityBadge, { backgroundColor: '#f1f5f9' }]}>
                      <Text style={[styles.amenityText, { color: colors.muted }]}>
                        +{pg.amenities.length - 5} more
                      </Text>
                    </View>
                  )}
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Bottom Stats & Action Bar */}
                <View style={styles.cardBottomRow}>
                  <View style={styles.bedStatusWrap}>
                    <View
                      style={[
                        styles.vacancyPill,
                        hasVacancies ? styles.vacancyPillOpen : styles.vacancyPillFull,
                      ]}
                    >
                      <Ionicons
                        name={hasVacancies ? 'bed' : 'close-circle'}
                        size={13}
                        color={hasVacancies ? '#16a34a' : '#dc2626'}
                      />
                      <Text
                        style={[
                          styles.vacancyPillText,
                          hasVacancies ? styles.vacancyPillTextOpen : styles.vacancyPillTextFull,
                        ]}
                      >
                        {hasVacancies ? `${pg.vacantBeds} Vacant Beds Available` : 'Fully Occupied'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    {pg.mobile ? (
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleCall(pg.mobile);
                        }}
                      >
                        <Ionicons name="call" size={14} color="#16a34a" />
                      </TouchableOpacity>
                    ) : null}
                    {pg.mobile ? (
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleWhatsApp(pg);
                        }}
                      >
                        <Ionicons name="logo-whatsapp" size={14} color="#16a34a" />
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.viewRoomsBtn}
                      onPress={() => onSelectPg(pg.id)}
                    >
                      <Text style={styles.viewRoomsBtnText}>View Beds</Text>
                      <Ionicons name="chevron-forward" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
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
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  searchSection: { backgroundColor: '#fff', paddingHorizontal: 14, paddingBottom: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a', paddingVertical: 0 },
  filterWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f2f5' },
  filterScroll: { paddingHorizontal: 14, paddingBottom: 10, gap: 8, flexDirection: 'row' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  listContent: { padding: 14, gap: 12, paddingBottom: 32 },
  pgCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pgName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  locationText: { fontSize: 12, color: colors.muted, flex: 1 },
  priceBox: { alignItems: 'flex-end', backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  priceSub: { fontSize: 9, color: colors.muted, fontWeight: '500' },
  priceVal: { fontSize: 16, fontWeight: '800', color: '#2563eb' },
  priceMonth: { fontSize: 9, color: '#2563eb', fontWeight: '600' },
  descText: { fontSize: 12, color: '#475569', marginTop: 8, lineHeight: 16 },
  amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  amenityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  amenityText: { fontSize: 10, fontWeight: '700', color: '#0f766e' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bedStatusWrap: { flex: 1 },
  vacancyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  vacancyPillOpen: { backgroundColor: '#f0fdf4' },
  vacancyPillFull: { backgroundColor: '#fef2f2' },
  vacancyPillText: { fontSize: 11, fontWeight: '700' },
  vacancyPillTextOpen: { color: '#16a34a' },
  vacancyPillTextFull: { color: '#dc2626' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  viewRoomsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  viewRoomsBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
