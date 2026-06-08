import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.0c2049efa851486b94a395a84d60c4ba',
  appName: 'gasbee',
  webDir: 'dist',
  server: {
    url: 'https://0c2049ef-a851-486b-94a3-95a84d60c4ba.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    Geolocation: {
      permissions: ['location'],
    },
  },
};

export default config;
