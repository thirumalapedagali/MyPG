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
  /** Owner only: show the consolidated figures of every property instead of the selected one. */
  allProperties?: boolean;
};

/** One of an owner's properties, as listed in the property switcher. */
export type PropertyCard = {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  stayType: string;
  rooms: number;
  beds: number;
  residents: number;
  licenseValid: boolean;
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
  /** Set when the occupant's notice is approved: the date this bed frees up. */
  availableFrom?: string | null;
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
  availableFrom?: string | null;
};

export type Resident = {
  id: number;
  name: string;
  /** Link to the profile photo the owner added, if any. */
  photoUrl?: string | null;
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
  /** Rent for the current billing cycle. */
  rent: number;
  /** Rent before any scheduled change; used to price past cycles. */
  baseRent?: number;
  /** Rent changes that take effect from the start of a billing cycle (ascending). */
  rentChanges?: { effectiveFrom: string; rent: number }[];
  securityDeposit?: number;
  returnedDeposit?: number;
  billed: number;
  paid: number;
  due: number;
  status?: 'ACTIVE' | 'CHECKED_OUT';
  /** Notice to vacate: null/absent when none has been given. */
  noticeStatus?: NoticeStatus | null;
  noticeGivenOn?: string | null;
  vacateOn?: string | null;
  noticeReason?: string | null;
  attachmentUrl?: string | null;
};

export type NoticeStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED';

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
  totalRefundableDeposit: number;
  months: { month: string; collected: number; spent: number }[];
  pendingDues: {
    residentId: number;
    name: string;
    roomNumber: string | null;
    sectionName: string | null;
    bedNumber: string | null;
    due: number;
    joinedOn: string;
    lastPaymentDate: string | null;
    floorName?: string | null;
  }[];
  checkInsToday: number;
  checkInsMonth: number;
  /** Only in the consolidated ("all properties") view. */
  properties?: PropertySummary[] | null;
};

export type PropertySummary = {
  pgId: number;
  name: string;
  city: string | null;
  rooms: number;
  beds: number;
  occupied: number;
  vacant: number;
  collectedMonth: number;
  spentMonth: number;
  totalDue: number;
  totalRefundableDeposit: number;
};

export type TodayData = {
  date: string;
  collected: number;
  spent: number;
  net: number;
  payments: {
    id: number;
    residentId: number;
    residentName: string;
    roomNumber?: string | null;
    sectionName?: string | null;
    bedNumber?: string | null;
    amount: number;
    pgId?: number;
    pgName?: string | null;
  }[];
  expenses: { id: number; title: string; category: string; amount: number; pgId?: number; pgName?: string | null }[];
  checkIns: {
    residentId: number;
    name: string;
    roomNumber?: string | null;
    sectionName?: string | null;
    bedNumber?: string | null;
    pgId?: number;
    pgName?: string | null;
  }[];
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

export type PgUser = {
  id: number;
  username: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  mobile: string;
  residentId: number | null;
};


export type AdminStats = {
  totalPgs: number;
  activePgs: number;
  blockedPgs: number;
  expiredPgs: number;
  expiringSoon: number;
  owners: number;
  managers: number;
  residents: number;
  blockedUsers: number;
  pendingRegistrations: number;
};

export type FeedbackItem = {
  id: number;
  type: 'SUGGESTION' | 'BUG' | 'OTHER';
  message: string;
  status: 'NEW' | 'REVIEWED';
  username: string;
  role: string;
  pgName: string | null;
  createdAt: string;
  reviewedAt: string | null;
};



export type OwnerRegistration = {
  id: number;
  propertyName: string;
  ownerName: string;
  mobile: string;
  email: string | null;
  stayType: string | null;
  address: string | null;
  city: string | null;
  upiId: string | null;
  startingPrice: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  pgId: number | null;
  createdAt: string;
  decidedAt: string | null;
};

export type AdminUser = {
  id: number;
  username: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  mobile: string;
  email: string | null;
  pgId: number | null;
  /** Names of every PG this user belongs to, comma separated. */
  pgName: string | null;
  pgIds: number[];
  residentId: number | null;
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
  /** Occupied beds whose resident has an approved notice, and the earliest date one frees up (YYYY-MM-DD). */
  upcomingBeds?: number;
  availableFrom?: string | null;
  /** HTTPS links to the pictures the owner added, first one is the cover. */
  images?: string[];
  /** Only on results of a location search. */
  distanceKm?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  sharingOptions?: StaySharingOption[];
};

/** A place found by the geocoder (GET /api/locations/suggestions). */
export type GeoPlace = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  locality?: string | null;
  subLocality?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
};

export type StaySharingOption = {
  sharingType: SharingType;
  label: string;
  rentPerMonth: number;
  maxRentPerMonth: number;
  availableBeds: number;
  /** Beds that free up soon (approved notice) and the earliest date. */
  upcomingBeds?: number;
  availableFrom?: string | null;
  depositPerMonth: number;
};

/** One result of GET /api/stays/nearby or /api/stays/search. */
export type StayCard = {
  propertyId: number;
  propertyName: string;
  stayType: string;
  genderType: string;
  address?: string | null;
  locality?: string | null;
  subLocality?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm: number;
  startingRent: number;
  maxRent: number;
  availableBeds: number;
  upcomingBeds?: number;
  availableFrom?: string | null;
  sharingOptions: StaySharingOption[];
  amenities: string[];
  images: string[];
  description?: string | null;
  contactMobile?: string | null;
};

export type PublicBed = {
  id: number;
  bedNumber: string;
  bedType: BedType;
  rent: number;
  status: BedStatus;
  /** Set when the bed is still occupied but will be free from this date. */
  availableFrom?: string | null;
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
  images?: string[];
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
  images?: string[];
};

export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type ComplaintStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

/** A complaint as the server returns it. Residents and staff get the same shape. */
export type Complaint = {
  id: number;
  /** Code of a COMPLAINT_CATEGORY lookup value. */
  category: string;
  categoryLabel: string;
  title: string;
  description: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  createdAt: string;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  /** Username of the owner / manager who last handled it. */
  handledBy?: string | null;
  /** False while the resident has not looked at the latest status change. */
  residentSeen: boolean;
  residentId: number;
  residentName?: string | null;
  residentPhone?: string | null;
  roomNumber?: string | null;
  bedNumber?: string | null;
};

/** One meal of the property's weekly menu; `dayOfWeek` is 1 = Monday ... 7 = Sunday and times are `HH:mm`. */
export type MenuMeal = {
  id: number;
  dayOfWeek: number;
  name: string;
  startTime: string;
  endTime: string;
  items: string[];
};

/** A meal on a date as the resident sees it (today / tomorrow). */
export type MealOccurrence = {
  mealId: number;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  items: string[];
  state: 'NOW' | 'UPCOMING';
  attending: boolean;
  canRespond: boolean;
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

/** One row of the lookup table as the super admin sees it (inactive rows included). */
export type LookupRow = {
  id: number;
  category: string;
  code: string;
  label: string;
  extra: string | null;
  sortOrder: number;
  active: boolean;
};
/** Property configuration catalog (backend `com.pg.config`). */
export type ConfigFieldType =
  | 'TEXT' | 'NUMBER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'TIME'
  | 'DROPDOWN' | 'MULTI_SELECT' | 'CHECKBOX' | 'RADIO' | 'IMAGE' | 'DOCUMENT';
export type AmenityLevel = 'PROPERTY' | 'ROOM' | 'BOTH';
export type ConfigPropertyType = { code: string; label: string; unitLabel: string };
export type ConfigCategory = { id: number; code: string; name: string; description: string | null; sortOrder: number; active: boolean };
export type ConfigAmenity = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  applicableLevel: AmenityLevel;
  active: boolean;
  categoryCode: string;
  categoryName: string;
};
export type ConfigField = {
  id: number;
  code: string;
  label: string;
  description: string | null;
  fieldType: ConfigFieldType;
  category: string | null;
  placeholder: string | null;
  defaultValue: string | null;
  options: { value: string; label: string }[] | null;
  validationRules: Record<string, number | string> | null;
  required: boolean;
  active: boolean;
  sortOrder: number;
};
export type ConfigTypeAmenity = { amenity: ConfigAmenity; defaultSelected: boolean; required: boolean; sortOrder: number; active: boolean };
export type ConfigTypeField = { field: ConfigField; required: boolean; sortOrder: number; active: boolean };
export type ConfigPropertyTypeDetail = ConfigPropertyType & { amenities: ConfigTypeAmenity[]; fields: ConfigTypeField[] };
/** A property's saved configuration, shaped by its property type (GET /api/properties/{id}/configuration). */
export type PropertyConfiguration = {
  propertyId: number;
  name: string;
  stayType: string;
  stayTypeLabel: string;
  amenities: { amenity: ConfigAmenity; defaultSelected: boolean; required: boolean; selected: boolean; notes: string | null }[];
  fields: { field: ConfigField; required: boolean; value: string | number | boolean | string[] | null }[];
};

/** A notice the owner posted for the residents of a property. */
export type Announcement = {
  id: number;
  title: string;
  content: string;
  category: 'MAINTENANCE' | 'ANNOUNCEMENT' | 'EVENT' | 'RULE';
  important: boolean;
  date: string;
};
/** A phone contact the owner shares with residents (warden, plumber, emergency...). */
export type SupportContact = {
  id: number;
  name: string;
  phone: string;
  note: string | null;
};



export type PgDocument = {
  id: string;
  title: string;
  type: 'AGREEMENT' | 'ID_PROOF' | 'RECEIPT' | 'POLICY';
  date: string;
  status?: string;
  fileSize?: string;
};
