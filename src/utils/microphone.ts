/*
 * Microphone access for calls. Browsers only allow it on https:// (or
 * http://localhost), and only after the user grants permission once.
 */

const CONSTRAINTS: MediaStreamConstraints = {
  // Echo cancellation matters most: without it the caller hears themselves
  // back through the staff member's speakers.
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
};

export function openMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia(CONSTRAINTS);
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Asks for the microphone once and releases it straight away — used when
 * going on duty, so the permission prompt appears then, not while a caller is
 * waiting. Returns a message to show, or null if the microphone works.
 */
export async function checkMicrophone(): Promise<string | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'This browser can’t use a microphone here. Open the portal over https in Chrome, Edge or Firefox.';
  }
  try {
    stopStream(await openMicrophone());
    return null;
  } catch (err) {
    return microphoneErrorMessage(err);
  }
}

export function microphoneErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError') {
    return 'Microphone access is blocked. Allow it for this site in your browser, then try again.';
  }
  if (name === 'NotFoundError') {
    return 'No microphone was found. Connect one, then try again.';
  }
  if (name === 'NotReadableError') {
    return 'Your microphone is being used by another app. Close it, then try again.';
  }
  return 'Could not start your microphone. Please try again.';
}
