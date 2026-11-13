import React from 'react';
import { AddPropertyModal } from '../ui';

/**
 * "Register as Owner": the same property wizard as Add Property, with an extra first step for the owner's own login.
 * Nothing is created until the super admin approves the request, so the owner cannot sign in before that.
 */
export default function OwnerRegisterModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return <AddPropertyModal registration visible={visible} onClose={onClose} />;
}
