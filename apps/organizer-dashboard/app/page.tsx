'use client';

import { OrganizerAuthProvider } from '../lib/organizerAuth';
import OrganizerPage from './OrganizerPage';

export default function Page() {
  return (
    <OrganizerAuthProvider>
      <OrganizerPage />
    </OrganizerAuthProvider>
  );
}
