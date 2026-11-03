// Shapes returned by pg-management-backend (see backend/README.md). Money is a number, dates are YYYY-MM-DD.

export type Role = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'RESIDENT';

/** The signed-in user, as returned by POST /api/auth/login. */
export type User = {
  role: Role;
  userId: number;
  username: string;
  /** null for a SUPER_ADMIN who has not opened a PG yet. */
  pgId: number | null;
  pgName: string | null;
  totalFloors?: number | null;
  /** Only for RESIDENT logins. */
  residentId: number | null;
  mustChangePassword: boolean;
};

export type LoginResponse = {
  token: string;
  role: Role;
  userId: number;
  username: string;
  pgId: number | null;
  pgName: string | null;
  totalFloors?: number | null;
  residentId: number | null;
  requiresPgSelection: boolean;
  mustChangePassword: boolean;
};

export type PropertyType = 'APARTMENT' | 'PG' | 'HOSTEL' | 'COLIVING' | 'STUDIO' | 'HOUSE';
export type RoomType = 'STANDARD' | 'FLAT_1BHK' | 'FLAT_2BHK' | 'FLAT_3BHK' | 'DORMITORY' | 'STUDIO';
export type SharingType = 'PRIVATE' | 'TWO_SHARING' | 'THREE_SHARING' | 'FOUR_SHARING' | 'DORM' | 'WHOLE_ROOM';
export type StayType = 'MONTHLY' | 'DAILY';
export type AcType = 'AC' | 'NON_AC';
export type GenderPolicy = 'MALE' | 'FEMALE' | 'UNISEX' | 'COUPLE';
export type BedType = 'SINGLE' | 'DOUBLE' | 'BUNK_UPPER' | 'BUNK_LOWER';
export type BedStatus = 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';

export type Bed = {
  id: number;
  bedNumber: string;
  bedType: BedType;
  rent: number;
  status: BedStatus;
  residentId?: number | null;
  residentName?: string | null;
};

export type RoomSection = {
  id: number;
  sectionName: string;
  sharingType: SharingType;
  capacity: number;
  rentPerBed: number;
  depositPerBed: number;
  acType: AcType;
  attachedBathroom: boolean;
  beds: Bed[];
};

export type SharingOption = {
  id?: number;
  sharingType: SharingType;
  capacity: number;
  rentPerBed: number;
  depositPerBed?: number;
  active?: boolean;
};

export type Room = {
  id: number;
  number: string;
  roomName?: string | null;
  buildingName?: string | null;
  floorName?: string | null;
  roomType: RoomType;
  acType: AcType;
  attachedBathroom: boolean;
  balcony: boolean;
  genderPolicy: GenderPolicy;
  capacity: number;
  rent: number;
  dailyRent?: number | null;
  occupied: number;
  vacant: number;
  sharingOptions?: SharingOption[];
  sections?: RoomSection[];
  /** null when the caller is a resident (they only see availability). */
  occupants: string[] | null;
};

export type Resident = {
  id: number;
  name: string;
  phone: string | null;
  roomId: number;
  roomNumber: string | null;
  sectionId?: number | null;
  sectionName?: string | null;
  bedId?: number | null;
  bedNumber?: string | null;
  sharingOptionId?: number | null;
  sharingType?: SharingType | null;
  stayType?: StayType;
  dailyRate?: number | null;
  checkOutDate?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  daysStayed?: number;
  hoursStayed?: number | null;
  joinedOn: string;
  rent: number;
  securityDeposit?: number;
  billed: number;
  paid: number;
  due: number;
  status?: 'ACTIVE' | 'CHECKED_OUT';
};

export type Payment = {
  id: number;
  residentId: number;
  amount: number;
  date: string;
  mode?: string;
  transactionRef?: string | null;
  notes?: string | null;
  createdBy?: string;
};

export type Expense = { id: number; title: string; category: string; amount: number; date: string };
export type ExpenseCategory = { id: number; name: string };

export type Paged<T> = { content: T[]; page: number; size: number; totalElements: number; totalPages: number };

export type Totals = { today: number; month: number; year: number; total: number };

export type Summary = {
  collections: Totals;
  expenses: Totals;
  net: Totals;
  rooms: number;
  beds: number;
  occupied: number;
  vacant: number;
  residents: number;
  totalDue: number;
  months: { month: string; collected: number; spent: number }[];
  pendingDues: { residentId: number; name: string; roomNumber: string | null; due: number }[];
  checkInsToday: number;
  checkInsMonth: number;
};

export type TodayData = {
  date: string;
  collected: number;
  spent: number;
  net: number;
  payments: { id: number; residentId: number; residentName: string; roomNumber?: string | null; bedNumber?: string | null; amount: number }[];
  expenses: { id: number; title: string; category: string; amount: number }[];
  checkIns: { residentId: number; name: string; roomNumber?: string | null; bedNumber?: string | null }[];
};

export type ResidentPgInfo = {
  id: number;
  name: string;
  stayType?: PropertyType | string | null;
  unitLabel?: string | null;
  locationUrl?: string | null;
  genderType?: string | null;
  upiId?: string | null;
  upiName?: string | null;
  ownerMobile?: string | null;
  ownerEmail?: string | null;
};

export type MyDuesData = {
  resident: Resident;
  payments: Payment[];
  pg?: ResidentPgInfo | null;
};

export type ManagedUser = {
  id: number;
  username: string;
  email: string | null;
  mobile: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  residentId: number | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

export type PgInfo = {
  id: number;
  name: string;
  ownerName: string | null;
  mobile: string | null;
  email: string | null;
  address?: string | null;
  city: string | null;
  state?: string | null;
  totalFloors?: number | null;
  stayType?: PropertyType | string | null;
  unitLabel?: string | null;
  locationUrl?: string | null;
  genderType?: string | null;
  upiId?: string | null;
  upiName?: string | null;
  description?: string | null;
  amenities?: string | null;
  startingPrice?: number | null;
  plan: string | null;
  licenseExpiry: string | null;
  active: boolean;
};

export type WhatsappConfig = {
  id?: number;
  pgId: number;
  phoneNumberId: string;
  wabaId?: string;
  apiVersion?: string;
  hasAccessToken?: boolean;
  accessToken?: string;
  enabled: boolean;
  notifyOnPayment: boolean;
  notifyOnDueReminder: boolean;
  notifyOnOnboarding: boolean;
  notifyOnMove: boolean;
};

export type WhatsappMessageLog = {
  id: number;
  pgId: number;
  recipient: string;
  messageType: string;
  status: 'SENT' | 'FAILED';
  error?: string | null;
  createdAt: string;
};

export type PublicPgSummary = {
  id: number;
  name: string;
  ownerName: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  totalFloors: number;
  stayType?: PropertyType | string | null;
  unitLabel?: string | null;
  locationUrl?: string | null;
  genderType: string;
  upiId?: string | null;
  upiName?: string | null;
  description?: string;
  amenities: string[];
  startingPrice: number;
  totalRooms: number;
  totalBeds: number;
  vacantBeds: number;
};

export type PublicBed = {
  id: number;
  bedNumber: string;
  bedType: BedType;
  rent: number;
  status: BedStatus;
};

export type PublicSection = {
  id: number;
  sectionName: string;
  sharingType: SharingType;
  capacity: number;
  rentPerBed: number;
  depositPerBed: number;
  acType: AcType;
  attachedBathroom: boolean;
  vacantBeds: PublicBed[];
};

export type PublicSharingOption = {
  id: number;
  sharingType: SharingType;
  capacity: number;
  rentPerBed: number;
  depositPerBed: number;
};

export type BookingRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type BookingRequest = {
  id: number;
  pgId: number;
  roomId?: number | null;
  roomNumber?: string | null;
  sectionId?: number | null;
  sectionName?: string | null;
  bedId?: number | null;
  bedNumber?: string | null;
  name: string;
  mobile: string;
  email?: string | null;
  expectedJoinDate?: string | null;
  message?: string | null;
  rent?: number | null;
  deposit?: number | null;
  status: BookingRequestStatus;
  rejectionReason?: string | null;
  residentId?: number | null;
  createdAt: string;
};

export type PublicRoom = {
  id: number;
  number: string;
  roomName?: string;
  buildingName?: string;
  floorName?: string;
  roomType: RoomType;
  acType: AcType;
  attachedBathroom: boolean;
  balcony: boolean;
  genderPolicy: GenderPolicy;
  capacity: number;
  rent: number;
  dailyRent?: number;
  vacantBedsCount: number;
  sharingOptions: PublicSharingOption[];
  sections: PublicSection[];
  allVacantBeds: PublicBed[];
};

export type PublicPgDetail = {
  id: number;
  name: string;
  ownerName: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  totalFloors: number;
  stayType?: PropertyType | string | null;
  unitLabel?: string | null;
  locationUrl?: string | null;
  genderType: string;
  upiId?: string | null;
  upiName?: string | null;
  description?: string;
  amenities: string[];
  startingPrice: number;
  totalRooms: number;
  totalBeds: number;
  totalVacantBeds: number;
  rooms: PublicRoom[];
};

export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type ComplaintStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export type Complaint = {
  id: string;
  category: 'Plumbing' | 'Electrical' | 'Wi-Fi' | 'Cleaning' | 'Food' | 'Air Conditioning' | 'Room Furniture' | 'Other';
  title: string;
  description: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
};

export type FoodMenu = {
  day: string;
  breakfast: string;
  lunch: string;
  snacks: string;
  dinner: string;
};

export type MealPreference = {
  dietType: 'VEG' | 'NON_VEG';
  breakfastOptIn: boolean;
  lunchOptIn: boolean;
  dinnerOptIn: boolean;
  specialInstructions?: string;
};

export type AttendanceRecord = {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  timestamp: string;
  date: string;
  location?: string;
};

export type VisitorPass = {
  id: string;
  visitorName: string;
  visitorPhone: string;
  relationship: string;
  visitDate: string;
  visitTime: string;
  purpose: string;
  status: 'APPROVED' | 'PENDING' | 'CHECKED_IN' | 'COMPLETED';
};

export type LeaveApplication = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  emergencyContact?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  appliedOn: string;
};

export type PgNotice = {
  id: string;
  title: string;
  content: string;
  date: string;
  category: 'MAINTENANCE' | 'ANNOUNCEMENT' | 'EVENT' | 'RULE';
  important?: boolean;
};

export type PgDocument = {
  id: string;
  title: string;
  type: 'AGREEMENT' | 'ID_PROOF' | 'RECEIPT' | 'POLICY';
  date: string;
  status?: string;
  fileSize?: string;
};
