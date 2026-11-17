import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { del, get, post, qs } from '../api';
import { attempt, useResource } from '../hooks';
import { EXPENSE_TYPE, useLookup } from '../lookups';
import { Expense, ExpenseCategory, Paged, Totals } from '../types';
import { Badge, Card, Chips, Empty, FormModal, HeaderAction, Screen, SearchInput, Stat, colors, s } from '../ui';
import { PRESETS, Preset, isDate, money, presetRange, today } from '../utils';

const ALL = 'All categories';
const PAGE = 100;

export default function Expenses({ addSignal }: { addSignal?: number }) {
  const [preset, setPreset] = useState<Preset>('This Month');
  const [category, setCategory] = useState(ALL);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  // Dashboard quick action: a new signal value opens the add-expense form.
  const [seenAdd, setSeenAdd] = useState<number | undefined>(undefined);
  if (addSignal !== seenAdd) {
    setSeenAdd(addSignal);
    if (addSignal != null) setOpen(true);
  }


  // Debounce typing so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { from, to } = presetRange(preset);
  const { data, error, loading, refreshing, refresh, reload } = useResource(async () => {
    const [list, summary, cats] = await Promise.all([
      get<Paged<Expense>>(`/api/expenses${qs({ from, to, category: category === ALL ? undefined : category, q, size: PAGE })}`),
      get<Totals>('/api/expenses/summary'),
      get<ExpenseCategory[]>('/api/master/expenses'),
    ]);
    return { list, summary, cats };
  }, [preset, category, q]);

  // Categories come from the EXPENSE_TYPE lookup (lookup_values). Until that has rows, the property's own list is used.
  const expenseTypes = useLookup(EXPENSE_TYPE);
  const DEFAULT_EXPENSE_CATEGORIES = [
  'Market',
  'Electricity',
  'Water',
  'Rent',
  'Salary',
  'Repairs',
  'Internet',
  'Supplies',
  'Marketing',
  'Transport',
  'Other',
];

const names = [
  ...new Set(
    expenseTypes.length
      ? expenseTypes.map((t) => t.label)
      : data?.cats?.length
        ? data.cats.map((c) => c.name)
        : DEFAULT_EXPENSE_CATEGORIES
  ),
];
console.log("names",names)
  //const names = [...new Set((expenseTypes.length ? expenseTypes.map((t) => t.label) : (data?.cats ?? []).map((c) => c.name)))];
  const categories = [ALL, ...names];
  const list = data?.list.content ?? [];
  const listTotal = list.reduce((n, e) => n + e.amount, 0);

  const confirmDelete = (e: Expense) =>
    Alert.alert('Delete expense', `Delete "${e.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => del(`/api/expenses/${e.id}`))) reload();
        },
      },
    ]);

  return (
    <Screen
      title="Expenses"
      action={<HeaderAction label="Add" icon="add-circle" onPress={() => setOpen(true)} />}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {data && (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <Stat icon="today-outline" label="Today" value={money(data.summary.today)} color={colors.warn} />
            <Stat icon="calendar-outline" label="This month" value={money(data.summary.month)} color={colors.warn} />
            <Stat icon="calendar" label="This year" value={money(data.summary.year)} color={colors.blue} />
            <Stat icon="wallet-outline" label="All time" value={money(data.summary.total)} />
          </View>

          <Chips options={PRESETS} value={preset} onChange={setPreset} />
          <Chips options={categories} value={categories.includes(category) ? category : ALL} onChange={setCategory} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search description or category" />

          <Text style={[s.muted, { marginBottom: 8 }]}>
            {data.list.totalElements} expense{data.list.totalElements === 1 ? '' : 's'}
            {data.list.totalElements > list.length ? ` (showing latest ${list.length})` : ` · ${money(listTotal)}`}
          </Text>
          {list.length === 0 && <Empty text="No expenses match these filters." />}
          {list.map((e) => (
            <Card key={e.id}>
              <View style={[s.row, { gap: 12 }]}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="receipt-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.h2} numberOfLines={1}>{e.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Badge text={e.category} color={colors.primary} />
                    <Text style={s.muted}>{e.date}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={{ fontWeight: '800', color: colors.text }}>{money(e.amount)}</Text>
                  <Pressable
                    onPress={() => confirmDelete(e)}
                    hitSlop={8}
                    style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: colors.badLight, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.bad} />
                  </Pressable>
                </View>
              </View>
            </Card>
          ))}
        </>
      )}
      <AddExpenseModal
        visible={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false);
          reload();
        }}
        presetCategories={names}
      />
    </Screen>
  );
}

export function AddExpenseModal({
  visible,
  onClose,
  onCreated,
  presetCategories,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  presetCategories?: string[];
}) {
 const DEFAULT_EXPENSE_CATEGORIES = [
  'Rent',
  'Food',
  'Electricity',
  'Water',
  'Maintenance',
  'Salary',
  'Cleaning',
  'Repairs',
  'Internet',
  'Supplies',
  'Marketing',
  'Transport',
  'Other',
];

const { data } = useResource(async () => {
  if (presetCategories?.length) {
    return presetCategories;
  }

  try {
    const cats = await get<ExpenseCategory[]>('/api/master/expenses');

    return cats?.length
      ? cats.map((c) => c.name)
      : DEFAULT_EXPENSE_CATEGORIES;
  } catch {
    return DEFAULT_EXPENSE_CATEGORIES;
  }
});

const names = data ?? presetCategories ?? DEFAULT_EXPENSE_CATEGORIES;
  const options = names.map((n) => ({ code: n, label: n }));

  return (
    <FormModal
      visible={visible}
      title="Add expense"
      fields={[
        { key: 'amount', label: 'Amount (₹)', keyboard: 'number-pad' },
        { key: 'category', label: 'Category', options, initial: options[0]?.code },
        { key: 'title', label: 'Description (e.g. April electricity bill)' },
        { key: 'date', label: 'Date', initial: today(), date: true },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        const amount = parseFloat(v.amount);
        if (!(amount > 0) || !isDate(v.date)) {
          Alert.alert('Invalid', 'Check amount and date.');
          return false;
        }
        if (!(await attempt(() => post('/api/expenses', { title: v.title, category: v.category, amount, date: v.date })))) return false;
        onCreated();
      }}
    />
  );
}
