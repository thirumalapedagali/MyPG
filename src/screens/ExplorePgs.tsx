import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
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
import { errorMessage, get, qs } from '../api';
import { useResource } from '../hooks';
import { ImageGallery } from '../images';
import { Coords, getCurrentCoords, openLocationSettings } from '../location';
import { GeoPlace, Paged, PublicPgSummary, SharingType, StayCard } from '../types';
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

/** `INDEPENDENT_HOUSE` -> `Independent House`; the lookup table needs a login, which this public screen does not have. */
const typeCode = (code?: string | null) => (code || 'PG').toUpperCase();
const stayTypeLabel = (code?: string | null) =>
  (code || 'PG').toLowerCase().split('_').map((w) => (w === 'pg' ? 'PG' : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

const RADII = [1, 2, 5, 10, 20] as const;
type SortCode = 'NEAREST' | 'RENT_ASC' | 'RENT_DESC';
const SORTS: { code: SortCode; label: string }[] = [
  { code: 'NEAREST', label: 'Nearest' },
  { code: 'RENT_ASC', label: 'Lowest rent' },
  { code: 'RENT_DESC', label: 'Highest rent' },
];
const SHARINGS: { code: SharingType | null; label: string }[] = [
  { code: null, label: 'Any' },
  { code: 'PRIVATE', label: 'Single' },
  { code: 'TWO_SHARING', label: '2 Sharing' },
  { code: 'THREE_SHARING', label: '3 Sharing' },
  { code: 'FOUR_SHARING', label: '4 Sharing' },
];
const GENDER_API = { GENTS: 'MALE', LADIES: 'FEMALE', CO_LIVING: 'UNISEX' } as const;
const PAGE_SIZE = 20;

type Center = { latitude: number; longitude: number; label: string };

const placeLabel = (p: GeoPlace) =>
  [p.subLocality || p.locality, p.city].filter(Boolean).join(', ') || p.formattedAddress;

const distanceText = (km: number) => (km < 1 ? `${Math.max(1, Math.round(km * 1000))} m away` : `${km.toFixed(1)} km away`);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-11-12" -> "12 Nov". */
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''}`;

/** The list card is shared with the browse-all view, so a search result is shaped like a public summary. */
const toSummary = (c: StayCard): PublicPgSummary => ({
  id: c.propertyId,
  name: c.propertyName,
  ownerName: '',
  mobile: c.contactMobile ?? '',
  email: '',
  address: c.address || c.locality || '',
  city: c.city ?? '',
  state: c.state ?? '',
  totalFloors: 0,
  stayType: c.stayType,
  genderType: c.genderType,
  description: c.description ?? undefined,
  amenities: c.amenities,
  startingPrice: c.startingRent,
  totalRooms: 0,
  totalBeds: 0,
  vacantBeds: c.availableBeds,
  upcomingBeds: c.upcomingBeds,
  availableFrom: c.availableFrom,
  images: c.images,
  distanceKm: c.distanceKm,
  latitude: c.latitude,
  longitude: c.longitude,
  sharingOptions: c.sharingOptions,
});

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
  // The browse list opens with the first page of stays nearest to the phone; "Show more" fetches the next pages.
  // `here` is undefined while the position is being read, null when it could not be read (then the list is not sorted by distance).
  const [here, setHere] = useState<Coords | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    // Do not keep the list waiting on a slow GPS fix; a position that arrives later re-sorts the list.
    const giveUp = setTimeout(() => live && setHere((h) => (h === undefined ? null : h)), 8000);
    getCurrentCoords().then((r) => {
      if (!live) return;
      if (r.ok) setHere({ latitude: r.latitude, longitude: r.longitude });
      else setHere((h) => h ?? null);
    });
    return () => {
      live = false;
      clearTimeout(giveUp);
    };
  }, []);

  const browsePath = (page: number) =>
    '/api/public/pgs' + qs({ latitude: here?.latitude, longitude: here?.longitude, page, size: PAGE_SIZE });
  const {
    data: pgs,
    error,
    refreshing,
    refresh,
  } = useResource(async () => (here === undefined ? null : get<Paged<PublicPgSummary>>(browsePath(0))), [
    here === undefined,
    here?.latitude,
    here?.longitude,
  ]);
  const loading = !pgs && !error;
  const [browseExtra, setBrowseExtra] = useState<{ base: Paged<PublicPgSummary>; items: PublicPgSummary[]; page: number } | null>(
    null,
  );
  const [browseMoreBusy, setBrowseMoreBusy] = useState(false);
  const browseMoreItems = pgs && browseExtra?.base === pgs ? browseExtra.items : [];
  const browseLastPage = pgs && browseExtra?.base === pgs ? browseExtra.page : 0;
  const browseHasMore = !!pgs && browseLastPage + 1 < pgs.totalPages;
  const loadMoreBrowse = async () => {
    if (!pgs || browseMoreBusy) return;
    setBrowseMoreBusy(true);
    try {
      const r = await get<Paged<PublicPgSummary>>(browsePath(browseLastPage + 1));
      setBrowseExtra({ base: pgs, items: [...browseMoreItems, ...r.content], page: browseLastPage + 1 });
    } catch (e) {
      setNotice({ text: errorMessage(e) });
    } finally {
      setBrowseMoreBusy(false);
    }
  };

  const [search, setSearch] = useState('');
  const [selectedGender, setSelectedGender] = useState<'ALL' | 'GENTS' | 'LADIES' | 'CO_LIVING'>('ALL');
  const [selectedAmenity, setSelectedAmenity] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const list = [...(pgs?.content ?? []), ...browseMoreItems];
  // Only the types that are actually listed, most common first, so every chip leads to results.
  const typeCounts = new Map<string, number>();
  list.forEach((p) => typeCounts.set(typeCode(p.stayType), (typeCounts.get(typeCode(p.stayType)) ?? 0) + 1));
  const types = [...typeCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
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
    if (selectedType && typeCode(p.stayType) !== selectedType) return false;
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

  // ── Location search: GPS ("Near me") or a place picked from the suggestions ──
  const [center, setCenter] = useState<Center | null>(null);
  const [radius, setRadius] = useState<number>(5);
  const [sort, setSort] = useState<SortCode>('NEAREST');
  const [sharing, setSharing] = useState<SharingType | null>(null);
  const [minRent, setMinRent] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [availableOnly, setAvailableOnly] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; settings?: boolean } | null>(null);
  const [typing, setTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<{ forText: string; places: GeoPlace[] }>({ forText: '', places: [] });
  const [suggestState, setSuggestState] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const [suggestError, setSuggestError] = useState('');
  const [extra, setExtra] = useState<{ key: string; items: StayCard[]; page: number } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Autocomplete: wait for a pause in typing, and never ask for fewer than 3 characters.
  useEffect(() => {
    const text = search.trim();
    if (!typing || text.length < 3) return;
    let live = true;
    const timer = setTimeout(async () => {
      setSuggestState('loading');
      try {
        const places = await get<GeoPlace[]>('/api/locations/suggestions' + qs({ query: text }));
        if (!live) return;
        setSuggestions({ forText: text, places });
        setSuggestState(places.length ? 'idle' : 'empty');
      } catch (e) {
        if (!live) return;
        setSuggestions({ forText: text, places: [] });
        setSuggestError(errorMessage(e));
        setSuggestState('error');
      }
    }, 600);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [search, typing]);

  const minN = minRent.trim() === '' ? undefined : Number(minRent);
  const maxN = maxRent.trim() === '' ? undefined : Number(maxRent);
  const rentError =
    (minN !== undefined && (Number.isNaN(minN) || minN < 0)) || (maxN !== undefined && (Number.isNaN(maxN) || maxN < 0))
      ? 'Rent must be a number'
      : minN !== undefined && maxN !== undefined && minN > maxN
        ? 'Minimum rent is more than maximum'
        : null;

  const searchPath = (page: number) =>
    '/api/stays/nearby' +
    qs({
      latitude: center?.latitude,
      longitude: center?.longitude,
      radiusKm: radius,
      minRent: minN,
      maxRent: maxN,
      sharingType: sharing,
      stayType: selectedType,
      gender: selectedGender === 'ALL' ? undefined : GENDER_API[selectedGender],
      amenities: selectedAmenity,
      availableOnly: String(availableOnly),
      sortBy: sort,
      page,
      size: PAGE_SIZE,
    });
  // Everything that changes the result set; the first page reloads when it changes.
  const searchKey = center && !rentError ? searchPath(0) : '';
  const {
    data: found,
    error: searchError,
    reload: reloadSearch,
  } = useResource(async () => (searchKey ? { key: searchKey, page: await get<Paged<StayCard>>(searchKey) } : null), [searchKey]);
  const current = found && found.key === searchKey ? found.page : null;
  const searchBusy = !!searchKey && !current && !searchError;
  const moreItems = extra && extra.key === searchKey ? extra.items : [];
  const lastPage = extra && extra.key === searchKey ? extra.page : 0;
  const hasMore = !!current && lastPage + 1 < current.totalPages;
  const results = center ? [...(current?.content ?? []), ...moreItems].map(toSummary) : filteredPgs;

  const loadMore = async () => {
    if (!current || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await get<Paged<StayCard>>(searchPath(lastPage + 1));
      setExtra({ key: searchKey, items: [...moreItems, ...r.content], page: lastPage + 1 });
    } catch (e) {
      setNotice({ text: errorMessage(e) });
    } finally {
      setLoadingMore(false);
    }
  };

  const pickPlace = (p: GeoPlace) => {
    const label = placeLabel(p);
    setCenter({ latitude: p.latitude, longitude: p.longitude, label });
    setSearch(label);
    setTyping(false);
    setSuggestions({ forText: '', places: [] });
    setSuggestState('idle');
    setNotice(null);
  };

  const submitSearch = async () => {
    const text = search.trim();
    if (text.length < 3) return;
    setNotice(null);
    if (suggestions.forText === text && suggestions.places[0]) return pickPlace(suggestions.places[0]);
    try {
      const places = await get<GeoPlace[]>('/api/locations/suggestions' + qs({ query: text }));
      if (places[0]) pickPlace(places[0]);
      else setNotice({ text: `We could not find "${text}". Try a nearby area or the city name.` });
    } catch (e) {
      setNotice({ text: errorMessage(e) });
    }
  };

  const nearMe = async () => {
    setGpsBusy(true);
    setNotice(null);
    const r = await getCurrentCoords();
    setGpsBusy(false);
    if (r.ok) {
      setCenter({ latitude: r.latitude, longitude: r.longitude, label: 'Near me' });
      setSearch('');
      setTyping(false);
      setSuggestions({ forText: '', places: [] });
    } else {
      setNotice({ text: r.message, settings: r.openSettings });
    }
  };

  const clearSearch = () => {
    setSearch('');
    setCenter(null);
    setTyping(false);
    setNotice(null);
    setSuggestions({ forText: '', places: [] });
    setSuggestState('idle');
  };

  const openDirections = (pg: PublicPgSummary) => {
    if (pg.latitude != null && pg.longitude != null) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${pg.latitude},${pg.longitude}`);
    }
  };

  const handleCall = (mobile?: string) => {
    if (mobile) Linking.openURL(`tel:${mobile}`);
  };

  const handleWhatsApp = (pg: PublicPgSummary) => {
    if (!pg.mobile) return;
    const clean = pg.mobile.replace(/[^0-9]/g, '');
    const msg = `Hello, I saw *${pg.name}* on MyStay and would like to know more about vacant room/bed availability.`;
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
          <Text style={styles.headerTitle}>Explore Stays</Text>
          <Text style={styles.headerSub}>Find verified PGs, hostels, apartments, hotels & more</Text>
        </View>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={(t) => {
              setSearch(t);
              setTyping(true);
              if (t.trim().length < 3) {
                setSuggestions({ forText: '', places: [] });
                setSuggestState('idle');
              }
            }}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            placeholder="Search area, locality or landmark"
            placeholderTextColor={colors.muted}
          />
          {(search.length > 0 || center) && (
            <TouchableOpacity onPress={clearSearch} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.nearRow}>
          <TouchableOpacity
            style={[styles.nearBtn, center?.label === 'Near me' && styles.nearBtnOn]}
            onPress={nearMe}
            disabled={gpsBusy}
          >
            {gpsBusy ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Ionicons name="locate" size={15} color={center?.label === 'Near me' ? '#fff' : '#2563eb'} />
            )}
            <Text style={[styles.nearBtnText, center?.label === 'Near me' && { color: '#fff' }]}>
              {gpsBusy ? 'Finding you...' : 'Near me'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nearBtn} onPress={() => setShowFilters((v) => !v)}>
            <Ionicons name="options-outline" size={15} color="#2563eb" />
            <Text style={styles.nearBtnText}>Filters & sort</Text>
          </TouchableOpacity>
        </View>

        {notice && (
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle" size={16} color="#b45309" />
            <Text style={styles.noticeText}>{notice.text}</Text>
            {notice.settings && (
              <TouchableOpacity onPress={openLocationSettings}>
                <Text style={styles.noticeLink}>Settings</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {typing && search.trim().length >= 3 && (
          <View style={styles.suggestBox}>
            {suggestState === 'loading' && suggestions.forText !== search.trim() && (
              <Text style={styles.suggestHint}>Looking for places...</Text>
            )}
            {suggestState === 'error' && <Text style={styles.suggestHint}>{suggestError}</Text>}
            {suggestState === 'empty' && <Text style={styles.suggestHint}>No places found. Try a nearby area or the city.</Text>}
            {suggestions.places.map((p, i) => (
              <TouchableOpacity key={`${p.latitude},${p.longitude},${i}`} style={styles.suggestRow} onPress={() => pickPlace(p)}>
                <Ionicons name="location-outline" size={15} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestMain} numberOfLines={1}>
                    {placeLabel(p)}
                  </Text>
                  <Text style={styles.suggestSub} numberOfLines={1}>
                    {p.formattedAddress}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {center && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.panelLabel}>Within</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {RADII.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.filterChip, radius === r && styles.filterChipActive]}
                  onPress={() => setRadius(r)}
                >
                  <Text style={[styles.filterChipText, radius === r && styles.filterChipTextActive]}>{r} km</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {showFilters && (
          <View style={styles.panel}>
            {center && (
              <>
                <Text style={styles.panelLabel}>Sort by</Text>
                <View style={styles.panelRow}>
                  {SORTS.map((o) => (
                    <TouchableOpacity
                      key={o.code}
                      style={[styles.filterChip, sort === o.code && styles.filterChipActive]}
                      onPress={() => setSort(o.code)}
                    >
                      <Text style={[styles.filterChipText, sort === o.code && styles.filterChipTextActive]}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <Text style={styles.panelLabel}>Sharing</Text>
            <View style={styles.panelRow}>
              {SHARINGS.map((o) => (
                <TouchableOpacity
                  key={o.label}
                  style={[styles.filterChip, sharing === o.code && styles.filterChipActive]}
                  onPress={() => setSharing(o.code)}
                >
                  <Text style={[styles.filterChipText, sharing === o.code && styles.filterChipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.panelLabel}>Monthly rent</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <TextInput
                style={styles.rentInput}
                value={minRent}
                onChangeText={setMinRent}
                keyboardType="number-pad"
                placeholder="Min"
                placeholderTextColor={colors.muted}
              />
              <Text style={{ color: colors.muted }}>to</Text>
              <TextInput
                style={styles.rentInput}
                value={maxRent}
                onChangeText={setMaxRent}
                keyboardType="number-pad"
                placeholder="Max"
                placeholderTextColor={colors.muted}
              />
            </View>
            {rentError && <Text style={styles.rentError}>{rentError}</Text>}
            {center && (
              <TouchableOpacity style={styles.toggleRow} onPress={() => setAvailableOnly((v) => !v)}>
                <Ionicons name={availableOnly ? 'checkbox' : 'square-outline'} size={20} color="#2563eb" />
                <Text style={styles.toggleText}>Only stays with beds available now or soon</Text>
              </TouchableOpacity>
            )}
            {!center && <Text style={styles.suggestHint}>Pick Near me or an area to filter by rent, sharing and distance.</Text>}
          </View>
        )}
      </View>

      {/* ── Type of stay: Apartment, PG, Hostel... ── */}
      {list.length > 0 && (
        <View style={[styles.filterWrap, { borderBottomWidth: 0 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterChip, !selectedType && selectedGender === 'ALL' && !selectedAmenity && styles.filterChipActive]}
              onPress={() => {
                setSelectedType(null);
                setSelectedGender('ALL');
                setSelectedAmenity(null);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  !selectedType && selectedGender === 'ALL' && !selectedAmenity && styles.filterChipTextActive,
                ]}
              >
                All Stays ({list.length})
              </Text>
            </TouchableOpacity>
            {types.map(([code, count]) => {
              const on = selectedType === code;
              return (
                <TouchableOpacity
                  key={code}
                  style={[styles.filterChip, on && styles.filterChipActive]}
                  onPress={() => setSelectedType(on ? null : code)}
                >
                  <Text style={[styles.filterChipText, on && styles.filterChipTextActive]}>
                    {stayTypeLabel(code)} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Filter Tabs / Chips ── */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
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

      {/* ── Stay List ── */}
      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ marginTop: 10, fontSize: 13, color: colors.muted }}>Loading verified stays...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#2563eb']} />}
        >
          {center && current && (
            <Text style={styles.resultHead}>
              {`${current.totalElements} stay${current.totalElements === 1 ? '' : 's'} within ${radius} km of ${center.label}`}
            </Text>
          )}
          {center && searchError && <Text style={styles.rentError}>{searchError}</Text>}
          {searchBusy && <ActivityIndicator style={{ marginVertical: 24 }} color="#2563eb" />}
          {!searchBusy && results.length === 0 && !(center && searchError) && (
            <Empty
              text={
                center
                  ? `No stays within ${radius} km. Try a bigger distance or clear some filters.`
                  : 'No stays match your search filters. Try clearing your filters.'
              }
            />
          )}

          {results.map((pg) => {
            const hasVacancies = pg.vacantBeds > 0;
            const upcoming = pg.upcomingBeds ?? 0;
            // Nothing vacant today but a resident has given notice: say when it frees up instead of "Fully Occupied".
            const freeingSoon = !hasVacancies && upcoming > 0;
            const genderLabel =
              pg.genderType === 'GENTS' ? 'Gents' : pg.genderType === 'LADIES' ? 'Ladies' : 'Co-Living';
            const genderColor =
              pg.genderType === 'GENTS' ? '#2563eb' : pg.genderType === 'LADIES' ? '#db2777' : '#0d9488';

            return (
              <Pressable
                key={pg.id}
                style={styles.pgCard}
                onPress={() => onSelectPg(pg.id)}
                android_ripple={{ color: '#f1f5f9' }}
              >
                {pg.images && pg.images.length > 0 ? (
                  <View style={{ marginBottom: 12 }}>
                    <ImageGallery images={pg.images} height={170} />
                  </View>
                ) : null}

                {/* Top Row: Name, Gender & Vacancy Pill */}
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <Text style={styles.pgName}>{pg.name}</Text>
                      <Badge
                        text={stayTypeLabel(pg.stayType)}
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
                    {pg.distanceKm != null && (
                      <TouchableOpacity
                        style={styles.distanceRow}
                        disabled={pg.latitude == null}
                        onPress={() => openDirections(pg)}
                      >
                        <Ionicons name="navigate" size={12} color="#2563eb" />
                        <Text style={styles.distanceText}>{distanceText(pg.distanceKm)}</Text>
                        {pg.latitude != null && <Text style={styles.distanceLink}>Directions</Text>}
                      </TouchableOpacity>
                    )}
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

                {/* Sharing options with rent and beds left (location search results) */}
                {pg.sharingOptions && pg.sharingOptions.length > 0 ? (
                  <View style={styles.sharingWrap}>
                    {pg.sharingOptions.map((o) => (
                      <View key={o.sharingType} style={styles.sharingChip}>
                        <Text style={styles.sharingLabel}>
                          {pg.stayType === 'APARTMENT'
                            ? o.sharingType === 'PRIVATE' || o.sharingType === 'WHOLE_ROOM'
                              ? '1Bhk'
                              : o.sharingType === 'TWO_SHARING'
                              ? '2Bhk'
                              : o.sharingType === 'THREE_SHARING'
                              ? '3Bhk'
                              : o.sharingType === 'FOUR_SHARING'
                              ? '4Bhk'
                              : o.label
                            : o.label}
                        </Text>
                        <Text style={styles.sharingRent}>
                          {money(o.rentPerMonth)}
                          {o.maxRentPerMonth > o.rentPerMonth ? '+' : ''}
                          {o.depositPerMonth !== undefined && o.depositPerMonth > 0 && (
                            <Text style={{ fontSize: 10, fontWeight: '400', color: colors.muted }}>
                              {` (Dep: ${money(o.depositPerMonth)})`}
                            </Text>
                          )}
                        </Text>
                        <Text style={styles.sharingBeds}>
                          {o.availableBeds > 0
                            ? `${o.availableBeds} bed${o.availableBeds === 1 ? '' : 's'}`
                            : o.availableFrom
                              ? `from ${shortDate(o.availableFrom)}`
                              : '-'}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Divider */}
                <View style={styles.divider} />

                {/* Bottom Stats & Action Bar */}
                <View style={styles.cardBottomRow}>
                  <View style={styles.bedStatusWrap}>
                    <View
                      style={[
                        styles.vacancyPill,
                        hasVacancies ? styles.vacancyPillOpen : freeingSoon ? styles.vacancyPillSoon : styles.vacancyPillFull,
                      ]}
                    >
                      <Ionicons
                        name={hasVacancies ? 'bed' : freeingSoon ? 'time-outline' : 'close-circle'}
                        size={13}
                        color={hasVacancies ? '#16a34a' : freeingSoon ? '#b45309' : '#dc2626'}
                      />
                      <Text
                        style={[
                          styles.vacancyPillText,
                          hasVacancies
                            ? styles.vacancyPillTextOpen
                            : freeingSoon
                              ? styles.vacancyPillTextSoon
                              : styles.vacancyPillTextFull,
                        ]}
                      >
                        {hasVacancies
                          ? `${pg.vacantBeds} Vacant Beds Available`
                          : freeingSoon
                            ? `Available from ${pg.availableFrom ? shortDate(pg.availableFrom) : 'soon'}`
                            : 'Fully Occupied'}
                      </Text>
                    </View>
                    {hasVacancies && upcoming > 0 && (
                      <Text style={styles.soonNote}>
                        +{upcoming} more free{pg.availableFrom ? ` from ${shortDate(pg.availableFrom)}` : ' soon'}
                      </Text>
                    )}
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
                      <Text style={styles.viewRoomsBtnText}>
                        {pg.stayType === 'APARTMENT'
                          ? 'View Flats'
                          : pg.stayType === 'STUDIO'
                          ? 'View Studios'
                          : pg.stayType === 'HOUSE'
                          ? 'View House'
                          : 'View Beds'}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Pressable>
            );
          })}

          {!center && browseHasMore && (
            <TouchableOpacity style={styles.moreBtn} onPress={loadMoreBrowse} disabled={browseMoreBusy}>
              {browseMoreBusy ? (
                <ActivityIndicator color="#2563eb" />
              ) : (
                <Text style={styles.moreBtnText}>Show more stays</Text>
              )}
            </TouchableOpacity>
          )}
          {center && hasMore && (
            <TouchableOpacity style={styles.moreBtn} onPress={loadMore} disabled={loadingMore}>
              {loadingMore ? <ActivityIndicator color="#2563eb" /> : <Text style={styles.moreBtnText}>Show more stays</Text>}
            </TouchableOpacity>
          )}
          {center && searchError && (
            <TouchableOpacity style={styles.moreBtn} onPress={reloadSearch}>
              <Text style={styles.moreBtnText}>Try again</Text>
            </TouchableOpacity>
          )}
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
  nearRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  nearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  nearBtnOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  nearBtnText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  noticeText: { flex: 1, fontSize: 12, color: '#92400e' },
  noticeLink: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  suggestBox: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestMain: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  suggestSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  suggestHint: { fontSize: 12, color: colors.muted, padding: 10 },
  panel: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  panelLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, marginTop: 8, marginBottom: 6 },
  panelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rentInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  rentError: { fontSize: 12, color: '#dc2626', marginTop: 6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  toggleText: { fontSize: 13, color: '#0f172a' },
  resultHead: { fontSize: 12, fontWeight: '700', color: colors.muted },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  distanceText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  distanceLink: { fontSize: 11, color: '#2563eb', textDecorationLine: 'underline', marginLeft: 4 },
  sharingWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  sharingChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    minWidth: 84,
  },
  sharingLabel: { fontSize: 11, fontWeight: '700', color: '#166534' },
  sharingRent: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginTop: 1 },
  sharingBeds: { fontSize: 10, color: colors.muted },
  moreBtn: {
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    marginTop: 4,
  },
  moreBtnText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
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
  vacancyPillSoon: { backgroundColor: '#fffbeb' },
  vacancyPillText: { fontSize: 11, fontWeight: '700' },
  vacancyPillTextOpen: { color: '#16a34a' },
  vacancyPillTextFull: { color: '#dc2626' },
  vacancyPillTextSoon: { color: '#b45309' },
  soonNote: { fontSize: 11, color: '#b45309', fontWeight: '600', marginTop: 3 },
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
