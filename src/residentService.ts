import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AttendanceRecord,
  Complaint,
  FoodMenu,
  LeaveApplication,
  MealPreference,
  PgDocument,
  PgNotice,
  VisitorPass,
} from './types';
import { today } from './utils';

const STORAGE_KEYS = {
  COMPLAINTS: 'mypg_res_complaints',
  ATTENDANCE: 'mypg_res_attendance',
  VISITORS: 'mypg_res_visitors',
  LEAVES: 'mypg_res_leaves',
  MEALS: 'mypg_res_meal_prefs',
  NOTICES: 'mypg_res_notices',
  DOCUMENTS: 'mypg_res_documents',
};

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

const DEFAULT_NOTICES: PgNotice[] = [
  {
    id: 'not-1',
    title: 'Wi-Fi Fiber Maintenance Schedule',
    content: 'High-speed fiber optic line upgrade scheduled for this Saturday from 2:00 PM to 4:00 PM. High-speed backup Wi-Fi will remain active on Floor 1 & 2.',
    date: 'Today',
    category: 'MAINTENANCE',
    important: true,
  },
  {
    id: 'not-2',
    title: 'Festive Dinner & Common Area Celebration',
    content: 'Special festival dinner celebration will be served this Sunday starting at 8:00 PM in the dining hall. All residents are cordially invited!',
    date: 'Yesterday',
    category: 'EVENT',
    important: false,
  },
  {
    id: 'not-3',
    title: 'Visitor Timings & Gate Policy Reminder',
    content: 'Visitors are permitted in common lounge areas between 8:00 AM and 8:30 PM. Please ensure your visitors are registered in the resident app.',
    date: '3 days ago',
    category: 'RULE',
    important: false,
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
  // ── Complaints ──
  async getComplaints(residentId?: number | null): Promise<Complaint[]> {
    try {
      const key = `${STORAGE_KEYS.COMPLAINTS}_${residentId || 'default'}`;
      const json = await AsyncStorage.getItem(key);
      if (json) return JSON.parse(json);
      // Sample initial complaints
      return [
        {
          id: 'cmp-101',
          category: 'Wi-Fi',
          title: 'Wi-Fi speed drop in Room 204',
          description: 'Signal strength is weak near the balcony desk area.',
          priority: 'MEDIUM',
          status: 'IN_PROGRESS',
          createdAt: '2026-10-28',
          resolutionNotes: 'Wi-Fi repeater technician assigned to inspect signal router on 2nd floor.',
        },
        {
          id: 'cmp-100',
          category: 'Cleaning',
          title: 'Deep bathroom cleaning requested',
          description: 'Weekly scheduled deep bathroom and mirror cleaning.',
          priority: 'LOW',
          status: 'RESOLVED',
          createdAt: '2026-10-20',
          resolvedAt: '2026-10-21',
          resolutionNotes: 'Housekeeping team completed sanitization and tile cleaning.',
        },
      ];
    } catch {
      return [];
    }
  },

  async addComplaint(residentId: number | null | undefined, complaint: Omit<Complaint, 'id' | 'createdAt' | 'status'>): Promise<Complaint> {
    const list = await this.getComplaints(residentId);
    const newItem: Complaint = {
      ...complaint,
      id: `cmp-${Date.now()}`,
      createdAt: today(),
      status: 'OPEN',
    };
    const updated = [newItem, ...list];
    const key = `${STORAGE_KEYS.COMPLAINTS}_${residentId || 'default'}`;
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    return newItem;
  },

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

  // ── Notices ──
  async getNotices(): Promise<PgNotice[]> {
    return DEFAULT_NOTICES;
  },

  // ── Documents ──
  async getDocuments(): Promise<PgDocument[]> {
    return DEFAULT_DOCUMENTS;
  },
};
