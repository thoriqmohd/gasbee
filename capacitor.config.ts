import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.0c2049efa851486b94a395a84d60c4ba',
  appName: 'gasbee',
  webDir: 'dist',
  // NOTE: no `server.url` — store builds must load the bundled web assets,
  // not the Lovable sandbox preview. Add it back only for local hot reload.
  plugins: {
    Geolocation: {
      permissions: ['location'],
    },
  },
};


export default config;
