import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { ApiError, api, errorMessage, get, onLicenseExpired, post, tokenStore } from './api';
import { useAuth } from './auth';
import SubscriptionModal, { Billing, Plan } from './screens/SubscriptionModal';
import { money } from './utils';

/** Remind the owner this many days before the subscription ends (and once a day after, until they renew). */
const REMIND_WITHIN_DAYS = 7;
const REMINDED_KEY = 'mystay-subscription-reminded';

/** Placeholder plans and prices: change them here. */
export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: '1 property',
    monthly: 499,
    yearly: 4999,
    features: ['Rooms, beds and residents', 'Rent collection and dues', 'Complaints and announcements'],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'Up to 3 properties',
    monthly: 999,
    yearly: 9999,
    popular: true,
    features: ['Everything in Starter', 'Manage up to 3 properties', 'WhatsApp and push reminders', 'Food menu and meal attendance'],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Up to 10 properties',
    monthly: 1999,
    yearly: 19999,
    features: ['Everything in Growth', 'Manage up to 10 properties', 'Consolidated reports', 'Priority support'],
  },
];

type PaymentInfo = { upiId: string | null; upiName: string | null; supportMobile: string | null };
type Mode = 'closed' | 'expired' | 'reminder' | 'plans';

const Ctx = createContext<{ openPlans: () => void }>({ openPlans: () => {} });
export const useSubscription = () => useContext(Ctx);

/** "2026-12-01T10:00:00" to its date part and the whole days left from now (negative once it has passed). */
function expiryOf(iso?: string | null) {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return { expiresOn: iso.slice(0, 10), daysLeft: days };
}

/**
 * Subscription popups. The backend stops serving a property whose licence has expired (HTTP 402 LICENSE_EXPIRED), so
 * the user sees a blocking "renew" popup; owners also get an "ending soon" reminder once a day. Payment is by UPI to
 * the super admin, who extends the licence after receiving it.
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [mode, setMode] = useState<Mode>('closed');
  const [expiresOn, setExpiresOn] = useState<string | undefined>();
  const [daysLeft, setDaysLeft] = useState<number | undefined>();
  const [expiredRole, setExpiredRole] = useState<string | undefined>();
  const [awaiting, setAwaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<PaymentInfo | null>(null);

  const isOwner = user?.role === 'OWNER' && user.pgId != null;
  const userKey = user ? `${user.userId}-${user.pgId}` : null;
  const mustChange = user?.mustChangePassword;

  // The server said the subscription is over: block with the renewal popup (also on the sign-in screen).
  useEffect(() => {
    onLicenseExpired((e) => {
      setExpiredRole(e.role);
      setExpiresOn(e.expiresOn);
      setDaysLeft(undefined);
      setAwaiting(false);
      setMode('expired');
    });
    return () => onLicenseExpired(null);
  }, []);

  // Owner: remind once a day when the subscription is about to end.
  useEffect(() => {
    if (!isOwner || mustChange) return;
    let active = true;
    (async () => {
      try {
        const profile = await get<{ licenseExpiry: string | null }>('/api/pg/profile');
        const exp = expiryOf(profile.licenseExpiry);
        if (!active || !exp || exp.daysLeft > REMIND_WITHIN_DAYS) return;
        const today = new Date().toISOString().slice(0, 10);
        if ((await AsyncStorage.getItem(REMINDED_KEY)) === today) return;
        await AsyncStorage.setItem(REMINDED_KEY, today);
        if (!active) return;
        setExpiresOn(exp.expiresOn);
        setDaysLeft(Math.max(exp.daysLeft, 0));
        setMode((m) => (m === 'closed' ? 'reminder' : m));
      } catch {
        // Offline: skip. An expired licence is announced by the 402 handler.
      }
    })();
    return () => {
      active = false;
    };
  }, [userKey, isOwner, mustChange]);

  const close = useCallback(() => {
    setMode('closed');
    setAwaiting(false);
  }, []);

  /** Owner opened "Subscription" from the account screen. */
  const openPlans = useCallback(async () => {
    try {
      const profile = await get<{ licenseExpiry: string | null }>('/api/pg/profile');
      const exp = expiryOf(profile.licenseExpiry);
      setExpiresOn(exp?.expiresOn);
      setDaysLeft(exp ? Math.max(exp.daysLeft, 0) : undefined);
      setMode('plans');
    } catch (e) {
      // A 402 opens the expired popup by itself.
      if (!(e instanceof ApiError && e.status === 402)) Alert.alert('Subscription', errorMessage(e));
    }
  }, []);

  const loadInfo = async (): Promise<PaymentInfo | null> => {
    if (info) return info;
    try {
      const data = await api<PaymentInfo>('/api/public/subscription', { auth: false });
      setInfo(data);
      return data;
    } catch (e) {
      Alert.alert('Subscription', errorMessage(e));
      return null;
    }
  };

  const onPay = async (plan: Plan, billing: Billing) => {
    setBusy(true);
    try {
      const pay = await loadInfo();
      if (!pay) return;
      if (!pay.upiId) {
        Alert.alert('Payment details not ready', 'The administrator has not set up the payment UPI ID yet. Please contact support to renew.');
        return;
      }
      const amount = billing === 'YEARLY' ? plan.yearly : plan.monthly;
      const payee = pay.upiName || 'MyStay';
      const who = user?.pgName ?? user?.username ?? '';
      const note = `MyStay ${plan.name} ${billing === 'YEARLY' ? 'yearly' : 'monthly'} ${who}`.trim();
      const url = `upi://pay?pa=${encodeURIComponent(pay.upiId)}&pn=${encodeURIComponent(payee)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert('No UPI app found', `Pay ${money(amount)} to UPI ID ${pay.upiId} (${payee}) with the note "${note}", then come back and confirm.`);
      }
      setAwaiting(true);
    } finally {
      setBusy(false);
    }
  };

  /** "I've completed the payment" / "Check again": see whether the administrator has extended the licence yet. */
  const onCheckPayment = async () => {
    if (!user) {
      Alert.alert('Thank you', 'The administrator will confirm your payment and extend your subscription. Sign in again once it is done.');
      close();
      return;
    }
    setBusy(true);
    try {
      const res = await post<{ token: string }>('/api/auth/refresh');
      await tokenStore.set(res.token);
      close();
      Alert.alert('Subscription active', 'Your subscription is active again. Pull down on a screen to refresh it.');
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        Alert.alert(
          'Waiting for confirmation',
          'The administrator extends your subscription once the payment is received. You will get access again as soon as that is done.',
        );
      } else if (!(e instanceof ApiError && e.status === 401)) {
        Alert.alert('Subscription', errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const onSupport = async () => {
    const pay = await loadInfo();
    if (pay?.supportMobile) Linking.openURL(`tel:${pay.supportMobile}`).catch(() => {});
    else Alert.alert('Contact support', 'Please contact the MyStay administrator to renew your subscription.');
  };

  const onLogout = async () => {
    close();
    if (user) await logout();
  };

  const value = useMemo(() => ({ openPlans }), [openPlans]);
  const canPay = mode !== 'expired' || (expiredRole ?? user?.role) === 'OWNER';

  return (
    <Ctx.Provider value={value}>
      {children}
      <SubscriptionModal
        visible={mode !== 'closed'}
        expired={mode === 'expired'}
        expiresOn={expiresOn}
        daysLeft={mode === 'expired' ? undefined : daysLeft}
        canPay={canPay}
        plans={PLANS}
        busy={busy}
        awaitingPayment={awaiting}
        onPay={onPay}
        onCheckPayment={onCheckPayment}
        onRetry={() => {}}
        onSupport={onSupport}
        onLogout={onLogout}
        logoutLabel={user ? 'Log out' : 'Back to sign in'}
        onClose={close}
      />
    </Ctx.Provider>
  );
}
