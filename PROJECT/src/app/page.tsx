'use client';

import dynamic from 'next/dynamic';

// Dynamically import App to ensure browser-only APIs (Web Speech, window) run client-side
const App = dynamic(() => import('../App'), { ssr: false });

export default function Page() {
  return <App />;
}
