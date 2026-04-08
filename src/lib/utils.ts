import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stringifyError(err: any): string {
  if (!err) return "Unknown error";
  if (typeof err === 'string') return err;
  
  // Handle Firestore JSON error from handleFirestoreError
  if (err.message && String(err.message).startsWith('{')) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed && parsed.error) return String(parsed.error);
    } catch (e) {
      // Not JSON or parsing failed
    }
  }

  if (err.message && String(err.message) !== "[object Object]") return String(err.message);
  if (err.error && typeof err.error === 'string') return err.error;
  if (err.details && typeof err.details === 'string') return err.details;
  
  try {
    // Handle Error objects specifically as they often don't stringify well with JSON.stringify
    const obj: any = {};
    Object.getOwnPropertyNames(err).forEach(key => {
      obj[key] = err[key];
    });
    const json = JSON.stringify(obj, null, 2);
    return json === "{}" ? String(err) : json;
  } catch (e) {
    return String(err);
  }
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
