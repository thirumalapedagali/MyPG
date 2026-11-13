
import { Alert } from 'react-native';
import { LookupItem, unitLabelFor } from './lookups';
import { GeoPlace } from './types';
import type { FieldDef } from './ui';

/* =========================================================
   TYPES
========================================================= */

export type AmenityOption = {
  code: string;
  label: string;
  group: string;
  locked: boolean;
  preselect: boolean;
};

export type PropertyStep = {
  id: 'basic' | 'amenities' | 'policy' | 'payment';
  title: string;
  subtitle: string;
  fields: FieldDef[];
};

/* =========================================================
   AMENITIES
========================================================= */

export function useTypeAmenities(
  _type: string | undefined
): AmenityOption[] {
  const list = [
    'Lift',
    'Bike Parking',
    'Car Parking',
    'Watchman',
    'Wi-Fi',
    'Power Backup',
    'RO Drinking Water',
    'Washing Machine',
    'Fridge',
    'CCTV Security',
    'Finger Print',
    'Geyser',
    'Daily Cleaning',
    'Food / Mess',
    'Gym',
  ];

  return list.map((amenity) => ({
    code: amenity,
    label: amenity,
    group: '',
    locked: false,
    preselect: false,
  }));
}

/* =========================================================
   INITIAL AMENITIES
========================================================= */

export function initialAmenities(
  items: AmenityOption[],
  saved: string[],
  legacyText: string | null | undefined
): string {
  const available = new Set(items.map((i) => i.code));

  let picked = saved.filter((code) => available.has(code));

  // Support older properties with comma-separated amenity names.
  if (picked.length === 0 && legacyText) {
    const words = legacyText
      .split(',')
      .map((word) => word.trim().toLowerCase());

    picked = items
      .filter((item) =>
        words.includes(item.label.toLowerCase())
      )
      .map((item) => item.code);
  }

  // Apply default amenities when nothing is saved.
  if (picked.length === 0) {
    picked = items
      .filter((item) => item.preselect)
      .map((item) => item.code);
  }

  const locked = items
    .filter((item) => item.locked)
    .map((item) => item.code);

  return [...new Set([...locked, ...picked])].join(',');
}

/* =========================================================
   SELECTED AMENITY CODES
========================================================= */

export const pickedCodes = (
  value: string | undefined,
  items: AmenityOption[]
) => {
  const locked = items
    .filter((item) => item.locked)
    .map((item) => item.code);

  const selected = (value ?? '')
    .split(',')
    .filter(Boolean);

  return [...new Set([...locked, ...selected])];
};

/* =========================================================
   PINCODE LOOKUP
========================================================= */

export async function lookupPincode(
  pincode: string
): Promise<Record<string, string> | null> {
  if (!/^\d{6}$/.test(pincode)) {
    return null;
  }

  const ctrl = new AbortController();

  const timer = setTimeout(() => {
    ctrl.abort();
  }, 8000);

  try {
    const response = await fetch(
      `https://api.postalpincode.in/pincode/${encodeURIComponent(pincode)}`,
      { signal: ctrl.signal }
    );

    if (!response.ok) {
      return null;
    }

    const body = await response.json();

    const offices: {
      Name?: string;
      District?: string;
      Block?: string;
      State?: string;
    }[] = body?.[0]?.PostOffice ?? [];

    if (
      body?.[0]?.Status !== 'Success' ||
      offices.length === 0
    ) {
      return null;
    }

    const first = offices[0];

    return {
      area: first.Name ?? '',
      city: first.District || first.Block || '',
      state: first.State ?? '',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* =========================================================
   PROPERTY CREATION - FOUR STEP WIZARD
========================================================= */

export function newPropertySteps(opts: {
  stayTypes: LookupItem[];
  genderPolicies: LookupItem[];
  defaultType: string;
  amenities: AmenityOption[];
}): PropertyStep[] {
  const {
    stayTypes,
    genderPolicies,
    defaultType,
    amenities,
  } = opts;

  /* STEP 1: BASIC INFORMATION */

  const basicFields: FieldDef[] = [
    {
      key: 'name',
      label: 'Property / Stay Name *',
    },
    {
      key: 'stayType',
      label: 'Type of Stay *',
      initial: defaultType,
      options: stayTypes,
    },
    {
      key: 'unitLabel',
      label: 'Unit Label',
      optional: true,
    },
    {
      key: 'pincode',
      label: 'Pincode * (6 digits - fills area, city & state)',
      keyboard: 'number-pad',
      autofill: {
        length: 6,
        fetch: lookupPincode,
      },
    },
    // Filled from the pincode only; checked together in the wizard's first step.
    {
      key: 'area',
      label: 'Area / Locality',
      optional: true,
      readOnly: true,
      placeholder: 'Filled from the pincode',
    },
    {
      key: 'city',
      label: 'City',
      optional: true,
      readOnly: true,
      placeholder: 'Filled from the pincode',
    },
    {
      key: 'state',
      label: 'State',
      optional: true,
      readOnly: true,
      placeholder: 'Filled from the pincode',
    },
    {
      key: 'address',
      label: 'Full Address *',
      placeholder: 'e.g. #42, 5th Cross, Near Metro Station',
    },
    {
      key: 'totalFloors',
      label: 'Number of Floors *',
      keyboard: 'number-pad',
      placeholder: 'e.g. 4',
    },
    {
      key: 'description',
      label: 'Property Description',
      optional: true,
    },
  ];

  /* STEP 2: AMENITIES */

  const amenityFields: FieldDef[] = [
    {
      key: 'amenities',
      label: 'Property Amenities',
      optional: true,
      resetOn: 'stayType',
      initial: initialAmenities(amenities, [], null),
      checklist: amenities,
    },
  ];

  /* STEP 3: OCCUPANCY POLICY */

  const policyFields: FieldDef[] = [
    {
      key: 'genderType',
      label: 'Occupancy Policy *',
      initial: 'CO_LIVING',
      options: genderPolicies,
    },
    {
      key: 'rules',
      label: 'Rules & Regulations',
      optional: true,
      multiline: true,
      placeholder:
        '1. Gate closes at 10:30 PM\n2. No smoking inside the rooms\n3. Visitors only in the common area',
    },
  ];

  /* STEP 4: PAYMENT AND SETUP */

  const paymentFields: FieldDef[] = [
    {
      key: 'upiId',
      label: 'UPI ID for Rent Collections *',
      keyboard: 'email-address',
    },
    {
      key: 'upiName',
      label: 'UPI Account Name (Payee Name)',
      optional: true,
    },
    {
      key: 'contactMobile',
      label: 'Contact Mobile',
      keyboard: 'phone-pad',
      optional: true,
    },
    {
      key: 'alternateMobile',
      label: 'Alternate Contact Mobile',
      keyboard: 'phone-pad',
      optional: true,
    },
    {
      key: 'startingPrice',
      label: 'Starting Monthly Rent (₹)',
      keyboard: 'number-pad',
      initial: '5000',
    },
  ];

  return [
    {
      id: 'basic',
      title: 'Basic Information',
      subtitle: 'Tell us about your property',
      fields: basicFields,
    },
    {
      id: 'amenities',
      title: 'Property Amenities',
      subtitle: 'Select the facilities available at your property',
      fields: amenityFields,
    },
    {
      id: 'policy',
      title: 'Occupancy & Property Policy',
      subtitle: 'Set rules and occupancy preferences',
      fields: policyFields,
    },
    {
      id: 'payment',
      title: 'Payment & Setup',
      subtitle: 'Configure rent collection and finish setup',
      fields: paymentFields,
    },
  ];
}

/* =========================================================
   BACKWARD COMPATIBILITY
   Existing screens using newPropertyFields continue working.
========================================================= */

export function newPropertyFields(opts: {
  stayTypes: LookupItem[];
  genderPolicies: LookupItem[];
  defaultType: string;
  amenities: AmenityOption[];
}): FieldDef[] {
  return newPropertySteps(opts).flatMap(
    (step) => step.fields
  );
}

/* =========================================================
   UPI VALIDATION
========================================================= */

export function upiIsValid(upiId: string): boolean {
  if (/^[^\s@]+@[^\s@]+$/.test(upiId)) {
    return true;
  }

  Alert.alert(
    'Invalid UPI ID',
    'Enter a valid UPI ID such as 9876543210@paytm.'
  );

  return false;
}

/* =========================================================
   PROPERTY REQUEST BODY
========================================================= */

export function newPropertyBody(
  v: Record<string, string>,
  stayTypes: LookupItem[],
  amenities: AmenityOption[],
  place?: GeoPlace | null
) {
  const floors = parseInt(v.totalFloors, 10);

  return {
    latitude: place?.latitude,
    longitude: place?.longitude,

    locality:
      v.area || place?.locality || undefined,

    subLocality:
      place?.subLocality || undefined,

    state:
      v.state || place?.state || undefined,

    pincode:
      v.pincode || place?.pincode || undefined,

    country:
      place?.country || undefined,

    name: v.name,

    stayType:
      v.stayType?.toUpperCase() || 'PG',

    unitLabel:
      v.unitLabel ||
      unitLabelFor(stayTypes, v.stayType),

    address:
      v.address || undefined,

    amenityCodes:
      amenities.length
        ? pickedCodes(v.amenities, amenities)
        : undefined,

    city:
      v.city || place?.city || undefined,

    genderType:
      v.genderType?.toUpperCase() || 'CO_LIVING',

    upiId: v.upiId,

    upiName:
      v.upiName || undefined,

    contactMobile:
      v.contactMobile || undefined,

    alternateMobile:
      v.alternateMobile?.trim() || undefined,

    description:
      v.description || undefined,

    rules:
      v.rules?.trim() || undefined,

    startingPrice:
      parseFloat(v.startingPrice) || undefined,

    totalFloors:
      floors > 0 ? floors : undefined,
  };
}
