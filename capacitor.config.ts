import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.mannyeon.diary',
  appName: '만년 다이어리',
  webDir: 'dist',
  plugins: {
    SocialLogin: {
      // only Google is used (see native-google-auth.ts) — disabling the rest keeps them
      // out of the compiled APK
      providers: { google: true, facebook: false, apple: false, twitter: false },
    },
  },
};

export default config;
