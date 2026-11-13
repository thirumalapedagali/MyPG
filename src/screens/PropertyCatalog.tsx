import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { get, post, put } from '../api';
import { attempt, useResource } from '../hooks';
import { AmenityLevel, ConfigAmenity, ConfigCategory, ConfigField, ConfigFieldType } from '../types';
import { Badge, Button, Card, Chips, Empty, FormModal, HeaderAction, Screen, colors, s } from '../ui';

const TABS = ['Amenities', 'Fields'] as const;
type Tab = (typeof TABS)[number];

const KEY = /^[A-Za-z][A-Za-z0-9_]*$/;
const LEVELS: { code: AmenityLevel; label: string }[] = [
  { code: 'PROPERTY', label: 'Whole property' },
  { code: 'ROOM', label: 'Single room' },
  { code: 'BOTH', label: 'Property and room' },
];
const LEVEL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.code, l.label]));
const FIELD_TYPES: ConfigFieldType[] = [
  'TEXT', 'NUMBER', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DROPDOWN', 'MULTI_SELECT', 'CHECKBOX', 'RADIO', 'IMAGE', 'DOCUMENT',
];
const YES_NO = [
  { code: 'NO', label: 'No' },
  { code: 'YES', label: 'Yes' },
];
const hasOptions = (t: string) => ['DROPDOWN', 'MULTI_SELECT', 'CHECKBOX', 'RADIO'].includes(t);

type Catalog = { amenities: ConfigAmenity[]; fields: ConfigField[]; categories: ConfigCategory[] };

/**
 * Super admin: the master lists behind property configuration. Amenities and custom fields are data, so adding
 * one here makes it available to every property type that is mapped to it (see the Property types screen).
 * Entries are hidden rather than deleted, because properties may already use them.
 */
export default function PropertyCatalog() {
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const { data, error, loading, refreshing, refresh, reload } = useResource<Catalog>(async () => {
    const [amenities, fields, categories] = await Promise.all([
      get<ConfigAmenity[]>('/api/admin/amenities'),
      get<ConfigField[]>('/api/admin/property-fields'),
      get<ConfigCategory[]>('/api/config/amenity-categories'),
    ]);
    return { amenities, fields, categories };
  });
  const [tab, setTab] = useState<Tab>('Amenities');
  const [amenity, setAmenity] = useState<ConfigAmenity | 'new' | null>(null);
  const [field, setField] = useState<ConfigField | 'new' | null>(null);

  const setActive = async (url: string, active: boolean) => {
    if (await attempt(() => put(url, { active }))) reload();
  };
  const confirmHide = (name: string, url: string) =>
    Alert.alert('Hide', `${name} will no longer be offered. Properties that already use it keep their saved value.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Hide', style: 'destructive', onPress: () => setActive(url, false) },
    ]);

  const categoryOptions = (data?.categories ?? []).map((c) => ({ code: c.code, label: c.name }));
  const newAmenity = amenity === 'new';
  const editAmenity = amenity && amenity !== 'new' ? amenity : null;
  const newField = field === 'new';
  const editField = field && field !== 'new' ? field : null;

  return (
    <Screen
      title="Amenities & Fields"
      action={
        <View style={{ flexDirection: 'row' }}>
          <HeaderAction label="Add" icon="add-circle" onPress={() => (tab === 'Amenities' ? setAmenity('new') : setField('new'))} />
          <HeaderAction label="Back" icon="chevron-back" onPress={() => nav.goBack()} />
        </View>
      }
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <Text style={[s.muted, { fontSize: 12, marginBottom: 8 }]}>
        {tab === 'Amenities'
          ? 'Facilities a property or room can offer. One amenity can be reused by many property types.'
          : 'Extra questions a property type can ask the owner, such as gate timings or star rating.'}
      </Text>
      <Chips options={TABS} value={tab} onChange={setTab} />

      {data && tab === 'Amenities' && (
        <>
          {data.amenities.length === 0 && <Empty text="No amenities yet. Tap Add to create one." />}
          {data.amenities.map((a, i) => (
            <View key={a.id}>
              {(i === 0 || data.amenities[i - 1].categoryCode !== a.categoryCode) && (
                <Text style={[s.muted, { fontSize: 11, fontWeight: '700', marginTop: 6, marginBottom: 4 }]}>
                  {a.categoryName.toUpperCase()}
                </Text>
              )}
              <Card style={{ paddingVertical: 10, paddingHorizontal: 12, opacity: a.active ? 1 : 0.6 }}>
                <View style={[s.row, { alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={s.h2}>{a.name}</Text>
                    <Text style={[s.muted, { fontSize: 12, marginTop: 2 }]}>
                      {a.code} · {LEVEL_LABEL[a.applicableLevel]}
                    </Text>
                    {!!a.description && <Text style={[s.muted, { fontSize: 12, marginTop: 2 }]}>{a.description}</Text>}
                    {!!a.icon && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Ionicons name="image-outline" size={12} color={colors.muted} />
                        <Text style={[s.muted, { fontSize: 12 }]}>{a.icon}</Text>
                      </View>
                    )}
                  </View>
                  <Badge text={a.active ? 'Active' : 'Hidden'} color={a.active ? colors.good : colors.muted} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                  <Button small label="Edit" onPress={() => setAmenity(a)} />
                  <Button
                    small
                    kind="ghost"
                    label={a.active ? 'Hide' : 'Show'}
                    onPress={() => (a.active ? confirmHide(a.name, `/api/admin/amenities/${a.id}`) : setActive(`/api/admin/amenities/${a.id}`, true))}
                  />
                </View>
              </Card>
            </View>
          ))}
        </>
      )}

      {data && tab === 'Fields' && (
        <>
          {data.fields.length === 0 && <Empty text="No fields yet. Tap Add to create one." />}
          {data.fields.map((f) => (
            <Card key={f.id} style={{ paddingVertical: 10, paddingHorizontal: 12, opacity: f.active ? 1 : 0.6 }}>
              <View style={[s.row, { alignItems: 'flex-start' }]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={s.h2}>{f.label}</Text>
                  <Text style={[s.muted, { fontSize: 12, marginTop: 2 }]}>
                    {f.code} · {f.fieldType}
                    {f.category ? ` · ${f.category}` : ''}
                  </Text>
                  {!!f.options?.length && (
                    <Text style={[s.muted, { fontSize: 12, marginTop: 2 }]}>Options: {f.options.map((o) => o.label).join(', ')}</Text>
                  )}
                  {!!f.validationRules && (
                    <Text style={[s.muted, { fontSize: 12, marginTop: 2 }]}>
                      Rules: {Object.entries(f.validationRules).map(([k, v]) => `${k} ${v}`).join(', ')}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge text={f.active ? 'Active' : 'Hidden'} color={f.active ? colors.good : colors.muted} />
                  {f.required && <Badge text="Required" color={colors.warn} />}
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                <Button small label="Edit" onPress={() => setField(f)} />
                <Button
                  small
                  kind="ghost"
                  label={f.active ? 'Hide' : 'Show'}
                  onPress={() => (f.active ? confirmHide(f.label, `/api/admin/property-fields/${f.id}`) : setActive(`/api/admin/property-fields/${f.id}`, true))}
                />
              </View>
            </Card>
          ))}
        </>
      )}

      <FormModal
        visible={amenity != null}
        title={newAmenity ? 'Add amenity' : `Edit · ${editAmenity?.name ?? ''}`}
        fields={[
          ...(newAmenity ? [{ key: 'code', label: 'Code (e.g. SAUNA)' }] : []),
          { key: 'name', label: 'Name (shown to users)', initial: editAmenity?.name },
          { key: 'categoryCode', label: 'Category', options: categoryOptions, initial: editAmenity?.categoryCode },
          { key: 'applicableLevel', label: 'Can be set on', options: LEVELS, initial: editAmenity?.applicableLevel ?? 'BOTH' },
          { key: 'icon', label: 'Icon name (optional, e.g. wifi-outline)', initial: editAmenity?.icon ?? undefined, optional: true },
          { key: 'description', label: 'Description (optional)', initial: editAmenity?.description ?? undefined, optional: true },
        ]}
        onClose={() => setAmenity(null)}
        onSubmit={async (v) => {
          if (newAmenity && !KEY.test(v.code)) {
            Alert.alert('Invalid', 'Code must start with a letter and use only letters, digits and _.');
            return false;
          }
          const body = {
            name: v.name,
            categoryCode: v.categoryCode,
            applicableLevel: v.applicableLevel,
            icon: v.icon ?? '',
            description: v.description ?? '',
          };
          const ok = await attempt(() =>
            newAmenity ? post('/api/admin/amenities', { ...body, code: v.code }) : put(`/api/admin/amenities/${editAmenity!.id}`, body),
          );
          if (!ok) return false;
          setAmenity(null);
          reload();
        }}
      />

      <FormModal
        visible={field != null}
        title={newField ? 'Add field' : `Edit · ${editField?.label ?? ''}`}
        fields={[
          ...(newField
            ? [
                { key: 'code', label: 'Code (e.g. GATE_CLOSING_TIME)' },
                { key: 'fieldType', label: 'Type', options: FIELD_TYPES.map((t) => ({ code: t, label: t })) },
                { key: 'options', label: 'Options, comma separated (dropdown, radio, checkbox, multi-select)', optional: true },
                { key: 'min', label: 'Minimum (number) or minimum length (text)', keyboard: 'number-pad' as const, optional: true },
                { key: 'max', label: 'Maximum (number) or maximum length (text)', keyboard: 'number-pad' as const, optional: true },
              ]
            : []),
          { key: 'label', label: 'Label (shown to the owner)', initial: editField?.label },
          { key: 'category', label: 'Group (optional, e.g. Rules)', initial: editField?.category ?? undefined, optional: true },
          { key: 'placeholder', label: 'Hint text (optional)', initial: editField?.placeholder ?? undefined, optional: true },
          { key: 'defaultValue', label: 'Default value (optional)', initial: editField?.defaultValue ?? undefined, optional: true },
          { key: 'required', label: 'Always required?', options: YES_NO, initial: editField?.required ? 'YES' : 'NO' },
          { key: 'sortOrder', label: 'Sort order (smaller shows first)', keyboard: 'number-pad', initial: String(editField?.sortOrder ?? 0), optional: true },
        ]}
        onClose={() => setField(null)}
        onSubmit={async (v) => {
          if (newField && !KEY.test(v.code)) {
            Alert.alert('Invalid', 'Code must start with a letter and use only letters, digits and _.');
            return false;
          }
          const sortOrder = parseInt(v.sortOrder || '0', 10);
          if (Number.isNaN(sortOrder)) {
            Alert.alert('Invalid', 'Sort order must be a number.');
            return false;
          }
          const common = {
            label: v.label,
            category: v.category ?? '',
            placeholder: v.placeholder ?? '',
            defaultValue: v.defaultValue ?? '',
            required: v.required === 'YES',
            sortOrder,
          };
          if (!newField) {
            if (!(await attempt(() => put(`/api/admin/property-fields/${editField!.id}`, common)))) return false;
            setField(null);
            reload();
            return;
          }
          const list = (v.options ?? '').split(',').map((o) => o.trim()).filter(Boolean);
          if (hasOptions(v.fieldType) && list.length === 0) {
            Alert.alert('Options needed', 'Type the choices separated by commas.');
            return false;
          }
          const isText = v.fieldType === 'TEXT';
          const isNum = v.fieldType === 'NUMBER' || v.fieldType === 'DECIMAL';
          const lo = v.min ? Number(v.min) : undefined;
          const hi = v.max ? Number(v.max) : undefined;
          if ((lo !== undefined && Number.isNaN(lo)) || (hi !== undefined && Number.isNaN(hi))) {
            Alert.alert('Invalid', 'Minimum and maximum must be numbers.');
            return false;
          }
          const rules: Record<string, number> = {};
          if (lo !== undefined && (isText || isNum)) rules[isText ? 'minLength' : 'min'] = lo;
          if (hi !== undefined && (isText || isNum)) rules[isText ? 'maxLength' : 'max'] = hi;
          const ok = await attempt(() =>
            post('/api/admin/property-fields', {
              ...common,
              code: v.code,
              fieldType: v.fieldType,
              options: hasOptions(v.fieldType) ? list : undefined,
              validationRules: Object.keys(rules).length ? rules : undefined,
            }),
          );
          if (!ok) return false;
          setField(null);
          reload();
        }}
      />
    </Screen>
  );
}
