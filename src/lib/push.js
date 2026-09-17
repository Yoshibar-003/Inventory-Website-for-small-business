/**
 * Web push subscribe/unsubscribe. Notifications are sent server-side (see
 * netlify/functions/api.mjs's notifyRoles) whenever an order is placed,
 * adjusted, or dispatched; a daily/production report is submitted; or stock
 * drops to its reorder point — fanned out by role, not by named person.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && Boolean(VAPID_PUBLIC_KEY);
}

/** "default" (not asked yet) | "granted" | "denied" — or null if unsupported. */
export function pushPermission() {
  if (!isPushSupported()) return null;
  return Notification.permission;
}

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Asks for permission (if needed) and registers a push subscription with the server. */
export async function subscribeToPush(api) {
  if (!isPushSupported()) throw new Error("push.unsupported");
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("push.denied");
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  await api.pushSubscribe({ subscription: subscription.toJSON() });
  return subscription;
}

/** Unsubscribes this device, both from the browser and the server's record of it. */
export async function unsubscribeFromPush(api) {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await api.pushUnsubscribe({ endpoint });
}

/** Whether this device already has an active push subscription. */
export async function hasPushSubscription() {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return false;
  const subscription = await registration.pushManager.getSubscription();
  return Boolean(subscription);
}
