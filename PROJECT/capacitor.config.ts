import type { CapacitorConfig } from '@capacitor/cli';

const liveServerUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.lykarealty.aicalling',
  appName: 'Lyka Realty AI',
  webDir: 'dist',
  server: liveServerUrl
    ? {
        url: liveServerUrl,
        cleartext: liveServerUrl.startsWith('http://'),
      }
    : {
        androidScheme: 'https',
        cleartext: true,
      },
  android: {
    allowMixedContent: true,
    backgroundColor: '#020617',
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#020617',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#020617',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#020617',
    },
  },
};

export default config;
