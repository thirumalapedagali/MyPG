import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { del, get, put } from '../api';
import { useAuth } from '../auth';
import { TimeField } from '../dateField';
import { attempt, useResource } from '../hooks';
import { MenuMeal } from '../types';
import { Badge, Button, Card, Chips, Empty, HeaderAction, Screen, Sheet, colors, s } from '../ui';
import { clock12, ymd } from '../utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The three meals offered in the day popup, with a sensible default time. Other meals of the day are kept as extra rows. */
const STANDARD = [
  { name: 'Breakfast', startTime: '07:30', endTime: '09:30' },
  { name: 'Lunch', startTime: '12:30', endTime: '14:30' },
  { name: 'Dinner', startTime: '20:00', endTime: '22:00' },
];

/** ISO weekday of a date: 1 = Monday ... 7 = Sunday. */
const isoDay = (d: Date) => ((d.getDay() + 6) % 7) + 1;

/**
 * The property's weekly food menu. The same week repeats every week. Owners and managers plan a whole day at once
 * and see how many residents are eating the next meals; residents just read it.
 */
export default function FoodMenu() {
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const { user } = useAuth();
  const canEdit = user?.role !== 'RESIDENT';
  const [day, setDay] = useState<number>(isoDay(new Date()));
  const [planning, setPlanning] = useState(false);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  // Residents only answer for today and tomorrow, so counts exist only for those two weekdays.
  const countDate = day === isoDay(now) ? ymd(now) : day === isoDay(tomorrow) ? ymd(tomorrow) : null;

  const menu = useResource(() => get<MenuMeal[]>('/api/menu'));
  const counts = useResource(
    async () => (canEdit && countDate ? get<{ mealId: number; count: number }[]>(`/api/menu/attendance?date=${countDate}`) : []),
    [canEdit, countDate],
  );
  const attending = new Map((counts.data ?? []).map((c) => [c.mealId, c.count]));
  const meals = (menu.data ?? []).filter((m) => m.dayOfWeek === day);

  const reload = () => {
    menu.reload();
    counts.reload();
  };

  const confirmDelete = (m: MenuMeal) =>
    Alert.alert('Delete meal?', `${m.name} will be removed from ${DAY_NAMES[m.dayOfWeek - 1]}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => del(`/api/menu/${m.id}`))) reload();
        },
      },
    ]);

  return (
    <Screen
      title="Food Menu"
      action={
        <View style={{ flexDirection: 'row' }}>
          {canEdit && <HeaderAction label="Plan day" icon="create" onPress={() => setPlanning(true)} />}
          <HeaderAction label="Back" icon="chevron-back" onPress={() => nav.goBack()} />
        </View>
      }
      loading={menu.loading}
      error={menu.error}
      refreshing={menu.refreshing}
      onRefresh={() => {
        menu.refresh();
        counts.reload();
      }}
    >
      <Text style={[s.muted, { marginBottom: 8 }]}>
        {canEdit
          ? 'The same weekly menu repeats every week. Change a day and it changes for every week.'
          : 'This week\u2019s menu. It repeats every week unless the owner changes it.'}
      </Text>
      <Chips options={DAYS} value={DAYS[day - 1]} onChange={(d) => setDay(DAYS.indexOf(d) + 1)} />
      <Text style={[s.h2, { marginBottom: 8 }]}>
        {DAY_NAMES[day - 1]}
        {day === isoDay(now) ? ' (today)' : ''}
      </Text>

      {meals.length === 0 && (
        <Empty text={canEdit ? 'No meals planned for this day. Tap Plan day to set breakfast, lunch and dinner.' : 'No meals planned for this day.'} />
      )}
      {meals.map((m) => (
        <Card key={m.id} style={{ marginBottom: 8 }}>
          <View style={s.row}>
            <Text style={[s.h2, { fontSize: 16 }]}>{m.name}</Text>
            {canEdit && countDate && <Badge text={`${attending.get(m.id) ?? 0} attending`} color={colors.good} />}
          </View>
          <View style={styles.time}>
            <Ionicons name="time-outline" size={14} color={colors.muted} />
            <Text style={styles.timeText}>
              {clock12(m.startTime)} – {clock12(m.endTime)}
            </Text>
          </View>
          {m.items.map((item, i) => (
            <View key={`${m.id}-${i}`} style={styles.item}>
              <Ionicons name="checkbox-outline" size={16} color={colors.good} />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
          {canEdit && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.pill} onPress={() => confirmDelete(m)} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={13} color={colors.bad} />
                <Text style={[styles.pillText, { color: colors.bad }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>
      ))}

      {planning && (
        <DayPlanner
          day={day}
          existing={menu.data ?? []}
          onClose={() => setPlanning(false)}
          onSaved={() => {
            setPlanning(false);
            reload();
          }}
        />
      )}
    </Screen>
  );
}

type Row = { name: string; startTime: string; endTime: string; items: string };

/** Rows for a weekday: the three standard meals (filled from what is saved) plus any other meal that day has. */
const rowsFor = (existing: MenuMeal[], day: number): Row[] => {
  const onDay = existing.filter((m) => m.dayOfWeek === day);
  const find = (name: string) => onDay.find((m) => m.name.toLowerCase() === name.toLowerCase());
  const standard = STANDARD.map((d) => {
    const m = find(d.name);
    return { name: d.name, startTime: m?.startTime ?? d.startTime, endTime: m?.endTime ?? d.endTime, items: m ? m.items.join(', ') : '' };
  });
  const extra = onDay
    .filter((m) => !STANDARD.some((d) => d.name.toLowerCase() === m.name.toLowerCase()))
    .map((m) => ({ name: m.name, startTime: m.startTime, endTime: m.endTime, items: m.items.join(', ') }));
  return [...standard, ...extra];
};

/** One popup for the whole day: breakfast, lunch and dinner with their times and food, saved together. */
function DayPlanner({
  day,
  existing,
  onClose,
  onSaved,
}: {
  day: number;
  existing: MenuMeal[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => rowsFor(existing, day));
  const [days, setDays] = useState<number[]>([day]);
  const [saving, setSaving] = useState(false);

  const setRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const toggleDay = (d: number) =>
    setDays((cur) => {
      const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
      // Picking another single day shows that day's saved meals; several days keep what is typed.
      if (next.length === 1 && next[0] !== cur[0]) setRows(rowsFor(existing, next[0]));
      return next;
    });

  const save = async () => {
    if (days.length === 0) {
      Alert.alert('Choose a day', 'Pick at least one day to save this menu on.');
      return;
    }
    const served = rows.filter((r) => r.items.trim());
    const bad = served.find((r) => r.endTime <= r.startTime);
    if (bad) {
      Alert.alert('Check the times', `${bad.name} must end after it starts.`);
      return;
    }
    if (served.length === 0 && !existing.some((m) => days.includes(m.dayOfWeek))) {
      Alert.alert('Nothing to save', 'Add the food items for at least one meal.');
      return;
    }
    setSaving(true);
    const ok = await attempt(() =>
      put('/api/menu/day', {
        days,
        meals: rows.map((r) => ({ name: r.name, startTime: r.startTime, endTime: r.endTime, items: r.items.trim() })),
      }),
    );
    setSaving(false);
    if (ok) onSaved();
  };

  return (
    <Sheet visible title="Plan the day" onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={styles.label}>Save for</Text>
        <View style={styles.dayRow}>
          {DAYS.map((d, i) => {
            const on = days.includes(i + 1);
            return (
              <TouchableOpacity key={d} style={[styles.dayChip, on && styles.dayChipOn]} onPress={() => toggleDay(i + 1)} activeOpacity={0.7}>
                <Text style={[styles.dayChipText, on && { color: '#fff' }]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[s.muted, { fontSize: 11, marginBottom: 6 }]}>
          Pick several days to give them the same menu. Leave a meal&apos;s food empty if it is not served.
        </Text>

        {rows.map((r, i) => (
          <View key={r.name} style={styles.mealBox}>
            <Text style={styles.mealName}>{r.name}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.small}>From</Text>
                <TimeField value={r.startTime} onChange={(v) => setRow(i, { startTime: v })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.small}>To</Text>
                <TimeField value={r.endTime} onChange={(v) => setRow(i, { endTime: v })} />
              </View>
            </View>
            <Text style={[styles.small, { marginTop: 8 }]}>Food items (separate with commas)</Text>
            <TextInput
              style={styles.input}
              value={r.items}
              onChangeText={(v) => setRow(i, { items: v })}
              placeholder="e.g. Idli, Sambar, Tea"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
              maxLength={1500}
            />
          </View>
        ))}

        <Button label={saving ? 'Saving...' : 'Save'} onPress={saving ? () => {} : save} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  time: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, marginBottom: 8 },
  timeText: { fontSize: 12, color: colors.muted },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  itemText: { fontSize: 14, color: colors.text, flex: 1 },
  actions: { flexDirection: 'row', gap: 6, marginTop: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  label: { fontSize: 12, fontWeight: '800', color: colors.text, marginBottom: 6 },
  small: { fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 4 },
  dayRow: { flexDirection: 'row', gap: 5, marginBottom: 6 },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  dayChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayChipText: { fontSize: 11, fontWeight: '700', color: colors.text },
  mealBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    backgroundColor: '#fafafa',
  },
  mealName: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 8 },
  input: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#fff',
  },
});
