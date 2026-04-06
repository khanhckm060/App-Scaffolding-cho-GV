import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isInAppBrowser() {
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  return (
    ua.indexOf('FBAN') > -1 ||
    ua.indexOf('FBAV') > -1 ||
    ua.indexOf('Instagram') > -1 ||
    ua.indexOf('Messenger') > -1 ||
    ua.indexOf('Zalo') > -1 ||
    ua.indexOf('Line') > -1 ||
    ua.indexOf('MicroMessenger') > -1 ||
    ua.indexOf('Telegram') > -1
  );
}
