import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { warehouseSupabase } from '@/lib/warehouseSupabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { startIncomingRingtone, startOutgoingRingback, stopRingtone } from '@/utils/ringtone';
import { toast } from 'sonner';

export interface IntercomUser {
  id: string;
  name: string;
  email?: string;
  app: 'ak-warehouse' | 'akws' | 'ak-retail-pos';
  locationName?: string;
  status: 'online' | 'in_call';
  joinedAt: string;
}

export type CallStatus = 'idle' | 'outgoing_ringing' | 'incoming_ringing' | 'connected';

export interface ActiveCall {
  callId: string;
  peerId: string;
  peerName: string;
  peerApp: 'ak-warehouse' | 'akws' | 'ak-retail-pos';
  isCaller: boolean;
}

export type MicPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown';

interface IntercomContextType {
  myClientId: string;
  displayName: string;
  onlineUsers: IntercomUser[];
  callStatus: CallStatus;
  activeCall: ActiveCall | null;
  isMuted: boolean;
  callDuration: number;
  micPermissionState: MicPermissionState;
  requestMicPermission: () => Promise<boolean>;
  initiateCall: (targetUser: IntercomUser) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
}

const APP_NAME: 'ak-retail-pos' = 'ak-retail-pos';
const LOCATION_NAME = 'Retail Shop # 1';
const CHANNEL_NAME = 'ak-intercom-global-v1';

const IntercomContext = createContext<IntercomContextType | null>(null);

export function IntercomProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  
  const [myClientId] = useState<string>(() => {
    let existing = sessionStorage.getItem('ak_intercom_client_id');
    if (!existing) {
      existing = `pos_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      sessionStorage.setItem('ak_intercom_client_id', existing);
    }
    return existing;
  });

  const displayName = user?.user_metadata?.full_name 
    ? user.user_metadata.full_name.toUpperCase()
    : (user?.email ? user.email.split('@')[0].toUpperCase() : 'RETAIL SHOP # 1');

  const [onlineUsers, setOnlineUsers] = useState<IntercomUser[]>([]);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [micPermissionState, setMicPermissionState] = useState<MicPermissionState>('unknown');

  const checkMicPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as any });
        setMicPermissionState(result.state as MicPermissionState);
        result.onchange = () => {
          setMicPermissionState(result.state as MicPermissionState);
        };
      } catch {
        setMicPermissionState('unknown');
      }
    }
  }, []);

  useEffect(() => {
    checkMicPermission();
  }, [checkMicPermission]);

  const requestMicPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      stream.getTracks().forEach(track => track.stop());
      setMicPermissionState('granted');
      toast.success('Microphone access granted!');
      return true;
    } catch (err: any) {
      setMicPermissionState('denied');
      toast.error(`Microphone permission denied: ${err.message}`);
      return false;
    }
  }, []);

  const callStatusRef = useRef<CallStatus>(callStatus);
  callStatusRef.current = callStatus;

  const activeCallRef = useRef<ActiveCall | null>(activeCall);
  activeCallRef.current = activeCall;

  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;

  const userEmailRef = useRef(user?.email || '');
  userEmailRef.current = user?.email || '';

  const channelRef = useRef<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    if (!remoteAudioRef.current) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      audio.volume = 1.0;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      remoteAudioRef.current = audio;
    }
    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.remove();
        remoteAudioRef.current = null;
      }
    };
  }, []);

  const processPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    while (pendingCandidatesRef.current.length > 0) {
      const candidate = pendingCandidatesRef.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Buffered ICE candidate add failed:', err);
        }
      }
    }
  }, []);

  const cleanupMediaAndPC = useCallback(() => {
    stopRingtone();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setCallDuration(0);
    pendingCandidatesRef.current = [];

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const resetCallState = useCallback(() => {
    cleanupMediaAndPC();
    setCallStatus('idle');
    setActiveCall(null);
    setIsMuted(false);
  }, [cleanupMediaAndPC]);

  const resetCallStateRef = useRef(resetCallState);
  resetCallStateRef.current = resetCallState;

  const getMicrophoneStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      setMicPermissionState('granted');
      return stream;
    } catch (err: any) {
      setMicPermissionState('denied');
      throw err;
    }
  }, []);

  const getMicrophoneStreamRef = useRef(getMicrophoneStream);
  getMicrophoneStreamRef.current = getMicrophoneStream;

  const createPeerConnection = useCallback((peerId: string, callId: string) => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'webrtc-candidate',
          payload: {
            callId,
            targetUserId: peerId,
            candidate: event.candidate,
          },
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(err => console.warn('Audio play error:', err));
      }
    };

    pcRef.current = pc;
    return pc;
  }, []);

  const createPeerConnectionRef = useRef(createPeerConnection);
  createPeerConnectionRef.current = createPeerConnection;

  const processPendingCandidatesRef = useRef(processPendingCandidates);
  processPendingCandidatesRef.current = processPendingCandidates;

  // Supabase Realtime Channel setup - Run when user is authenticated
  useEffect(() => {
    const db = warehouseSupabase || supabase;

    if (!user || !isAdmin) {
      if (channelRef.current) {
        db.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setOnlineUsers([]);
      return;
    }

    const channel = db.channel(CHANNEL_NAME, {
      config: {
        presence: {
          key: myClientId,
        },
      },
    });

    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users: IntercomUser[] = [];
      
      Object.keys(state).forEach(key => {
        const presences = state[key] as any[];
        if (presences && presences.length > 0) {
          const p = presences[presences.length - 1];
          if (p.id !== myClientId) {
            users.push({
              id: p.id,
              name: p.name,
              email: p.email,
              app: p.app,
              locationName: p.locationName || (p.app === 'akws' ? 'Retail Shop # 1' : 'Central Warehouse'),
              status: p.status || 'online',
              joinedAt: p.joinedAt,
            });
          }
        }
      });
      setOnlineUsers(users);
    });

    channel.on('broadcast', { event: 'call-invite' }, payload => {
      const { callId, callerId, callerName, callerApp, targetUserId } = payload.payload;
      if (targetUserId === myClientId) {
        if (callStatusRef.current === 'idle') {
          setCallStatus('incoming_ringing');
          setActiveCall({
            callId,
            peerId: callerId,
            peerName: callerName,
            peerApp: callerApp,
            isCaller: false,
          });
          startIncomingRingtone();
        } else {
          channel.send({
            type: 'broadcast',
            event: 'call-decline',
            payload: { callId, targetUserId: callerId, reason: 'busy' },
          });
        }
      }
    });

    channel.on('broadcast', { event: 'call-accept' }, async payload => {
      const { callId, targetUserId, responderId, responderName } = payload.payload;
      if (targetUserId === myClientId) {
        stopRingtone();
        setCallStatus('connected');
        toast.success(`Call connected with ${responderName}!`);

        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);

        try {
          const stream = await getMicrophoneStreamRef.current();
          const pc = createPeerConnectionRef.current(responderId, callId);
          stream.getTracks().forEach(track => pc.addTrack(track, stream));

          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
          });
          await pc.setLocalDescription(offer);

          channel.send({
            type: 'broadcast',
            event: 'webrtc-offer',
            payload: {
              callId,
              targetUserId: responderId,
              sdp: offer,
            },
          });
        } catch (err: any) {
          toast.error(`Microphone access error: ${err.message}`);
          resetCallStateRef.current();
        }
      }
    });

    channel.on('broadcast', { event: 'webrtc-offer' }, async payload => {
      const { callId, targetUserId, sdp } = payload.payload;
      if (targetUserId === myClientId && activeCallRef.current) {
        try {
          const stream = await getMicrophoneStreamRef.current();
          const pc = createPeerConnectionRef.current(activeCallRef.current.peerId, callId);
          stream.getTracks().forEach(track => pc.addTrack(track, stream));

          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await processPendingCandidatesRef.current(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          channel.send({
            type: 'broadcast',
            event: 'webrtc-answer',
            payload: {
              callId,
              targetUserId: activeCallRef.current.peerId,
              sdp: answer,
            },
          });
        } catch (err: any) {
          toast.error(`WebRTC offer handling failed: ${err.message}`);
          resetCallStateRef.current();
        }
      }
    });

    channel.on('broadcast', { event: 'webrtc-answer' }, async payload => {
      const { targetUserId, sdp } = payload.payload;
      if (targetUserId === myClientId && pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
          await processPendingCandidatesRef.current(pcRef.current);
        } catch (err) {
          console.warn('Set remote answer error:', err);
        }
      }
    });

    channel.on('broadcast', { event: 'webrtc-candidate' }, async payload => {
      const { targetUserId, candidate } = payload.payload;
      if (targetUserId === myClientId) {
        if (pcRef.current && pcRef.current.remoteDescription) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn('Add ICE candidate error:', err);
          }
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      }
    });

    channel.on('broadcast', { event: 'call-decline' }, payload => {
      const { targetUserId, reason } = payload.payload;
      if (targetUserId === myClientId) {
        stopRingtone();
        toast.info(reason === 'busy' ? 'User is currently on another call.' : 'Call declined');
        resetCallStateRef.current();
      }
    });

    channel.on('broadcast', { event: 'call-ended' }, payload => {
      const { targetUserId } = payload.payload;
      if (targetUserId === myClientId) {
        stopRingtone();
        toast.info('Call ended');
        resetCallStateRef.current();
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          id: myClientId,
          name: displayNameRef.current,
          email: userEmailRef.current,
          app: APP_NAME,
          locationName: LOCATION_NAME,
          status: 'online',
          joinedAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      if (channelRef.current) {
        db.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [myClientId, user, isAdmin]);

  const initiateCall = useCallback(async (targetUser: IntercomUser) => {
    if (callStatusRef.current !== 'idle') return;

    try {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }
      await getMicrophoneStream();
    } catch (err: any) {
      toast.error(`Microphone access required: ${err.message}`);
      return;
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newActiveCall: ActiveCall = {
      callId,
      peerId: targetUser.id,
      peerName: targetUser.name,
      peerApp: targetUser.app,
      isCaller: true,
    };
    setActiveCall(newActiveCall);
    setCallStatus('outgoing_ringing');
    startOutgoingRingback();

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-invite',
        payload: {
          callId,
          callerId: myClientId,
          callerName: displayName,
          callerApp: APP_NAME,
          targetUserId: targetUser.id,
        },
      });
    }
  }, [myClientId, displayName, getMicrophoneStream]);

  const acceptCall = useCallback(async () => {
    const currentActiveCall = activeCallRef.current;
    if (callStatusRef.current !== 'incoming_ringing' || !currentActiveCall) return;

    try {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }
      await getMicrophoneStream();
    } catch (err: any) {
      toast.error(`Microphone access required: ${err.message}`);
      return;
    }

    stopRingtone();
    setCallStatus('connected');
    toast.success(`Connected with ${currentActiveCall.peerName}`);

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-accept',
        payload: {
          callId: currentActiveCall.callId,
          targetUserId: currentActiveCall.peerId,
          responderId: myClientId,
          responderName: displayName,
          responderApp: APP_NAME,
        },
      });
    }
  }, [myClientId, displayName, getMicrophoneStream]);

  const declineCall = useCallback(() => {
    const currentActiveCall = activeCallRef.current;
    if (!currentActiveCall) return;

    stopRingtone();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-decline',
        payload: {
          callId: currentActiveCall.callId,
          targetUserId: currentActiveCall.peerId,
          reason: 'rejected',
        },
      });
    }
    resetCallState();
  }, [resetCallState]);

  const endCall = useCallback(() => {
    const currentActiveCall = activeCallRef.current;
    if (!currentActiveCall) return;

    stopRingtone();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-ended',
        payload: {
          callId: currentActiveCall.callId,
          targetUserId: currentActiveCall.peerId,
        },
      });
    }
    resetCallState();
  }, [resetCallState]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        setIsMuted(!audioTracks[0].enabled);
      }
    }
  }, []);

  return (
    <IntercomContext.Provider
      value={{
        myClientId,
        displayName,
        onlineUsers,
        callStatus,
        activeCall,
        isMuted,
        callDuration,
        micPermissionState,
        requestMicPermission,
        initiateCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
      }}
    >
      {children}
    </IntercomContext.Provider>
  );
}

export function useIntercomCall() {
  const context = useContext(IntercomContext);
  if (!context) {
    throw new Error('useIntercomCall must be used within an IntercomProvider');
  }
  return context;
}
