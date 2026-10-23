import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lykarealty.app',
  appName: 'Lyka Realty',
  webDir: 'dist',
  server: {
    // Points directly to the live Render backend for full AI chat streaming, Brevo OTP, and Firestore integration
    url: 'https://lyka-reality-pro2-latest.onrender.com',
    cleartext: true,
    androidScheme: 'https'
  }
};

export default config;
