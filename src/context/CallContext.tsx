import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { BACKEND_URL } from '../config/api';
import { supabase } from '../config/supabase';
import type {
  ActiveCall,
  AudioState,
  ClientToServerEvents,
  EndStatus,
  EndedCall,
  Ring,
  RingStopReason,
  ServerToClientEvents,
  Signal,
} from '../types/call';
import { AudioCall } from '../utils/audioCall';
import {
  closeNotificationsExcept,
  notifyIncomingCall,
  requestNotificationPermission,
  setRingingTitle,
} from '../utils/callAlerts';
import { checkMicrophone, microphoneErrorMessage, openMicrophone, stopStream } from '../utils/microphone';
import { startRingtone, stopRingtone, unlockAudio } from '../utils/ringtone';

type CallSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// How long to wait for the server to answer a request before telling the
// staff member it failed.
const ACK_TIMEOUT_MS = 8000;
// Retry delay after the server refused the connection for a reason of its own
// (auth or database briefly unreachable). Plain network drops are retried by
// Socket.IO itself.
const RETRY_DELAY_MS = 5000;

const NETWORK_ERROR = "Couldn't reach Haven. Check your connection and try again.";

/** Shown when a ring disappears without this tab acting on it. */
const RING_STOP_NOTICES: Partial<Record<RingStopReason, string>> = {
  taken: 'Another responder answered the call.',
  cancelled: 'The caller hung up.',
};

interface CallState {
  connection: 'connecting' | 'connected' | 'offline';
  /** The server refused this account outright; nothing retries. */
  fatalError: string | null;
  /** What the staff member asked for — survives a reconnect, unlike onDuty. */
  wantOnDuty: boolean;
  /** What the server has confirmed for this tab. */
  onDuty: boolean;
  dutyPending: boolean;
  dutyError: string | null;
  rings: Ring[];
  acceptingCallId: string | null;
  activeCall: ActiveCall | null;
  lastEnded: EndedCall | null;
  notice: string | null;
}

type Action =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'fatal'; message: string }
  | { type: 'want_duty'; value: boolean }
  | { type: 'duty_pending' }
  | { type: 'duty_result'; onDuty: boolean; error?: string }
  | { type: 'ring'; ring: Ring }
  | { type: 'ring_removed'; callId: string; notice?: string }
  | { type: 'accept_started'; callId: string }
  | { type: 'accept_succeeded'; callId: string; aidTypeNames: string[] }
  | { type: 'accept_failed'; callId: string; notice: string }
  | { type: 'audio_state'; callId: string; audio: AudioState }
  | { type: 'muted'; callId: string; muted: boolean }
  | { type: 'call_ended'; callId: string; status: EndStatus }
  | { type: 'dismiss_ended' }
  | { type: 'dismiss_notice' };

const initialState: CallState = {
  connection: 'connecting',
  fatalError: null,
  wantOnDuty: false,
  onDuty: false,
  dutyPending: false,
  dutyError: null,
  rings: [],
  acceptingCallId: null,
  activeCall: null,
  lastEnded: null,
  notice: null,
};

function endedFrom(call: ActiveCall, status: EndStatus): EndedCall {
  return { callId: call.callId, aidTypeNames: call.aidTypeNames, status, audioFailed: call.audio === 'failed' };
}

function reducer(state: CallState, action: Action): CallState {
  switch (action.type) {
    case 'connected':
      return { ...state, connection: 'connected', fatalError: null };

    // The server forgets this socket's duty and rings when it goes, and drops
    // a call it was on — so this tab does the same.
    case 'disconnected':
      return {
        ...state,
        connection: 'offline',
        onDuty: false,
        dutyPending: false,
        rings: [],
        acceptingCallId: null,
        activeCall: null,
        lastEnded: state.activeCall ? endedFrom(state.activeCall, 'dropped') : state.lastEnded,
      };

    case 'fatal':
      return { ...state, connection: 'offline', fatalError: action.message, wantOnDuty: false, onDuty: false };

    case 'want_duty':
      return { ...state, wantOnDuty: action.value };

    case 'duty_pending':
      return { ...state, dutyPending: true, dutyError: null };

    case 'duty_result':
      return {
        ...state,
        dutyPending: false,
        onDuty: action.onDuty,
        // A refusal clears the intent too, or a reconnect would retry it.
        wantOnDuty: action.onDuty,
        dutyError: action.error ?? null,
        rings: action.onDuty ? state.rings : [],
      };

    case 'ring':
      // The server doesn't ring someone on a call; ignore a duplicate or a straggler.
      if (state.activeCall || state.rings.some((ring) => ring.callId === action.ring.callId)) return state;
      return { ...state, rings: [...state.rings, action.ring] };

    case 'ring_removed': {
      const wasRinging = state.rings.some((ring) => ring.callId === action.callId);
      if (!wasRinging) return state;
      return {
        ...state,
        rings: state.rings.filter((ring) => ring.callId !== action.callId),
        notice: action.notice ?? state.notice,
      };
    }

    case 'accept_started':
      return { ...state, acceptingCallId: action.callId };

    // The server has taken them off every other ring too (reason 'busy').
    case 'accept_succeeded':
      return {
        ...state,
        acceptingCallId: null,
        rings: [],
        activeCall: {
          callId: action.callId,
          aidTypeNames: action.aidTypeNames,
          audio: 'connecting',
          connectedAt: null,
          muted: false,
        },
        lastEnded: null,
        notice: null,
      };

    case 'accept_failed':
      return {
        ...state,
        acceptingCallId: null,
        rings: state.rings.filter((ring) => ring.callId !== action.callId),
        notice: action.notice,
      };

    case 'audio_state': {
      const call = state.activeCall;
      if (call?.callId !== action.callId) return state;
      return {
        ...state,
        activeCall: {
          ...call,
          audio: action.audio,
          // The timer starts when the two can actually hear each other.
          connectedAt: call.connectedAt ?? (action.audio === 'connected' ? Date.now() : null),
        },
      };
    }

    case 'muted': {
      const call = state.activeCall;
      if (call?.callId !== action.callId) return state;
      return { ...state, activeCall: { ...call, muted: action.muted } };
    }

    case 'call_ended':
      if (state.activeCall?.callId !== action.callId) return state;
      return { ...state, activeCall: null, lastEnded: endedFrom(state.activeCall, action.status) };

    case 'dismiss_ended':
      return { ...state, lastEnded: null };

    case 'dismiss_notice':
      return { ...state, notice: null };
  }
}

interface CallContextValue extends CallState {
  goOnDuty: () => Promise<void>;
  goOffDuty: () => Promise<void>;
  accept: (callId: string) => Promise<void>;
  decline: (callId: string) => void;
  toggleMute: () => void;
  hangUp: () => Promise<void>;
  dismissEnded: () => void;
  dismissNotice: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

/**
 * A staff member's connection to the calling server, for as long as they are
 * signed in to the portal: going on/off duty, incoming rings, and the call
 * they answer, including its audio. Mounted above the routes (CallScope), so
 * moving between pages never drops the connection, the duty status or a call.
 *
 * One socket per tab. The server tracks duty per socket, so after any
 * reconnect (new socket) this re-sends "on duty" if the staff member had
 * asked for it — they don't have to click again after a network blip.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<CallSocket | null>(null);
  // Socket listeners are registered once, so they read the latest intent and
  // state through refs rather than the render they were created in.
  const wantOnDutyRef = useRef(false);
  const stateRef = useRef(state);
  // The audio side of the call in progress: not React state, because they are
  // live browser objects that must be closed, not re-rendered. Signals are
  // routed by this ref's callId, not by state.activeCall: the ref is set the
  // moment the accept succeeds, while state only catches up after a render.
  const audioCallRef = useRef<{ callId: string; call: AudioCall } | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  // The caller sends its offer the moment it hears the call was accepted,
  // which can reach this tab before the server's reply to our accept does.
  // Signals for the call being accepted wait here until the audio call exists.
  const earlySignalsRef = useRef<{ callId: string; signals: Signal[] } | null>(null);

  useEffect(() => {
    stateRef.current = state;
  });

  const setDuty = useCallback(async (socket: CallSocket, onDuty: boolean) => {
    dispatch({ type: 'duty_pending' });
    try {
      const result = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('duty:set', { onDuty });
      if (result.ok) {
        dispatch({ type: 'duty_result', onDuty: result.onDuty });
      } else {
        wantOnDutyRef.current = false;
        dispatch({ type: 'duty_result', onDuty: false, error: result.message });
      }
    } catch {
      wantOnDutyRef.current = false;
      dispatch({ type: 'duty_result', onDuty: false, error: NETWORK_ERROR });
    }
  }, []);

  useEffect(() => {
    let refreshedToken = false;
    let retryTimer: number | undefined;

    const socket: CallSocket = io(BACKEND_URL, {
      transports: ['websocket'],
      // A function, not a value: it runs on every (re)connect, so a reconnect
      // after the session was refreshed sends the new token.
      auth: (send) => {
        void supabase.auth.getSession().then(({ data }) => send({ token: data.session?.access_token ?? '' }));
      },
    });
    socketRef.current = socket;

    socket.on('session:ready', () => {
      refreshedToken = false;
      dispatch({ type: 'connected' });
      if (wantOnDutyRef.current) void setDuty(socket, true);
    });

    socket.on('disconnect', () => dispatch({ type: 'disconnected' }));

    socket.on('connect_error', (err) => {
      dispatch({ type: 'disconnected' });

      if (err.message === 'forbidden') {
        dispatch({ type: 'fatal', message: "This account can't take calls." });
        return;
      }

      // Same rule as apiFetch: a stale token gets one refresh and retry; a
      // second refusal means the session is gone, so sign out.
      if (err.message === 'unauthorized') {
        if (refreshedToken) {
          void supabase.auth.signOut({ scope: 'local' }).then(() => window.location.assign('/login'));
          return;
        }
        refreshedToken = true;
        void supabase.auth.refreshSession().then(() => socket.connect());
        return;
      }

      // A refusal from the server's own checks (auth_unavailable,
      // server_error) is not retried automatically; network errors are.
      if (!socket.active) {
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => socket.connect(), RETRY_DELAY_MS);
      }
    });

    socket.on('call:incoming', ({ callId, aidTypeNames, ringSeconds }) => {
      dispatch({ type: 'ring', ring: { callId, aidTypeNames, expiresAt: Date.now() + ringSeconds * 1000 } });
      notifyIncomingCall(callId, aidTypeNames);
    });

    socket.on('call:ring-stopped', ({ callId, reason }) => {
      dispatch({ type: 'ring_removed', callId, notice: RING_STOP_NOTICES[reason] });
    });

    socket.on('call:signal', ({ callId, signal }) => {
      const audio = audioCallRef.current;
      if (audio && audio.callId === callId) {
        audio.call.handleSignal(signal);
        return;
      }
      const early = earlySignalsRef.current;
      if (early && early.callId === callId) early.signals.push(signal);
    });

    socket.on('call:ended', ({ callId, status }) => {
      dispatch({ type: 'call_ended', callId, status });
    });

    return () => {
      window.clearTimeout(retryTimer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [setDuty]);

  // Ring, notifications and tab title follow the list of ringing calls.
  const ringingIds = state.rings.map((ring) => ring.callId).join(',');
  useEffect(() => {
    const ids = ringingIds ? ringingIds.split(',') : [];
    if (ids.length > 0) startRingtone();
    else stopRingtone();
    closeNotificationsExcept(ids);
    setRingingTitle(ids.length);
  }, [ringingIds]);

  // However a call ends (either side hangs up, the connection drops, the
  // audio fails), the microphone and the connection are released here.
  const activeCallId = state.activeCall?.callId ?? null;
  useEffect(() => {
    if (activeCallId) return;
    audioCallRef.current?.call.close();
    audioCallRef.current = null;
    stopStream(microphoneRef.current);
    microphoneRef.current = null;
  }, [activeCallId]);

  useEffect(
    () => () => {
      stopRingtone();
      closeNotificationsExcept([]);
      setRingingTitle(0);
      audioCallRef.current?.call.close();
      stopStream(microphoneRef.current);
    },
    [],
  );

  // Must start inside the click: sound and the notification prompt are only
  // allowed after a user gesture (see utils/ringtone.ts). The microphone is
  // asked for here too, so its permission prompt never appears while a caller
  // is waiting — and a staff member who can't talk can't go on duty.
  const goOnDuty = useCallback(async () => {
    unlockAudio();
    requestNotificationPermission();

    const socket = socketRef.current;
    if (!socket?.connected) {
      dispatch({ type: 'duty_result', onDuty: false, error: NETWORK_ERROR });
      return;
    }

    dispatch({ type: 'duty_pending' });
    const microphoneError = await checkMicrophone();
    if (microphoneError) {
      dispatch({ type: 'duty_result', onDuty: false, error: microphoneError });
      return;
    }

    wantOnDutyRef.current = true;
    await setDuty(socket, true);
  }, [setDuty]);

  const goOffDuty = useCallback(async () => {
    wantOnDutyRef.current = false;
    dispatch({ type: 'want_duty', value: false });

    const socket = socketRef.current;
    if (socket?.connected) await setDuty(socket, false);
  }, [setDuty]);

  const hangUp = useCallback(async () => {
    const socket = socketRef.current;
    const call = stateRef.current.activeCall;
    if (!socket || !call) return;

    try {
      await socket
        .timeout(ACK_TIMEOUT_MS)
        .emitWithAck('call:hangup', { callId: call.callId, failed: call.audio === 'failed' });
    } catch {
      // No reply: the connection is failing, and the server drops the call
      // when it goes. Either way the call is over for this staff member.
    }
    // Normally call:ended (sent before the reply) has already done this, and
    // the reducer ignores a call that is no longer active.
    dispatch({ type: 'call_ended', callId: call.callId, status: call.audio === 'failed' ? 'dropped' : 'completed' });
  }, []);

  // Audio that can't connect is not a call: end it (recorded as dropped) so
  // the caller can try again, rather than leaving both sides in silence.
  const audioFailed = state.activeCall?.audio === 'failed';
  useEffect(() => {
    if (audioFailed) void hangUp();
  }, [audioFailed, hangUp]);

  const accept = useCallback(async (callId: string) => {
    const socket = socketRef.current;
    const ring = stateRef.current.rings.find((r) => r.callId === callId);
    if (!socket || !ring) return;

    dispatch({ type: 'accept_started', callId });

    // The microphone first: if it can't start, don't take the call — leave it
    // ringing for someone who can talk.
    let microphone: MediaStream;
    try {
      microphone = await openMicrophone();
    } catch (err) {
      dispatch({ type: 'accept_failed', callId, notice: microphoneErrorMessage(err) });
      return;
    }

    earlySignalsRef.current = { callId, signals: [] };
    try {
      const result = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('call:accept', { callId });

      if (!result.ok) {
        stopStream(microphone);
        dispatch({
          type: 'accept_failed',
          callId,
          notice:
            result.error === 'call_unavailable'
              ? 'That call is no longer available. Another responder may have answered it.'
              : result.message,
        });
        return;
      }

      microphoneRef.current = microphone;
      const audioCall = new AudioCall({
        role: 'answerer',
        iceServers: result.iceServers,
        microphone,
        sendSignal: (signal) => socket.emit('call:signal', { callId, signal }, () => undefined),
        onStateChange: (audio) => dispatch({ type: 'audio_state', callId, audio }),
      });
      audioCallRef.current = { callId, call: audioCall };
      dispatch({ type: 'accept_succeeded', callId, aidTypeNames: ring.aidTypeNames });

      for (const signal of earlySignalsRef.current?.signals ?? []) audioCall.handleSignal(signal);
    } catch {
      stopStream(microphone);
      dispatch({ type: 'accept_failed', callId, notice: NETWORK_ERROR });
    } finally {
      earlySignalsRef.current = null;
    }
  }, []);

  // The ring goes away at once; the server's reply doesn't change anything
  // the staff member needs to see.
  const decline = useCallback((callId: string) => {
    dispatch({ type: 'ring_removed', callId });
    socketRef.current?.emit('call:decline', { callId }, () => undefined);
  }, []);

  const toggleMute = useCallback(() => {
    const call = stateRef.current.activeCall;
    const audio = audioCallRef.current;
    if (!call || !audio || audio.callId !== call.callId) return;
    audio.call.setMuted(!call.muted);
    dispatch({ type: 'muted', callId: call.callId, muted: !call.muted });
  }, []);

  const dismissEnded = useCallback(() => dispatch({ type: 'dismiss_ended' }), []);
  const dismissNotice = useCallback(() => dispatch({ type: 'dismiss_notice' }), []);

  const value = useMemo(
    () => ({ ...state, goOnDuty, goOffDuty, accept, decline, toggleMute, hangUp, dismissEnded, dismissNotice }),
    [state, goOnDuty, goOffDuty, accept, decline, toggleMute, hangUp, dismissEnded, dismissNotice],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

/** Staff only — inside <CallScope>. */
export function useCalls(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCalls must be used inside <CallProvider>');
  return context;
}
