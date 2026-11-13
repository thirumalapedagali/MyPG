import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AttendanceRecord,
  FoodMenu,
  LeaveApplication,
  MealPreference,
  PgDocument,
  VisitorPass,
} from './types';
import { get } from './api';
import { today } from './utils';

const STORAGE_KEYS = {
  ATTENDANCE: 'mypg_res_attendance',
  VISITORS: 'mypg_res_visitors',
  LEAVES: 'mypg_res_leaves',
  MEALS: 'mypg_res_meal_prefs',
  DOCUMENTS: 'mypg_res_documents',
  RULES: 'mypg_pg_rules',
};

/** House rules are written once and rarely edited, so a stored copy is trusted for this long. */
const RULES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_WEEKLY_MENU: FoodMenu[] = [
  {
    day: 'Monday',
    breakfast: 'Idli, Sambar, Coconut Chutney & Tea/Coffee',
    lunch: 'Steamed Rice, Dal Tadka, Paneer Butter Masala, Curd & Salad',
    snacks: 'Samosa & Masala Chai',
    dinner: 'Phulka Roti, Mix Veg Curry, Jeera Rice & Rasam',
  },
  {
    day: 'Tuesday',
    breakfast: 'Poha with Sev, Boiled Eggs / Sprouts & Coffee',
    lunch: 'Rice, Chana Masala, Aloo Gobi, Buttermilk & Papad',
    snacks: 'Veg Cutlet & Tea',
    dinner: 'Chapati, Dal Fry, Chicken Curry / Shahi Paneer, Rice',
  },
  {
    day: 'Wednesday',
    breakfast: 'Masala Dosa, Chutney, Sambar & Tea/Coffee',
    lunch: 'Veg Biryani / Steamed Rice, Rajma Curry, Curd, Pickle',
    snacks: 'Biscuits & Filter Coffee',
    dinner: 'Roti, Dal Makhani, Bhindi Masala, Steamed Rice',
  },
  {
    day: 'Thursday',
    breakfast: 'Aloo Paratha, Curd, Green Chutney & Tea',
    lunch: 'South Indian Thali (Rice, Sambar, Rasam, Kootu, Curd)',
    snacks: 'Bread Pakora & Chai',
    dinner: 'Puri, Chole Masala, Veg Pulao, Gulab Jamun',
  },
  {
    day: 'Friday',
    breakfast: 'Uttapam, Tomato Chutney, Sambar & Coffee',
    lunch: 'Rice, Egg Curry / Paneer Do Pyaza, Dal, Buttermilk',
    snacks: 'Onion Pakoda & Masala Tea',
    dinner: 'Phulkas, Chicken Gravy / Mushroom Masala, Jeera Rice',
  },
  {
    day: 'Saturday',
    breakfast: 'Upma with Chutney, Vada & Filter Coffee',
    lunch: 'Special Hyderabadi Veg/Chicken Biryani, Mirchi ka Salan, Raita',
    snacks: 'Sweet Corn / Chaat & Chai',
    dinner: 'Roti, Mixed Vegetable Kurma, Curd Rice',
  },
  {
    day: 'Sunday',
    breakfast: 'Chole Bhature / Poori Masala & Hot Coffee',
    lunch: 'Special Feast (Pulao, Dal, Paneer/Chicken, Sweet, Ice Cream)',
    snacks: 'Tea & Light Snacks',
    dinner: 'Khichdi / Light Dinner, Kadhi, Roasted Papad',
  },
];

const DEFAULT_DOCUMENTS: PgDocument[] = [
  {
    id: 'doc-1',
    title: 'Signed PG Rental Agreement (E-Stamped)',
    type: 'AGREEMENT',
    date: '2026-01-10',
    status: 'Verified & Active',
    fileSize: '1.2 MB PDF',
  },
  {
    id: 'doc-2',
    title: 'Resident Aadhaar / National ID Card',
    type: 'ID_PROOF',
    date: '2026-01-10',
    status: 'Approved & Stored',
    fileSize: '840 KB JPG',
  },
  {
    id: 'doc-3',
    title: 'Security Deposit & Onboarding Receipt',
    type: 'RECEIPT',
    date: '2026-01-10',
    status: 'Paid in Full',
    fileSize: '420 KB PDF',
  },
  {
    id: 'doc-4',
    title: 'PG Code of Conduct & House Guidelines',
    type: 'POLICY',
    date: '2026-01-01',
    status: 'Applicable',
    fileSize: '650 KB PDF',
  },
];

export const ResidentStorage = {
  // ── Attendance ──
  async getAttendance(residentId?: number | null): Promise<AttendanceRecord[]> {
    try {
      const key = `${STORAGE_KEYS.ATTENDANCE}_${residentId || 'default'}`;
      const json = await AsyncStorage.getItem(key);
      if (json) return JSON.parse(json);
      const now = new Date();
      return [
        {
          id: 'att-1',
          type: 'CHECK_IN',
          date: today(),
          timestamp: '08:45 PM',
          location: 'Main Gate Access',
        },
        {
          id: 'att-2',
          type: 'CHECK_OUT',
          date: today(),
          timestamp: '09:15 AM',
          location: 'Main Gate Access',
        },
      ];
    } catch {
      return [];
    }
  },

  async recordAttendance(residentId: number | null | undefined, type: 'CHECK_IN' | 'CHECK_OUT'): Promise<AttendanceRecord> {
    const list = await this.getAttendance(residentId);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const record: AttendanceRecord = {
      id: `att-${Date.now()}`,
      type,
      date: today(),
      timestamp: timeStr,
      location: 'PG Smart Access Point',
    };
    const updated = [record, ...list];
    const key = `${STORAGE_KEYS.ATTENDANCE}_${residentId || 'default'}`;
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    return record;
  },

  // ── Visitors ──
  async getVisitors(residentId?: number | null): Promise<VisitorPass[]> {
    try {
      const key = `${STORAGE_KEYS.VISITORS}_${residentId || 'default'}`;
      const json = await AsyncStorage.getItem(key);
      if (json) return JSON.parse(json);
      return [
        {
          id: 'vis-1',
          visitorName: 'Ramesh Kumar',
          visitorPhone: '9876543210',
          relationship: 'Friend',
          visitDate: today(),
          visitTime: '05:30 PM',
          purpose: 'Study & Book sharing',
          status: 'APPROVED',
        },
      ];
    } catch {
      return [];
    }
  },

  async addVisitor(residentId: number | null | undefined, visitor: Omit<VisitorPass, 'id' | 'status'>): Promise<VisitorPass> {
    const list = await this.getVisitors(residentId);
    const newPass: VisitorPass = {
      ...visitor,
      id: `vis-${Date.now()}`,
      status: 'APPROVED',
    };
    const updated = [newPass, ...list];
    const key = `${STORAGE_KEYS.VISITORS}_${residentId || 'default'}`;
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    return newPass;
  },

  // ── Leaves ──
  async getLeaves(residentId?: number | null): Promise<LeaveApplication[]> {
    try {
      const key = `${STORAGE_KEYS.LEAVES}_${residentId || 'default'}`;
      const json = await AsyncStorage.getItem(key);
      if (json) return JSON.parse(json);
      return [
        {
          id: 'lev-1',
          startDate: '2026-11-10',
          endDate: '2026-11-14',
          reason: 'Family visit during long weekend',
          emergencyContact: '9848012345 (Father)',
          status: 'APPROVED',
          appliedOn: '2026-10-25',
        },
      ];
    } catch {
      return [];
    }
  },

  async applyLeave(residentId: number | null | undefined, leave: Omit<LeaveApplication, 'id' | 'status' | 'appliedOn'>): Promise<LeaveApplication> {
    const list = await this.getLeaves(residentId);
    const newLeave: LeaveApplication = {
      ...leave,
      id: `lev-${Date.now()}`,
      status: 'APPROVED',
      appliedOn: today(),
    };
    const updated = [newLeave, ...list];
    const key = `${STORAGE_KEYS.LEAVES}_${residentId || 'default'}`;
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    return newLeave;
  },

  // ── Meal Preferences ──
  async getMealPreferences(residentId?: number | null): Promise<MealPreference> {
    try {
      const key = `${STORAGE_KEYS.MEALS}_${residentId || 'default'}`;
      const json = await AsyncStorage.getItem(key);
      if (json) return JSON.parse(json);
      return {
        dietType: 'VEG',
        breakfastOptIn: true,
        lunchOptIn: true,
        dinnerOptIn: true,
        specialInstructions: '',
      };
    } catch {
      return {
        dietType: 'VEG',
        breakfastOptIn: true,
        lunchOptIn: true,
        dinnerOptIn: true,
      };
    }
  },

  async saveMealPreferences(residentId: number | null | undefined, prefs: MealPreference): Promise<void> {
    const key = `${STORAGE_KEYS.MEALS}_${residentId || 'default'}`;
    await AsyncStorage.setItem(key, JSON.stringify(prefs));
  },

  // ── Food Menu ──
  getWeeklyMenu(): FoodMenu[] {
    return DEFAULT_WEEKLY_MENU;
  },

  // ── Documents ──
  async getDocuments(): Promise<PgDocument[]> {
    return DEFAULT_DOCUMENTS;
  },

  // ── House rules (notice board) ──
  /**
   * The property's rules, from the device cache when it is fresh, otherwise from the server.
   * Only non-empty rules are cached, so rules the owner adds later are picked up on the next open.
   * If the server cannot be reached, an older stored copy is still shown.
   */
  async getRules(pgId: number | null | undefined): Promise<string> {
    const key = `${STORAGE_KEYS.RULES}_${pgId || 'default'}`;
    let stored: { rules: string; at: number } | null = null;
    try {
      const json = await AsyncStorage.getItem(key);
      if (json) stored = JSON.parse(json);
    } catch {
      stored = null;
    }
    if (stored && Date.now() - stored.at < RULES_TTL_MS) return stored.rules;
    try {
      const fetched = (await get<{ rules: string | null }>('/api/me/rules')).rules?.trim() ?? '';
      if (fetched) await AsyncStorage.setItem(key, JSON.stringify({ rules: fetched, at: Date.now() }));
      return fetched;
    } catch {
      return stored?.rules ?? '';
    }
  },
};
