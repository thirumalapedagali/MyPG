import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { get, post } from '../api';
import { attempt, useResource } from '../hooks';
import { STAY_TYPE } from '../lookups';
import { ConfigAmenity, ConfigField, ConfigPropertyType, ConfigPropertyTypeDetail } from '../types';
import { Badge, Button, Card, Chips, Empty, FormModal, HeaderAction, PickerModal, Screen, colors, s } from '../ui';

const KEY = /^[A-Za-z][A-Za-z0-9_]*$/;

type Data = { types: ConfigPropertyType[]; amenities: ConfigAmenity[]; fields: ConfigField[] };

/**
 * Super admin: choose which amenities and custom fields each property type offers. A new property type is just a
 * new STAY_TYPE lookup value; map it here and owners see the matching configuration form, with no app update.
 */
export default function PropertyTypes() {
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const [code, setCode] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [pickAmenity, setPickAmenity] = useState(false);
  const [pickField, setPickField] = useState(false);
  const [adding, setAdding] = useState(false);

  const catalog = useResource<Data>(async () => {
    const [types, amenities, fields] = await Promise.all([
      get<ConfigPropertyType[]>('/api/config/property-types'),
      get<ConfigAmenity[]>('/api/config/amenities'),
      get<ConfigField[]>('/api/admin/property-fields'),
    ]);
    return { types, amenities, fields: fields.filter((f) => f.active) };
  }, [version]);

  const types = catalog.data?.types ?? [];
  const current = code ?? types[0]?.code ?? null;
  const detail = useResource<ConfigPropertyTypeDetail | null>(
    () => (current ? get<ConfigPropertyTypeDetail>(`/api/config/property-types/${current}`) : Promise.resolve(null)),
    [current, version],
  );

  const reload = () => setVersion((v) => v + 1);
  const d = detail.data;
  const mappedAmenities = new Set(d?.amenities.map((m) => m.amenity.code));
  const mappedFields = new Set(d?.fields.map((m) => m.field.code));
  const freeAmenities = (catalog.data?.amenities ?? []).filter((a) => !mappedAmenities.has(a.code));
  const freeFields = (catalog.data?.fields ?? []).filter((f) => !mappedFields.has(f.code));

  const mapAmenity = async (amenityCode: string, patch: object = {}) => {
    if (await attempt(() => post(`/api/admin/property-types/${current}/amenities`, { amenityCode, active: true, ...patch }))) reload();
  };
  const mapField = async (fieldCode: string, patch: object = {}) => {
    if (await attempt(() => post(`/api/admin/property-types/${current}/fields`, { fieldCode, active: true, ...patch }))) reload();
  };
  const confirmRemove = (name: string, run: () => void) =>
    Alert.alert('Remove', `${name} will no longer be asked for ${d?.label}. Saved answers are kept.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: run },
    ]);

  return (
    <Screen
      title="Property Types"
      action={
        <View style={{ flexDirection: 'row' }}>
          <HeaderAction label="New type" icon="add-circle" onPress={() => setAdding(true)} />
          <HeaderAction label="Back" icon="chevron-back" onPress={() => nav.goBack()} />
        </View>
      }
      loading={catalog.loading}
      error={catalog.error}
      refreshing={catalog.refreshing}
      onRefresh={() => {
        catalog.refresh();
        detail.refresh();
      }}
    >
      <Text style={[s.muted, { fontSize: 12, marginBottom: 8 }]}>
        Pick a property type, then choose the amenities and fields owners of that type are asked about.
      </Text>
      {types.length > 0 && (
        <Chips options={types.map((t) => t.label)} value={types.find((t) => t.code === current)?.label ?? ''} onChange={(l) => setCode(types.find((t) => t.label === l)?.code ?? null)} />
      )}

      {detail.error && <Text style={{ color: colors.bad, marginBottom: 8 }}>{detail.error}</Text>}

      {d && (
        <>
          <View style={[s.row, { marginTop: 4, marginBottom: 6 }]}>
            <Text style={s.h2}>Amenities</Text>
            <Button small label="Add amenity" onPress={() => setPickAmenity(true)} />
          </View>
          {d.amenities.length === 0 && <Empty text={`No amenities for ${d.label} yet.`} />}
          {d.amenities.map((m) => (
            <Card key={m.amenity.id} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
              <View style={[s.row, { alignItems: 'flex-start' }]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={s.h2}>{m.amenity.name}</Text>
                  <Text style={[s.muted, { fontSize: 12, marginTop: 2 }]}>
                    {m.amenity.categoryName} · {m.amenity.applicableLevel === 'BOTH' ? 'property & room' : m.amenity.applicableLevel.toLowerCase()}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {m.required && <Badge text="Required" color={colors.warn} />}
                  {m.defaultSelected && !m.required && <Badge text="Pre-selected" color={colors.blue} />}
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <Button small kind="ghost" label={m.required ? 'Make optional' : 'Make required'} onPress={() => mapAmenity(m.amenity.code, { required: !m.required })} />
                {!m.required && (
                  <Button small kind="ghost" label={m.defaultSelected ? 'Don\u2019t pre-select' : 'Pre-select'} onPress={() => mapAmenity(m.amenity.code, { defaultSelected: !m.defaultSelected })} />
                )}
                <Button small kind="danger" label="Remove" onPress={() => confirmRemove(m.amenity.name, () => mapAmenity(m.amenity.code, { active: false, required: false }))} />
              </View>
            </Card>
          ))}

          <View style={[s.row, { marginTop: 14, marginBottom: 6 }]}>
            <Text style={s.h2}>Fields</Text>
            <Button small label="Add field" onPress={() => setPickField(true)} />
          </View>
          {d.fields.length === 0 && <Empty text={`No extra fields for ${d.label} yet.`} />}
          {d.fields.map((m) => (
            <Card key={m.field.id} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
              <View style={[s.row, { alignItems: 'flex-start' }]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={s.h2}>{m.field.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Ionicons name="create-outline" size={12} color={colors.muted} />
                    <Text style={[s.muted, { fontSize: 12 }]}>{m.field.fieldType}</Text>
                  </View>
                </View>
                {m.required && <Badge text="Required" color={colors.warn} />}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {/* A field that is required by its own definition cannot be made optional for one type. */}
                {!m.field.required && (
                  <Button small kind="ghost" label={m.required ? 'Make optional' : 'Make required'} onPress={() => mapField(m.field.code, { required: !m.required })} />
                )}
                <Button small kind="danger" label="Remove" onPress={() => confirmRemove(m.field.label, () => mapField(m.field.code, { active: false, required: false }))} />
              </View>
            </Card>
          ))}
        </>
      )}

      <PickerModal
        visible={pickAmenity}
        title={`Add amenity to ${d?.label ?? ''}`}
        items={freeAmenities}
        label={(a) => `${a.name} · ${a.categoryName}`}
        onClose={() => setPickAmenity(false)}
        onPick={(a) => {
          setPickAmenity(false);
          mapAmenity(a.code, { sortOrder: (d?.amenities.length ?? 0) + 1 });
        }}
      />
      <PickerModal
        visible={pickField}
        title={`Add field to ${d?.label ?? ''}`}
        items={freeFields}
        label={(f) => `${f.label} · ${f.fieldType}`}
        onClose={() => setPickField(false)}
        onPick={(f) => {
          setPickField(false);
          mapField(f.code, { sortOrder: (d?.fields.length ?? 0) + 1 });
        }}
      />

      <FormModal
        visible={adding}
        title="New property type"
        fields={[
          { key: 'code', label: 'Code (e.g. CAMPSITE)' },
          { key: 'label', label: 'Name (shown to users)' },
          { key: 'extra', label: 'What a unit is called (e.g. Tent, Flat, Room)', initial: 'Room' },
        ]}
        onClose={() => setAdding(false)}
        onSubmit={async (v) => {
          if (!KEY.test(v.code)) {
            Alert.alert('Invalid', 'Code must start with a letter and use only letters, digits and _.');
            return false;
          }
          const ok = await attempt(() =>
            post('/api/admin/lookups', { category: STAY_TYPE, code: v.code, label: v.label, extra: v.extra, sortOrder: types.length + 1 }),
          );
          if (!ok) return false;
          setAdding(false);
          setCode(v.code.toUpperCase());
          reload();
        }}
      />
    </Screen>
  );
}
