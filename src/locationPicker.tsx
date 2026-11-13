import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { errorMessage, get, qs } from './api';
import { getCurrentCoords } from './location';
import { GeoPlace } from './types';

const colors = { primary: '#2e7d32', primaryLight: '#e8f5e9', muted: '#57606a', border: '#e5e7eb', bad: '#c62828' };

const title = (p: GeoPlace) => [p.subLocality || p.locality, p.city].filter(Boolean).join(', ') || p.formattedAddress;

/**
 * Where a new property is. The owner stands at the property and uses the phone's GPS, or searches the area; either
 * gives the coordinates that make the property show up in "Near me" and area searches. Optional: leave it empty and
 * set it later in Property Setup. The form that owns this keeps the place in state and sends it with `newPropertyBody`.
 */
export function LocationPickerField({ value, onChange }: { value: GeoPlace | null; onChange: (p: GeoPlace | null) => void }) {
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<GeoPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const choose = (p: GeoPlace | null) => {
    onChange(p);
    setPlaces([]);
    setQuery('');
    setMessage('');
  };

  const locateHere = async () => {
    setBusy(true);
    setMessage('');
    const r = await getCurrentCoords();
    setBusy(false);
    if (!r.ok) return setMessage(r.message);
    choose({
      formattedAddress: `Current position (${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)})`,
      latitude: r.latitude,
      longitude: r.longitude,
    });
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

  const chip = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  };

  return (
    <View>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6, marginTop: 14 }}>
        Location on map (so residents can find it nearby)
      </Text>
      {value ? (
        <View style={[chip, { height: undefined, paddingVertical: 10, justifyContent: 'space-between' }]}>
          <Ionicons name="location" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.primary }} numberOfLines={1}>
              {title(value)}
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>
              {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            </Text>
          </View>
          <Pressable hitSlop={8} onPress={() => choose(null)}>
            <Ionicons name="close-circle" size={22} color={colors.bad} />
          </Pressable>
        </View>
      ) : (
        <>
          <Pressable onPress={() => !busy && locateHere()} style={chip}>
            <Ionicons name="locate" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Use my current location</Text>
            {busy && <ActivityIndicator size="small" color={colors.primary} />}
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={find}
              placeholder="Or search the area, e.g. HSR Layout, Bengaluru"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, height: 42 }}
            />
            <Pressable onPress={() => !busy && find()} style={[chip, { justifyContent: 'center' }]}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Find</Text>
            </Pressable>
          </View>
          {places.map((p, i) => (
            <Pressable
              key={`${p.latitude},${p.longitude},${i}`}
              onPress={() => choose(p)}
              style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <Text style={{ fontWeight: '600' }} numberOfLines={1}>
                {title(p)}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={2}>
                {p.formattedAddress}
              </Text>
            </Pressable>
          ))}
        </>
      )}
      {!!message && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>{message}</Text>}
    </View>
  );
}
