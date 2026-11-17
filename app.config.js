// Extends app.json. EAS build profiles set APP_VARIANT (see eas.json).
// "development" installs side by side with the production app.
const isDev = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => ({
  ...config,
  name: isDev ? 'MyStay Dev' : config.name,
  android: {
    ...config.android,
    package: isDev ? 'com.mystay.app.dev' : config.android.package,
  },
  ios: {
    ...config.ios,
    bundleIdentifier: isDev ? 'com.mystay.app.dev' : 'com.mystay.app',
  },
});
