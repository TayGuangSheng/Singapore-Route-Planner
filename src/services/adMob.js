import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize
} from '@capacitor-community/admob';

const TEST_BANNER_AD_IDS = {
  android: 'ca-app-pub-3940256099942544/6300978111',
  ios: 'ca-app-pub-3940256099942544/2934735716'
};

const DEFAULT_BANNER_HEIGHT = 50;

const isExplicitFalse = (value) => ['0', 'false', 'off', 'no'].includes(String(value || '').toLowerCase());
const isExplicitTrue = (value) => ['1', 'true', 'on', 'yes'].includes(String(value || '').toLowerCase());

const getConfiguredAdId = (platform) => {
  if (platform === 'ios') {
    return import.meta.env.VITE_ADMOB_IOS_BANNER_ID || '';
  }
  if (platform === 'android') {
    return import.meta.env.VITE_ADMOB_ANDROID_BANNER_ID || '';
  }
  return '';
};

const shouldUseTestAds = (configuredAdId) => {
  if (isExplicitTrue(import.meta.env.VITE_ADMOB_USE_TEST_ADS)) {
    return true;
  }
  if (isExplicitFalse(import.meta.env.VITE_ADMOB_USE_TEST_ADS)) {
    return false;
  }
  return !configuredAdId;
};

export const setupAdMobBanner = async ({ onHeightChange } = {}) => {
  if (isExplicitFalse(import.meta.env.VITE_ADMOB_ENABLED) || !Capacitor.isNativePlatform()) {
    onHeightChange?.(0);
    return { remove: async () => {} };
  }

  const platform = Capacitor.getPlatform();
  const configuredAdId = getConfiguredAdId(platform);
  const useTestAds = shouldUseTestAds(configuredAdId);
  const adId = configuredAdId || TEST_BANNER_AD_IDS[platform];

  if (!adId) {
    onHeightChange?.(0);
    return { remove: async () => {} };
  }

  let bannerVisible = false;
  const handles = [];

  const sizeChangedHandle = await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
    const nextHeight = Number(size?.height) || DEFAULT_BANNER_HEIGHT;
    bannerVisible = true;
    onHeightChange?.(nextHeight);
  });
  handles.push(sizeChangedHandle);

  const failedHandle = await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error) => {
    console.warn('AdMob banner failed to load', error);
    bannerVisible = false;
    onHeightChange?.(0);
  });
  handles.push(failedHandle);

  await AdMob.initialize({ initializeForTesting: useTestAds });
  await AdMob.showBanner({
    adId,
    adSize: BannerAdSize.BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: 0,
    isTesting: useTestAds
  });

  bannerVisible = true;
  onHeightChange?.(DEFAULT_BANNER_HEIGHT);

  return {
    remove: async () => {
      if (bannerVisible) {
        await AdMob.removeBanner().catch((error) => {
          console.warn('AdMob banner cleanup failed', error);
        });
      }
      await Promise.all(handles.map((handle) => handle.remove()));
      onHeightChange?.(0);
    }
  };
};
