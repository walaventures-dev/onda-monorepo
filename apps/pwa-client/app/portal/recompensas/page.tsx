import { Suspense } from 'react';
import RecompensasClient from './RecompensasClient';

export default function RecompensasPage() {
  return (
    <Suspense fallback={null}>
      <RecompensasClient />
    </Suspense>
  );
}
