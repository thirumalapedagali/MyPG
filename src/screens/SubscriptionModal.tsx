import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../ui';
import { money } from '../utils';

export type Billing = 'MONTHLY' | 'YEARLY';

export interface Plan {
  id: string;
  name: string;
  tagline: string; // e.g. "Up to 2 properties"
  monthly: number; // price per month when billed monthly
  yearly: number; // total price for one year when billed yearly
  features: string[];
  popular?: boolean;
}

interface SubscriptionModalProps {
  visible: boolean;
  /** Expired = blocking popup. Otherwise it is a dismissible "expiring soon" reminder. */
  expired: boolean;
  /** ISO date, e.g. "2026-11-12". */
  expiresOn?: string;
  daysLeft?: number;
  /** Only owners can pay. Managers and residents see a "ask the owner" message instead. */
  canPay: boolean;
  plans: Plan[];
  currentPlanId?: string;
  loadingPlans?: boolean;
  error?: string | null;
  busy?: boolean; // checkout request in flight
  awaitingPayment?: boolean; // payment page was opened
  onPay: (plan: Plan, billing: Billing) => void;
  onCheckPayment: () => void; // "I've completed payment"
  onRetry: () => void;
  onSupport: () => void;
  onLogout?: () => void;
  /** Label of the secondary exit link shown while expired. Defaults to "Log out". */
  logoutLabel?: string;
  onClose?: () => void; // only used when !expired
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtDate = (iso?: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

const priceOf = (plan: Plan, billing: Billing) => (billing === 'YEARLY' ? plan.yearly : plan.monthly);
const perMonth = (plan: Plan, billing: Billing) =>
  billing === 'YEARLY' ? Math.round(plan.yearly / 12) : plan.monthly;
const savingPct = (plan: Plan) =>
  plan.monthly > 0 ? Math.max(0, Math.round((1 - plan.yearly / (plan.monthly * 12)) * 100)) : 0;

export default function SubscriptionModal({
  visible,
  expired,
  expiresOn,
  daysLeft,
  canPay,
  plans,
  currentPlanId,
  loadingPlans,
  error,
  busy,
  awaitingPayment,
  onPay,
  onCheckPayment,
  onRetry,
  onSupport,
  onLogout,
  logoutLabel = 'Log out',
  onClose,
}: SubscriptionModalProps) {
  const insets = useSafeAreaInsets();
  const [billing, setBilling] = useState<Billing>('YEARLY');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Until the user taps a plan: the popular one, else the current one, else the first.
  const selected =
    plans.find((p) => p.id === selectedId) ??
    plans.find((p) => p.popular) ??
    plans.find((p) => p.id === currentPlanId) ??
    plans[0] ??
    null;
  const bestSaving = useMemo(() => plans.reduce((max, p) => Math.max(max, savingPct(p)), 0), [plans]);

  // Opened from the account screen with plenty of time left: plain "plans" wording instead of a warning.
  const ending = daysLeft == null || daysLeft <= 30;
  const title = expired ? 'Your subscription has expired' : ending ? 'Your subscription is ending soon' : 'Subscription plans';
  const left = daysLeft != null ? ` (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)` : '';
  const subtitle = expired
    ? canPay
      ? `${expiresOn ? `Expired on ${fmtDate(expiresOn)}. ` : ''}Renew to keep managing your property.`
      : 'Your property’s subscription has expired. Please ask the owner to renew it.'
    : ending
      ? `Ends on ${fmtDate(expiresOn)}${left}. Renew now to avoid interruption.`
      : `Valid until ${fmtDate(expiresOn)}${left}. Renewing adds time to your subscription.`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Android back button: blocked while expired, closes the reminder otherwise.
      onRequestClose={() => {
        if (!expired) onClose?.();
      }}
    >
      <View style={st.overlay}>
        {!expired && <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />}
        <View style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={st.handle} />

          {/* Header */}
          <View style={st.header}>
            <View style={[st.badgeIcon, { backgroundColor: expired ? '#fef2f2' : '#fff7ed' }]}>
              <Ionicons
                name={expired ? 'lock-closed' : 'time'}
                size={22}
                color={expired ? '#dc2626' : '#ea580c'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>{title}</Text>
              <Text style={st.subtitle}>{subtitle}</Text>
            </View>
            {!expired && (
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            )}
          </View>

          {canPay ? (
            <>
              <ScrollView
                style={st.body}
                contentContainerStyle={st.bodyContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Billing toggle */}
                <View style={st.seg}>
                  {(['MONTHLY', 'YEARLY'] as Billing[]).map((b) => {
                    const on = billing === b;
                    return (
                      <Pressable
                        key={b}
                        style={[st.segBtn, on && st.segBtnOn]}
                        onPress={() => setBilling(b)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[st.segText, on && st.segTextOn]}>
                          {b === 'MONTHLY' ? 'Monthly' : 'Yearly'}
                        </Text>
                        {b === 'YEARLY' && bestSaving > 0 ? (
                          <View style={[st.saveTag, on && { backgroundColor: '#ffffff33' }]}>
                            <Text style={[st.saveTagText, on && { color: '#ffffff' }]}>Save {bestSaving}%</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                {/* Plans */}
                {loadingPlans ? (
                  <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />
                ) : error ? (
                  <View style={st.errorBox}>
                    <Text style={st.errorText}>{error}</Text>
                    <TouchableOpacity onPress={onRetry} accessibilityRole="button">
                      <Text style={st.errorLink}>Try again</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {plans.map((plan) => {
                      const on = plan.id === selected?.id;
                      const current = plan.id === currentPlanId;
                      return (
                        <Pressable
                          key={plan.id}
                          style={[st.plan, on && st.planOn]}
                          onPress={() => setSelectedId(plan.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={`${plan.name}, ${money(perMonth(plan, billing))} per month`}
                        >
                          <View style={st.planTop}>
                            <Ionicons
                              name={on ? 'radio-button-on' : 'radio-button-off'}
                              size={20}
                              color={on ? '#1b873f' : '#94a3b8'}
                            />
                            <View style={{ flex: 1 }}>
                              <View style={st.planNameRow}>
                                <Text style={st.planName}>{plan.name}</Text>
                                {plan.popular ? (
                                  <View style={st.popular}>
                                    <Text style={st.popularText}>Popular</Text>
                                  </View>
                                ) : null}
                                {current ? (
                                  <View style={[st.popular, { backgroundColor: '#eff6ff' }]}>
                                    <Text style={[st.popularText, { color: '#2563eb' }]}>Current</Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={st.planTag}>{plan.tagline}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={st.price}>
                                {money(perMonth(plan, billing))}
                                <Text style={st.priceUnit}> /mo</Text>
                              </Text>
                              {billing === 'YEARLY' ? (
                                <Text style={st.billed}>{money(plan.yearly)} billed yearly</Text>
                              ) : null}
                            </View>
                          </View>

                          {on && (
                            <View style={st.features}>
                              {plan.features.map((f) => (
                                <View key={f} style={st.featureRow}>
                                  <Ionicons name="checkmark-circle" size={15} color="#16a34a" />
                                  <Text style={st.featureText}>{f}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={st.footer}>
                {awaitingPayment ? (
                  <>
                    <Text style={st.footerNote}>
                      Complete the payment in the browser, then come back and confirm.
                    </Text>
                    <TouchableOpacity style={st.cta} onPress={onCheckPayment} disabled={busy} activeOpacity={0.85}>
                      {busy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={st.ctaText}>I’ve completed the payment</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {selected ? (
                      <Text style={st.footerNote} numberOfLines={1}>
                        {selected.name} · {billing === 'YEARLY' ? 'Yearly' : 'Monthly'} ·{' '}
                        {money(priceOf(selected, billing))} {billing === 'YEARLY' ? 'per year' : 'per month'}
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      style={[st.cta, (!selected || busy) && { opacity: 0.6 }]}
                      onPress={() => selected && onPay(selected, billing)}
                      disabled={!selected || busy}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                    >
                      {busy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={st.ctaText}>
                            {selected ? `Renew · ${money(priceOf(selected, billing))}` : 'Choose a plan'}
                          </Text>
                          <Ionicons name="arrow-forward" size={17} color="#fff" />
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                <View style={st.links}>
                  <TouchableOpacity onPress={onSupport} hitSlop={8} accessibilityRole="button">
                    <Text style={st.link}>Need help? Contact support</Text>
                  </TouchableOpacity>
                  {expired && onLogout ? (
                    <TouchableOpacity onPress={onLogout} hitSlop={8} accessibilityRole="button">
                      <Text style={[st.link, { color: colors.muted }]}>{logoutLabel}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </>
          ) : (
            /* Managers and residents cannot pay: explain and offer the way out. */
            <View style={st.footer}>
              <View style={st.askOwner}>
                <Ionicons name="information-circle-outline" size={18} color="#2563eb" />
                <Text style={st.askOwnerText}>
                  Only the property owner can renew the subscription. You’ll get access again as soon as it’s renewed.
                </Text>
              </View>
              <TouchableOpacity style={st.cta} onPress={onCheckPayment} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={st.ctaText}>Check again</Text>}
              </TouchableOpacity>
              <View style={st.links}>
                <TouchableOpacity onPress={onSupport} hitSlop={8} accessibilityRole="button">
                  <Text style={st.link}>Contact support</Text>
                </TouchableOpacity>
                {onLogout ? (
                  <TouchableOpacity onPress={onLogout} hitSlop={8} accessibilityRole="button">
                    <Text style={[st.link, { color: colors.muted }]}>Log out</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#d9d0c5', marginBottom: 10 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  badgeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 17 },

  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: 16, paddingBottom: 10 },

  seg: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  segBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  segBtnOn: { backgroundColor: '#1b873f' },
  segText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  segTextOn: { color: '#ffffff', fontWeight: '700' },
  saveTag: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  saveTagText: { fontSize: 10, fontWeight: '800', color: '#15803d' },

  plan: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 12,
  },
  planOn: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  planName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  planTag: { fontSize: 11, color: '#64748b', marginTop: 1 },
  popular: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 1 },
  popularText: { fontSize: 10, fontWeight: '800', color: '#15803d' },
  price: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  priceUnit: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  billed: { fontSize: 10, color: '#64748b', marginTop: 1 },

  features: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#bbf7d0', gap: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { flex: 1, fontSize: 12, color: '#334155' },

  errorBox: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#fef2f2', gap: 6 },
  errorText: { fontSize: 12, color: '#b91c1c' },
  errorLink: { fontSize: 12, fontWeight: '800', color: '#1b873f' },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  footerNote: { fontSize: 12, color: '#475569', fontWeight: '600' },
  cta: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: '#1b873f',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  links: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  link: { fontSize: 12, fontWeight: '700', color: '#1b873f' },

  askOwner: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#eff6ff' },
  askOwnerText: { flex: 1, fontSize: 12, color: '#1e3a8a', lineHeight: 17 },
});