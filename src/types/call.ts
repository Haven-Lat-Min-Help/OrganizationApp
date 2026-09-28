/*
 * The calling socket contract, mirrored from Backend/src/realtime/types.ts
 * (staff side only). There is no shared package, so when an event changes
 * there, change it here too.
 */

export type IceServer = { urls: string[]; username?: string; credential?: string };

export type AckError = { ok: false; error: string; message: string };
export type AckResult<T extends object = object> = ({ ok: true } & T) | AckError;
type Ack<T extends object = object> = (result: AckResult<T>) => void;

export type ConnectInfo = { callId: string; iceServers: IceServer[] };

export type Signal =
  | { type: 'offer' | 'answer'; sdp: string }
  | { type: 'candidate'; candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null } };

export type RingStopReason = 'taken' | 'declined' | 'cancelled' | 'missed' | 'busy';
export type EndStatus = 'missed' | 'cancelled' | 'completed' | 'dropped';

export type ServerToClientEvents = {
  'session:ready': (payload: { kind: 'caller' | 'staff' }) => void;
  'call:incoming': (payload: { callId: string; aidTypeNames: string[]; ringSeconds: number }) => void;
  'call:ring-stopped': (payload: { callId: string; reason: RingStopReason }) => void;
  'call:ended': (payload: { callId: string; status: EndStatus }) => void;
  'call:signal': (payload: { callId: string; signal: Signal }) => void;
};

export type ClientToServerEvents = {
  'duty:set': (payload: { onDuty: boolean }, ack: Ack<{ onDuty: boolean }>) => void;
  'call:accept': (payload: { callId: string }, ack: Ack<ConnectInfo>) => void;
  'call:decline': (payload: { callId: string }, ack: Ack) => void;
  'call:hangup': (payload: { callId: string; failed?: boolean }, ack: Ack) => void;
  'call:signal': (payload: { callId: string; signal: Signal }, ack: Ack) => void;
};

/** A call ringing on this tab. expiresAt is local time, only for the countdown. */
export type Ring = { callId: string; aidTypeNames: string[]; expiresAt: number };

/** Where the audio connection is (utils/audioCall.ts). */
export type AudioState = 'connecting' | 'connected' | 'reconnecting' | 'failed';

/** The call this staff member answered. */
export type ActiveCall = {
  callId: string;
  aidTypeNames: string[];
  audio: AudioState;
  /** Local time the audio first connected; drives the call timer. */
  connectedAt: number | null;
  muted: boolean;
};

export type EndedCall = {
  callId: string;
  aidTypeNames: string[];
  status: EndStatus;
  /** The audio never connected (or broke for good), as opposed to someone hanging up. */
  audioFailed: boolean;
};
