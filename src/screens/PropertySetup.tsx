import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { get, put } from '../api';
import { useAuth } from '../auth';
import { DateField } from '../dateField';
import { attempt, useResource } from '../hooks';
import { PictureManager } from '../images';
import { PropertyLocationEditor } from '../propertyLocation';
import { ConfigField, PropertyConfiguration } from '../types';
import { Button, Card, Empty, HeaderAction, Screen, colors, s } from '../ui';

type Val = string | boolean | string[] | null;

/** What the form holds for a saved value: numbers become text so they can be edited. */
const toDraft = (v: PropertyConfiguration['fields'][number]['value']): Val => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return String(v);
  return v;
};

const isEmpty = (v: Val) => v === null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Owner: describe the active property. The questions and amenities shown depend on the property type
 * (set up by the administrator), so a hotel and a PG see different things without any app change.
 */
export default function PropertySetup() {
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const { user } = useAuth();
  const pgId = user?.pgId;
  const [version, setVersion] = useState(0);
  const { data, error, loading, refreshing, refresh } = useResource<PropertyConfiguration | null>(
    async () => (pgId ? get<PropertyConfiguration>(`/api/properties/${pgId}/configuration`) : null),
    [pgId, version],
  );

  return (
    <Screen
      title="Property Setup"
      subtitle={data ? `${data.name} Â· ${data.stayTypeLabel}` : undefined}
      action={<HeaderAction label="Back" icon="chevron-back" onPress={() => nav.goBack()} />}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {data && (
        <Card>
          <Text style={s.h2}>Property location</Text>
          <PropertyLocationEditor key={data.propertyId} />
        </Card>
      )}
      {data && (
        <Card>
          <Text style={s.h2}>Property pictures</Text>
          <Text style={s.muted}>Up to 10 pictures. Add again any that did not upload.</Text>
          <PictureManager path={`/api/media/property/${data.propertyId}`} />
        </Card>
      )}
      {data && <SetupForm key={`${data.propertyId}-${version}`} config={data} onSaved={() => setVersion((v) => v + 1)} />}
    </Screen>
  );
}

function SetupForm({ config, onSaved }: { config: PropertyConfiguration; onSaved: () => void }) {
  const untouched = !config.amenities.some((a) => a.selected);
  const [picked, setPicked] = useState<Set<string>>(
    () =>
      new Set(
        config.amenities
          .filter((a) => a.required || a.selected || (untouched && a.defaultSelected))
          .map((a) => a.amenity.code),
      ),
  );
  const [draft, setDraft] = useState<Record<string, Val>>(() =>
    Object.fromEntries(config.fields.map((f) => [f.field.code, toDraft(f.value)])),
  );
  const [saving, setSaving] = useState(false);

  const toggle = (code: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(code)) next.add(code);
      return next;
    });

  const save = async () => {
    const fields: Record<string, string | number | boolean | string[] | null> = {};
    for (const f of config.fields) {
      const raw = draft[f.field.code] ?? null;
      if (isEmpty(raw)) {
        if (f.required) return Alert.alert('Missing details', `${f.field.label} is required.`);
        fields[f.field.code] = null;
        continue;
      }
      if (f.field.fieldType === 'NUMBER' || f.field.fieldType === 'DECIMAL') {
        const n = Number(raw);
        if (Number.isNaN(n)) return Alert.alert('Invalid value', `${f.field.label} must be a number.`);
        fields[f.field.code] = n;
      } else {
        fields[f.field.code] = raw;
      }
    }
    const amenities = config.amenities
      .filter((a) => picked.has(a.amenity.code))
      .map((a) => ({ code: a.amenity.code, enabled: true, notes: a.notes }));
    setSaving(true);
    const ok = await attempt(() => put(`/api/properties/${config.propertyId}/configuration`, { amenities, fields }));
    setSaving(false);
    if (ok) {
      Alert.alert('Saved', 'Property details updated.');
      onSaved();
    }
  };

  if (config.fields.length === 0 && config.amenities.length === 0) {
    return <Empty text={`Nothing to set up for ${config.stayTypeLabel} yet. The administrator can add amenities and fields.`} />;
  }

  const fieldGroups = group(config.fields, (f) => f.field.category || 'Details');
  const amenityGroups = group(config.amenities, (a) => a.amenity.categoryName);

  return (
    <>
      {fieldGroups.map(([title, items]) => (
        <View key={`f-${title}`}>
          <Text style={sectionTitle}>{title.toUpperCase()}</Text>
          <Card>
            {items.map((f, i) => (
              <View key={f.field.code} style={i > 0 ? { marginTop: 14 } : undefined}>
                <Text style={s.label}>
                  {f.field.label}
                  {f.required ? ' *' : ''}
                </Text>
                {!!f.field.description && <Text style={[s.muted, { fontSize: 12, marginBottom: 4 }]}>{f.field.description}</Text>}
                <FieldInput field={f.field} value={draft[f.field.code] ?? null} onChange={(v) => setDraft((d) => ({ ...d, [f.field.code]: v }))} />
              </View>
            ))}
          </Card>
        </View>
      ))}

      {amenityGroups.map(([title, items]) => (
        <View key={`a-${title}`}>
          <Text style={sectionTitle}>{title.toUpperCase()}</Text>
          <Card style={{ paddingVertical: 4 }}>
            {items.map((a) => {
              const on = picked.has(a.amenity.code);
              return (
                <Pressable
                  key={a.amenity.code}
                  disabled={a.required}
                  onPress={() => toggle(a.amenity.code)}
                  style={[s.row, { paddingVertical: 10 }]}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={s.h2}>{a.amenity.name}</Text>
                    {!!a.amenity.description && <Text style={[s.muted, { fontSize: 12 }]}>{a.amenity.description}</Text>}
                    {a.required && <Text style={[s.muted, { fontSize: 11 }]}>Always included</Text>}
                  </View>
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={on ? (a.required ? colors.muted : colors.primary) : colors.border}
                  />
                </Pressable>
              );
            })}
          </Card>
        </View>
      ))}

      <View style={{ marginTop: 8, marginBottom: 24 }}>
        <Button label={saving ? 'Savingâ€¦' : 'Save'} onPress={() => !saving && save()} />
      </View>
    </>
  );
}

const sectionTitle = { ...s.muted, fontSize: 11, fontWeight: '700' as const, marginTop: 10, marginBottom: 4 };

function group<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return [...map.entries()];
}

function FieldInput({ field, value, onChange }: { field: ConfigField; value: Val; onChange: (v: Val) => void }) {
  const options = field.options ?? [];
  switch (field.fieldType) {
    case 'BOOLEAN':
      return (
        <Choices
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ]}
          selected={value === null ? [] : [value ? 'yes' : 'no']}
          onPick={(v) => onChange(v === 'yes')}
        />
      );
    case 'DROPDOWN':
    case 'RADIO':
      return <Choices options={options} selected={typeof value === 'string' ? [value] : []} onPick={(v) => onChange(v)} />;
    case 'MULTI_SELECT':
    case 'CHECKBOX': {
      const current = Array.isArray(value) ? value : [];
      return (
        <Choices
          options={options}
          selected={current}
          onPick={(v) => onChange(current.includes(v) ? current.filter((x) => x !== v) : [...current, v])}
        />
      );
    }
    case 'DATE':
      return <DateField value={typeof value === 'string' ? value : ''} onChange={(d) => onChange(d)} clearable />;
    default: {
      const numeric = field.fieldType === 'NUMBER' || field.fieldType === 'DECIMAL';
      const hint =
        field.placeholder ||
        (field.fieldType === 'TIME' ? 'HH:mm' : undefined);
      return (
        <TextInput
          style={s.input}
          value={typeof value === 'string' ? value : ''}
          onChangeText={(t) => onChange(t)}
          placeholder={hint}
          placeholderTextColor={colors.muted}
          keyboardType={numeric ? (field.fieldType === 'NUMBER' ? 'number-pad' : 'decimal-pad') : 'default'}
        />
      );
    }
  }
}

function Choices({
  options,
  selected,
  onPick,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onPick: (value: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <Pressable key={o.value} onPress={() => onPick(o.value)} style={[s.chip, on && s.chipOn]}>
            <Text style={[s.chipText, on && { color: '#fff' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
