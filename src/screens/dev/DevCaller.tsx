import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { BACKEND_URL } from '../../config/api';
import { useAidTypes } from '../../hooks/useAidTypes';
import type { AudioState, EndStatus, IceServer, Signal } from '../../types/call';
import { AudioCall } from '../../utils/audioCall';
import { microphoneErrorMessage, openMicrophone, stopStream } from '../../utils/microphone';
import styles from './DevCaller.module.css';

/*
 * DEV ONLY (routed only when import.meta.env.DEV — see App.tsx): a stand-in
 * for the mobile app's caller side, so staff audio can be tested end to end
 * before the app can call. Does what the app will do: signs in as a guest,
 * starts a call, and makes the WebRTC offer once a staff member accepts.
 *
 * Its own Supabase client, kept in memory only: signing in as a guest here
 * must not replace the staff session this browser keeps in localStorage.
 * Every page load is therefore a new guest — a fresh rate-limit allowance.
 */
const guestSupabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'haven-dev-caller' },
});

type Phase = 'idle' | 'starting' | 'ringing' | 'in_call';

const ENDED: Record<EndStatus, string> = {
  completed: 'The call ended.',
  dropped: 'The call dropped.',
  cancelled: 'You cancelled the call.',
  missed: 'Nobody answered. In the app this is where Call again / AI / 112 appear.',
};

export default function DevCaller() {
  const { aidTypes, error: aidTypesError } = useAidTypes();
  const [aidTypeId, setAidTypeId] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [audio, setAudio] = useState<AudioState | null>(null);
  const [muted, setMuted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [relayOnly, setRelayOnly] = useState(false);
  const [turnOffered, setTurnOffered] = useState<boolean | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const audioCallRef = useRef<AudioCall | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);

  const cleanUp = useCallback(() => {
    audioCallRef.current?.close();
    audioCallRef.current = null;
    stopStream(microphoneRef.current);
    microphoneRef.current = null;
    // Clear the ref before disconnecting: disconnect() fires the socket's own
    // 'disconnect' handler synchronously, which must see it as already handled.
    const socket = socketRef.current;
    socketRef.current = null;
    socket?.disconnect();
    callIdRef.current = null;
    setPhase('idle');
    setAudio(null);
    setMuted(false);
  }, []);

  useEffect(() => cleanUp, [cleanUp]);

  const hangUp = useCallback(async () => {
    const socket = socketRef.current;
    const callId = callIdRef.current;
    if (socket && callId) {
      await socket
        .timeout(5000)
        .emitWithAck('call:hangup', { callId, failed: audio === 'failed' })
        .catch(() => undefined);
    }
    cleanUp();
  }, [audio, cleanUp]);

  // Same rule as the staff side: audio that can't connect ends the call.
  useEffect(() => {
    if (audio === 'failed') {
      setMessage('The audio couldn’t connect (the two networks may need a TURN server).');
      void hangUp();
    }
  }, [audio, hangUp]);

  async function startCall() {
    if (!aidTypeId) return;
    setMessage(null);
    setPhase('starting');

    try {
      microphoneRef.current = await openMicrophone();
    } catch (err) {
      setMessage(microphoneErrorMessage(err));
      cleanUp();
      return;
    }

    let token = (await guestSupabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      const { data, error } = await guestSupabase.auth.signInAnonymously();
      if (error || !data.session) {
        setMessage(`Guest sign-in failed: ${error?.message ?? 'no session'}`);
        cleanUp();
        return;
      }
      token = data.session.access_token;
    }

    const socket = io(BACKEND_URL, { auth: { token }, transports: ['websocket'], reconnection: false });
    socketRef.current = socket;

    socket.on('connect_error', (err: Error) => {
      setMessage(`Could not connect: ${err.message}`);
      cleanUp();
    });

    socket.on('disconnect', () => {
      if (socketRef.current === socket) {
        setMessage((current) => current ?? 'Disconnected from the server.');
        cleanUp();
      }
    });

    socket.on('session:ready', async () => {
      let result;
      try {
        result = await socket.timeout(5000).emitWithAck('call:start', { aidTypeIds: [aidTypeId] });
      } catch {
        setMessage('The server did not answer. Is the backend running?');
        cleanUp();
        return;
      }
      if (!result.ok) {
        setMessage(result.message);
        cleanUp();
      } else if (result.status === 'no_staff') {
        setMessage('No responder is on duty for this aid type right now.');
        cleanUp();
      } else {
        callIdRef.current = result.callId;
        setPhase('ringing');
      }
    });

    socket.on('call:accepted', ({ iceServers }: { iceServers: IceServer[] }) => {
      const callId = callIdRef.current;
      const microphone = microphoneRef.current;
      if (!callId || !microphone) return;

      setTurnOffered(iceServers.some((server) => server.urls.some((url) => url.startsWith('turn'))));
      const audioCall = new AudioCall({
        role: 'offerer',
        iceServers,
        microphone,
        sendSignal: (signal) => socket.emit('call:signal', { callId, signal }, () => undefined),
        onStateChange: setAudio,
        relayOnly,
      });
      audioCallRef.current = audioCall;
      setAudio('connecting');
      setPhase('in_call');
      audioCall.start();
    });

    socket.on('call:signal', ({ signal }: { signal: Signal }) => {
      audioCallRef.current?.handleSignal(signal);
    });

    socket.on('call:ended', ({ status }: { status: EndStatus }) => {
      setMessage((current) => current ?? ENDED[status]);
      cleanUp();
    });
  }

  function toggleMute() {
    audioCallRef.current?.setMuted(!muted);
    setMuted(!muted);
  }

  return (
    <main className={styles.page}>
      <Card title="Dev caller (testing only)">
        <p className={styles.text}>
          Rings on-duty staff like the mobile app will. Use it in a different browser (or a private window) from the
          staff portal, and wear headphones so the two tabs don’t echo.
        </p>

        <label className={styles.label} htmlFor="dev-aid-type">
          Aid type
        </label>
        <select
          id="dev-aid-type"
          className={styles.select}
          value={aidTypeId}
          onChange={(event) => setAidTypeId(event.target.value)}
          disabled={phase !== 'idle'}
        >
          <option value="">Choose…</option>
          {aidTypes.map((aidType) => (
            <option key={aidType.id} value={aidType.id}>
              {aidType.name}
            </option>
          ))}
        </select>
        {aidTypesError && <p className={styles.message}>{aidTypesError}</p>}

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={relayOnly}
            onChange={(event) => setRelayOnly(event.target.checked)}
            disabled={phase !== 'idle'}
          />
          Force TURN relay (audio only connects through TURN, proving it works)
        </label>
        {turnOffered !== null && (
          <p className={styles.message}>
            {turnOffered ? 'The server sent TURN servers for this call.' : 'The server sent no TURN server (STUN only).'}
          </p>
        )}

        <p className={styles.status} role="status">
          {phase === 'idle' && 'Not in a call.'}
          {phase === 'starting' && 'Starting…'}
          {phase === 'ringing' && 'Ringing responders…'}
          {phase === 'in_call' &&
            (audio === 'connected' ? (muted ? 'Connected · muted' : 'Connected') : `Audio: ${audio ?? 'connecting'}`)}
        </p>
        {message && <p className={styles.message}>{message}</p>}

        <div className={styles.actions}>
          {phase === 'idle' ? (
            <Button onClick={() => void startCall()} disabled={!aidTypeId}>
              Call a responder
            </Button>
          ) : (
            <>
              {phase === 'in_call' && (
                <Button variant="secondary" onClick={toggleMute} aria-pressed={muted}>
                  {muted ? 'Unmute' : 'Mute'}
                </Button>
              )}
              <Button variant="dark" onClick={() => void hangUp()} disabled={phase === 'starting'}>
                {phase === 'ringing' ? 'Cancel' : 'Hang up'}
              </Button>
            </>
          )}
        </div>
      </Card>
    </main>
  );
}
