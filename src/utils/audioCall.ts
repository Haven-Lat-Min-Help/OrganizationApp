import type { AudioState, IceServer, Signal } from '../types/call';

// A connection that hasn't come up in this long isn't going to. The usual
// cause is two networks that can only reach each other through a TURN relay.
const CONNECT_TIMEOUT_MS = 20_000;

type AudioCallOptions = {
  /** The caller makes the offer, staff answer — the server enforces this. */
  role: 'offerer' | 'answerer';
  iceServers: IceServer[];
  microphone: MediaStream;
  /** Sends one signal to the other side through the server (call:signal). */
  sendSignal: (signal: Signal) => void;
  onStateChange: (state: AudioState) => void;
  /**
   * Testing only: use nothing but TURN relay candidates, so a call that
   * connects proves the relay works (two tabs on one machine would otherwise
   * connect directly and never touch it).
   */
  relayOnly?: boolean;
};

/**
 * One audio-only WebRTC call between the browser and the other person.
 *
 *  1. The offerer describes what it can send (offer); the answerer replies
 *     (answer). Both go through our server as call:signal.
 *  2. Meanwhile each side discovers addresses it might be reached at
 *     (candidates — local network, public address via STUN, relay via TURN)
 *     and sends them over as they are found ("trickle ICE").
 *  3. The browser tries candidate pairs until one works: 'connected'. From
 *     then on the audio goes straight between the two people (or through
 *     TURN), never through our server.
 *
 * Signals are applied one at a time, in arrival order: a candidate that
 * arrives while the offer is still being applied waits for it, instead of
 * being added before the browser knows what it belongs to.
 */
export class AudioCall {
  private readonly pc: RTCPeerConnection;
  private readonly options: AudioCallOptions;
  private readonly remoteAudio = new Audio();
  private queue: Promise<void> = Promise.resolve();
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private state: AudioState = 'connecting';
  private connectTimer: number;
  private closed = false;

  constructor(options: AudioCallOptions) {
    this.options = options;
    this.pc = new RTCPeerConnection({
      iceServers: options.iceServers,
      iceTransportPolicy: options.relayOnly ? 'relay' : 'all',
    });

    for (const track of options.microphone.getAudioTracks()) {
      this.pc.addTrack(track, options.microphone);
    }

    this.pc.onicecandidate = (event) => {
      // A null candidate only means "gathering finished"; nothing to send.
      if (!event.candidate) return;
      options.sendSignal({
        type: 'candidate',
        candidate: {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        },
      });
    };

    this.pc.ontrack = (event) => {
      this.remoteAudio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      // Allowed without a new click: the user already interacted with the
      // page (Accept, or Call on the dev page).
      void this.remoteAudio.play().catch(() => undefined);
    };

    this.pc.onconnectionstatechange = () => this.onConnectionStateChange();

    this.connectTimer = window.setTimeout(() => {
      if (this.state === 'connecting') this.setState('failed');
    }, CONNECT_TIMEOUT_MS);
  }

  /** Offerer only: starts the call once the other side has answered it. */
  start() {
    this.enqueue(async () => {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.options.sendSignal({ type: 'offer', sdp: offer.sdp ?? '' });
    });
  }

  handleSignal(signal: Signal) {
    this.enqueue(async () => {
      if (signal.type === 'offer' && this.options.role === 'answerer') {
        await this.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        await this.addPendingCandidates();
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.options.sendSignal({ type: 'answer', sdp: answer.sdp ?? '' });
      } else if (signal.type === 'answer' && this.options.role === 'offerer') {
        await this.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        await this.addPendingCandidates();
      } else if (signal.type === 'candidate') {
        // A candidate can't be added before the description it belongs to.
        if (this.pc.remoteDescription) {
          await this.pc.addIceCandidate(signal.candidate);
        } else {
          this.pendingCandidates.push(signal.candidate);
        }
      }
    });
  }

  setMuted(muted: boolean) {
    for (const track of this.options.microphone.getAudioTracks()) {
      track.enabled = !muted;
    }
  }

  /** Ends the connection. The microphone belongs to the caller of this class, which stops it. */
  close() {
    if (this.closed) return;
    this.closed = true;
    window.clearTimeout(this.connectTimer);
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.onconnectionstatechange = null;
    this.pc.close();
    this.remoteAudio.pause();
    this.remoteAudio.srcObject = null;
  }

  private enqueue(task: () => Promise<void>) {
    this.queue = this.queue
      .then(() => (this.closed ? undefined : task()))
      .catch((err) => {
        // A signal the browser rejects leaves the connection unusable.
        console.error('audio call: signalling step failed:', err);
        this.setState('failed');
      });
  }

  private async addPendingCandidates() {
    const candidates = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of candidates) {
      await this.pc.addIceCandidate(candidate);
    }
  }

  private onConnectionStateChange() {
    switch (this.pc.connectionState) {
      case 'connected':
        window.clearTimeout(this.connectTimer);
        this.setState('connected');
        break;
      // A network blip: the browser keeps trying and often recovers on its
      // own; if it can't, it moves on to 'failed'.
      case 'disconnected':
        if (this.state === 'connected') this.setState('reconnecting');
        break;
      case 'failed':
        this.setState('failed');
        break;
    }
  }

  private setState(state: AudioState) {
    if (this.closed || this.state === state || this.state === 'failed') return;
    this.state = state;
    this.options.onStateChange(state);
  }
}
