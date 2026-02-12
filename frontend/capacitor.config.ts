import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.mknet.adcontrol',
  appName: 'AdControl',
  webDir: '.',
  server: {
    androidScheme: 'https'
  }
};

export default config;
