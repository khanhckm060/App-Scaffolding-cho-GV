import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stringifyError(err: any): string {
  if (!err) return "Unknown error";
  if (typeof err === 'string') return err;
  
  // Handle Firestore JSON error from handleFirestoreError or Gemini ApiError
  let rawMessage = err.message ? String(err.message) : "";
  if (rawMessage.startsWith('ApiError: ')) {
    rawMessage = rawMessage.replace('ApiError: ', '').trim();
  }

  if (rawMessage.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed && parsed.error) {
        if (parsed.error.code === 429 || parsed.error.status === "RESOURCE_EXHAUSTED") {
          return "Bạn đã hết lượt sử dụng AI miễn phí trong hôm nay (Quota Exceeded). Vui lòng thử lại sau hoặc nâng cấp gói API.";
        }
        return String(parsed.error.message || parsed.error);
      }
    } catch (e) {
      // Not JSON or parsing failed
    }
  }

  // Handle Gemini SDK specific error format if it's not a string but has these properties
  if (err.status === 429 || (err.error && err.error.code === 429)) {
    return "Bạn đã hết lượt sử dụng AI miễn phí trong hôm nay (Quota Exceeded). Vui lòng thử lại sau hoặc nâng cấp gói API.";
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

export function getDirectAudioUrl(url: string): string {
  if (!url) return "";
  
  // Google Drive
  // Matches: 
  // - drive.google.com/file/d/ID/view
  // - drive.google.com/uc?id=ID
  // - drive.google.com/open?id=ID
  const driveMatch = url.match(/(?:id=|\/d\/|file\/d\/)([\w-]{25,})/);
  if (driveMatch && driveMatch[1]) {
    // Using docs.google.com/uc?id=ID is often more reliable for direct streaming
    return `https://docs.google.com/uc?id=${driveMatch[1]}&export=download`;
  }
  
  // Dropbox
  if (url.includes("dropbox.com")) {
    return url.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace("?dl=0", "").replace("?dl=1", "");
  }
  
  return url;
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
