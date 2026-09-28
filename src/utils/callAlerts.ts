/*
 * Ways to reach a staff member whose portal tab isn't in front: a system
 * notification (only while the tab is hidden, since the in-page ring card is
 * already visible otherwise) and a counter in the tab title.
 */

const BASE_TITLE = document.title;
const open = new Map<string, Notification>();

function supported(): boolean {
  return 'Notification' in window;
}

/** Call from a click handler — browsers ignore a permission prompt that isn't. */
export function requestNotificationPermission() {
  if (supported() && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

export function notificationsBlocked(): boolean {
  return supported() && Notification.permission === 'denied';
}

export function notifyIncomingCall(callId: string, aidTypeNames: string[]) {
  if (!supported() || Notification.permission !== 'granted' || !document.hidden) return;

  const notification = new Notification('Incoming emergency call', {
    body: aidTypeNames.join(', '),
    // One notification per call, even if the event arrives twice.
    tag: `haven-call-${callId}`,
    // Stays on screen until acted on, instead of fading after a few seconds.
    requireInteraction: true,
  });
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
  open.set(callId, notification);
}

/** Closes the notification of every call that is no longer ringing. */
export function closeNotificationsExcept(ringingCallIds: string[]) {
  for (const [callId, notification] of open) {
    if (!ringingCallIds.includes(callId)) {
      notification.close();
      open.delete(callId);
    }
  }
}

export function setRingingTitle(count: number) {
  document.title = count > 0 ? `(${count}) Incoming call · ${BASE_TITLE}` : BASE_TITLE;
}
