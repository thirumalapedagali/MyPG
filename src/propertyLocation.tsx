import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { errorMessage, get, put, qs } from './api';
import { getCurrentCoords } from './location';
import { GeoPlace } from './types';
import { Button, colors, s } from './ui';

type Profile = {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  locality?: string | null;
  subLocality?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
};

/**
 * Owner: tell residents where the property is. Without coordinates a property does not appear in "Near me" or area
 * searches. The position comes from the phone's GPS (stand at the property) or from a searched place.
 */
export function PropertyLocationEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<GeoPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;
    get<Profile>('/api/pg/profile')
      .then((p) => live && setProfile(p))
      .catch((e) => live && setMessage(errorMessage(e)));
    return () => {
      live = false;
    };
  }, []);

  const save = async (patch: Partial<Profile>) => {
    if (!profile) return;
    setBusy(true);
    try {
      const saved = await put<Profile>('/api/pg/profile', { name: profile.name, ...patch });
      setProfile(saved);
      setPlaces([]);
      setQuery('');
      setMessage('Location saved. Residents can now find this property by area.');
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const locateHere = async () => {
    setBusy(true);
    setMessage('');
    const r = await getCurrentCoords();
    setBusy(false);
    if (!r.ok) return setMessage(r.message);
    Alert.alert('Use this position?', 'Do this while you are at the property so residents are guided to the right place.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: () => save({ latitude: r.latitude, longitude: r.longitude }) },
    ]);
  };

  const find = async () => {
    if (query.trim().length < 3) return setMessage('Type at least 3 letters of the area or landmark.');
    setBusy(true);
    setMessage('');
    try {
      const found = await get<GeoPlace[]>('/api/locations/suggestions' + qs({ query: query.trim() }));
      setPlaces(found);
      if (!found.length) setMessage('No place found. Try a nearby landmark or the city name.');
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const pick = (p: GeoPlace) =>
    save({
      latitude: p.latitude,
      longitude: p.longitude,
      locality: p.locality ?? undefined,
      subLocality: p.subLocality ?? undefined,
      city: p.city ?? undefined,
      state: p.state ?? undefined,
      pincode: p.pincode ?? undefined,
      country: p.country ?? undefined,
    } as Partial<Profile>);

  if (!profile) return message ? <Text style={[s.muted, { color: colors.bad }]}>{message}</Text> : <ActivityIndicator />;

  const has = profile.latitude != null && profile.longitude != null;
  return (
    <View>
      <Text style={s.muted}>
        {has
          ? `Saved: ${[profile.subLocality || profile.locality, profile.city].filter(Boolean).join(', ') || 'position set'} (${profile.latitude!.toFixed(5)}, ${profile.longitude!.toFixed(5)})`
          : 'Not set yet - this property will not show up in location searches.'}
      </Text>
      <View style={{ marginTop: 10 }}>
        <Button label={busy ? 'Please wait...' : 'Use my current location'} onPress={() => !busy && locateHere()} />
      </View>
      <Text style={[s.muted, { marginTop: 12 }]}>Or search the area</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={find}
          placeholder="e.g. Marathahalli, Bengaluru"
          placeholderTextColor={colors.muted}
          style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, height: 42 }}
        />
        <Button label="Find" small onPress={() => !busy && find()} />
      </View>
      {places.map((p, i) => (
        <Pressable key={`${p.latitude},${p.longitude},${i}`} onPress={() => pick(p)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={s.h2} numberOfLines={1}>
            {[p.subLocality || p.locality, p.city].filter(Boolean).join(', ') || p.formattedAddress}
          </Text>
          <Text style={[s.muted, { fontSize: 12 }]} numberOfLines={2}>
            {p.formattedAddress}
          </Text>
        </Pressable>
      ))}
      {!!message && <Text style={[s.muted, { marginTop: 8 }]}>{message}</Text>}
    </View>
  );
}
