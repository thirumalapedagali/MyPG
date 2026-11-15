import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { ymd } from './utils';

const colors = { primary: '#2e7d32', text: '#1f2328', muted: '#57606a', border: '#e5e7eb', bg: '#f8fafc', bad: '#c62828' };
const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-12" or "2026-11-12 18:30" (a "T" also works) -> a local Date; null when it is blank or not a date. */
export function parseDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value.trim());
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

const format = (d: Date, withTime: boolean) => (withTime ? `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : ymd(d));

const show = (value: string, withTime: boolean) => {
  const d = parseDate(value);
  if (!d) return '';
  const day = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return withTime ? `${day}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
};

/**
 * A date (or date and time) the user picks from the phone's own calendar instead of typing. The value stays the
 * text the API wants: `YYYY-MM-DD`, or `YYYY-MM-DD HH:mm` with `time`. `min` / `max` are `YYYY-MM-DD`.
 * With `clearable` an empty value is allowed and a small x resets it.
 */
export function DateField({
  value,
  onChange,
  time = false,
  min,
  max,
  clearable = false,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  time?: boolean;
  min?: string;
  max?: string;
  clearable?: boolean;
  placeholder?: string;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const minDate = min ? parseDate(min) ?? undefined : undefined;
  const maxDate = max ? parseDate(max) ?? undefined : undefined;
  const current = parseDate(value) ?? new Date();

  const open = () => {
    if (Platform.OS === 'ios') {
      setDraft(current);
      setIosOpen(true);
      return;
    }
    // Android shows the calendar first, then the clock when a time is needed.
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      minimumDate: minDate,
      maximumDate: maxDate,
      onValueChange: (_e, day) => {
        if (!time) return onChange(format(day, false));
        DateTimePickerAndroid.open({
          value: day,
          mode: 'time',
          is24Hour: true,
          onValueChange: (_t, at) => {
            const out = new Date(day);
            out.setHours(at.getHours(), at.getMinutes(), 0, 0);
            onChange(format(out, true));
          },
        });
      },
    });
  };

  const shown = show(value, time);
  return (
    <>
      <Pressable
        onPress={open}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.bg,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 12,
          height: 46,
        }}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        <Text style={{ flex: 1, fontSize: 14, color: shown ? colors.text : colors.muted }}>
          {shown || placeholder || (time ? 'Select date & time' : 'Select date')}
        </Text>
        {clearable && !!value && (
          <Pressable hitSlop={10} onPress={() => onChange('')}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
      </Pressable>

      {Platform.OS === 'ios' && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <Pressable style={{ flex: 1 }} onPress={() => setIosOpen(false)} />
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
                <Pressable onPress={() => setIosOpen(false)} hitSlop={8}>
                  <Text style={{ fontSize: 15, color: colors.muted }}>Cancel</Text>
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    onChange(format(draft, time));
                    setIosOpen(false);
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode={time ? 'datetime' : 'date'}
                display={time ? 'spinner' : 'inline'}
                is24Hour
                minimumDate={minDate}
                maximumDate={maxDate}
                onValueChange={(_e, d) => setDraft(d)}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

/** "07:30" -> a Date today at that time (the picker needs a Date). */
const timeToDate = (value: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  const d = new Date();
  d.setHours(m ? +m[1] : 8, m ? +m[2] : 0, 0, 0);
  return d;
};
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const clockText = (value: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return '';
  const h = +m[1];
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

/** A time of day the user picks from the phone's clock instead of typing. The value is `HH:mm` (24-hour). */
export function TimeField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());

  const open = () => {
    const current = timeToDate(value);
    if (Platform.OS === 'ios') {
      setDraft(current);
      setIosOpen(true);
      return;
    }
    DateTimePickerAndroid.open({ value: current, mode: 'time', is24Hour: false, onValueChange: (_e, at) => onChange(hhmm(at)) });
  };

  const shown = clockText(value);
  return (
    <>
      <Pressable
        onPress={open}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.bg,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 12,
          height: 44,
        }}
      >
        <Ionicons name="time-outline" size={18} color={colors.muted} />
        <Text style={{ flex: 1, fontSize: 14, color: shown ? colors.text : colors.muted }}>{shown || placeholder || 'Select time'}</Text>
      </Pressable>

      {Platform.OS === 'ios' && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <Pressable style={{ flex: 1 }} onPress={() => setIosOpen(false)} />
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
                <Pressable onPress={() => setIosOpen(false)} hitSlop={8}>
                  <Text style={{ fontSize: 15, color: colors.muted }}>Cancel</Text>
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    onChange(hhmm(draft));
                    setIosOpen(false);
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker value={draft} mode="time" display="spinner" onValueChange={(_e, d) => setDraft(d)} />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}