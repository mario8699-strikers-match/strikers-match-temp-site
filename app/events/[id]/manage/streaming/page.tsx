'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventManageFrame } from '@/components/EventManageFrame';
import { authService } from '@/services/authService';
import { getBoutsForEvent } from '@/services/boutService';
import { canUseEventFeature } from '@/services/eventStaffService';
import { eventService } from '@/services/eventService';
import type { Bout, Event, Profile } from '@/types';

const CAMERA_SLOTS = [
  'ringWide',
  'ringTight',
  'crowd',
  'walkout',
  'dressingRooms',
  'hallway',
] as const;

const STREAM_DESTINATIONS = ['facebook', 'instagram', 'tiktok', 'youtube', 'customRtmp'] as const;
const STUDIO_DISABLED = true;

type CameraSlot = (typeof CAMERA_SLOTS)[number];

type CameraConnectionStatus = 'notConnected' | 'waiting' | 'connected';

type CameraSlotConfig = {
  status: CameraConnectionStatus;
  operatorName: string;
  accessCode: string;
};

type StreamDestination = (typeof STREAM_DESTINATIONS)[number];

type DestinationConfig = {
  enabled: boolean;
  name: string;
  rtmpUrl: string;
  streamKeyRef: string;
};

function createDefaultDestinations(): Record<StreamDestination, DestinationConfig> {
  return {
    facebook: { enabled: false, name: '', rtmpUrl: '', streamKeyRef: '' },
    instagram: { enabled: false, name: '', rtmpUrl: '', streamKeyRef: '' },
    tiktok: { enabled: false, name: '', rtmpUrl: '', streamKeyRef: '' },
    youtube: { enabled: false, name: '', rtmpUrl: '', streamKeyRef: '' },
    customRtmp: { enabled: false, name: '', rtmpUrl: '', streamKeyRef: '' },
  };
}

function createDefaultCameraSlots(): Record<CameraSlot, CameraSlotConfig> {
  return {
    ringWide: { status: 'notConnected', operatorName: '', accessCode: '' },
    ringTight: { status: 'notConnected', operatorName: '', accessCode: '' },
    crowd: { status: 'notConnected', operatorName: '', accessCode: '' },
    walkout: { status: 'notConnected', operatorName: '', accessCode: '' },
    dressingRooms: { status: 'notConnected', operatorName: '', accessCode: '' },
    hallway: { status: 'notConnected', operatorName: '', accessCode: '' },
  };
}

export default function EventStreamingPage() {
  const { t } = useTranslation('events');
  const { id: eventId } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [event, setEvent] = useState<Event | null>(null);
  const [bouts, setBouts] = useState<Bout[]>([]);
  const [canOperate, setCanOperate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeBoutId, setActiveBoutId] = useState('');
  const [previewSlot, setPreviewSlot] = useState<(typeof CAMERA_SLOTS)[number]>('ringWide');
  const [programSlot, setProgramSlot] = useState<(typeof CAMERA_SLOTS)[number]>('ringWide');
  const [roundNumber, setRoundNumber] = useState('1');
  const [roundSeconds, setRoundSeconds] = useState('180');
  const [remainingSeconds, setRemainingSeconds] = useState(180);
  const [timerRunning, setTimerRunning] = useState(false);
  const [localCameraActive, setLocalCameraActive] = useState(false);
  const [localRecording, setLocalRecording] = useState(false);
  const [localRecordingUrl, setLocalRecordingUrl] = useState<string | null>(null);
  const [localRecordingMimeType, setLocalRecordingMimeType] = useState('');
  const [localError, setLocalError] = useState('');
  const [destinations, setDestinations] = useState<Record<StreamDestination, DestinationConfig>>(createDefaultDestinations);
  const [cameraSlots, setCameraSlots] = useState<Record<CameraSlot, CameraSlotConfig>>(createDefaultCameraSlots);
  const [copiedCameraSlot, setCopiedCameraSlot] = useState<CameraSlot | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([authService.getSession(), eventService.getById(eventId), getBoutsForEvent(eventId)])
      .then(async ([sessionResult, eventResult, boutResult]) => {
        if (!active) return;
        const nextProfile = sessionResult.data?.profile ?? null;
        const nextEvent = eventResult.data ?? null;
        setProfile(nextProfile);
        setEvent(nextEvent);
        setBouts(boutResult.data ?? []);
        setActiveBoutId((current) => current || boutResult.data?.[0]?.id || '');

        const operatorAllowed = await canUseEventFeature(eventId, 'production', nextProfile, nextEvent);
        setCanOperate(operatorAllowed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [eventId]);

  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setTimerRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      for (const track of localStreamRef.current?.getTracks() ?? []) track.stop();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (localRecordingUrl) URL.revokeObjectURL(localRecordingUrl);
    };
  }, [localRecordingUrl]);

  const activeBout = useMemo(
    () => bouts.find((bout) => bout.id === activeBoutId) ?? bouts[0] ?? null,
    [activeBoutId, bouts],
  );

  const enabledDestinationCount = useMemo(
    () => Object.values(destinations).filter((destination) => destination.enabled).length,
    [destinations],
  );

  const connectedCameraCount = useMemo(
    () => Object.values(cameraSlots).filter((slot) => slot.status === 'connected').length,
    [cameraSlots],
  );

  async function startLocalCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setLocalError(t('events.engine.streaming.errors.cameraUnsupported'));
      return;
    }

    setLocalError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment',
        },
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setLocalCameraActive(true);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : t('events.engine.streaming.errors.cameraFailed'));
    }
  }

  function stopLocalCamera() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    for (const track of localStreamRef.current?.getTracks() ?? []) track.stop();
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setLocalCameraActive(false);
    setLocalRecording(false);
  }

  function startLocalRecording() {
    const stream = localStreamRef.current;
    if (!stream) {
      setLocalError(t('events.engine.streaming.errors.startCameraFirst'));
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setLocalError(t('events.engine.streaming.errors.recordingUnsupported'));
      return;
    }

    const mimeType = getSupportedRecordingMimeType();
    recordedChunksRef.current = [];
    if (localRecordingUrl) URL.revokeObjectURL(localRecordingUrl);
    setLocalRecordingUrl(null);
    setLocalRecordingMimeType(mimeType);
    setLocalError('');

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'video/webm' });
      setLocalRecordingUrl(URL.createObjectURL(blob));
      setLocalRecording(false);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setLocalRecording(true);
  }

  function stopLocalRecording() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  }

  function resetTimer() {
    setTimerRunning(false);
    setRemainingSeconds(Number(roundSeconds) || 0);
  }

  function updateRoundDuration(value: string) {
    setRoundSeconds(value);
    if (!timerRunning) setRemainingSeconds(Number(value) || 0);
  }

  function updateDestination(platform: StreamDestination, patch: Partial<DestinationConfig>) {
    setDestinations((current) => ({
      ...current,
      [platform]: {
        ...current[platform],
        ...patch,
      },
    }));
  }

  function updateCameraSlot(slot: CameraSlot, patch: Partial<CameraSlotConfig>) {
    setCameraSlots((current) => ({
      ...current,
      [slot]: {
        ...current[slot],
        ...patch,
      },
    }));
  }

  function generateCameraAccessCode(slot: CameraSlot) {
    const code = `SM-${slot.toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    updateCameraSlot(slot, { accessCode: code, status: 'waiting' });
    return code;
  }

  function getCameraInviteText(slot: CameraSlot, accessCode = cameraSlots[slot].accessCode) {
    const code = accessCode || t('events.engine.streaming.cameras.noCode');
    const eventName = event?.event_name ?? t('events.engine.streaming.eventLabel');
    return t('events.engine.streaming.cameras.inviteText', {
      event: eventName,
      camera: t(`events.engine.streaming.cameraSlots.${slot}`),
      code,
    });
  }

  async function copyCameraInvite(slot: CameraSlot) {
    const code = cameraSlots[slot].accessCode || generateCameraAccessCode(slot);
    const text = getCameraInviteText(slot, code);
    await navigator.clipboard?.writeText(text);
    setCopiedCameraSlot(slot);
    window.setTimeout(() => setCopiedCameraSlot(null), 2000);
  }

  function markLocalCameraAsSlot(slot: CameraSlot) {
    updateCameraSlot(slot, { status: 'connected' });
    setPreviewSlot(slot);
  }

  if (loading || profile === undefined) {
    return <Frame><p className="text-sm text-zinc-500">{t('events.engine.loading.streaming')}</p></Frame>;
  }

  if (!canOperate) {
    return (
      <Frame>
        <h1 className="text-3xl font-black uppercase text-zinc-900">{t('events.engine.streaming.title')}</h1>
        <p className="mt-3 text-sm text-zinc-600">{t('events.engine.permission.production')}</p>
        <Link href={`/events/${eventId}`} className="mt-6 inline-block min-h-11 border border-zinc-300 px-4 py-3 text-sm font-bold text-zinc-800">
          {t('events.engine.nav.backToEvent')}
        </Link>
      </Frame>
    );
  }

  if (STUDIO_DISABLED) {
    return (
      <Frame>
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-400">{t('events.engine.brand')}</p>
            <h1 className="mt-2 text-4xl font-black uppercase text-zinc-400 sm:text-5xl">{t('events.engine.streaming.title')}</h1>
            <p className="mt-2 text-sm text-zinc-500">{event?.event_name}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            <Link href={`/events/${eventId}/manage/settings`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.settings')}</Link>
            <Link href={`/events/${eventId}/manage/matchmaking`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.matchmaking')}</Link>
            <Link href={`/events/${eventId}/manage/bouts`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.bouts')}</Link>
            <Link href={`/events/${eventId}/manage/print`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.print')}</Link>
            <Link href={`/events/${eventId}`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.event')}</Link>
          </div>
        </header>

        <section className="border border-zinc-200 bg-zinc-50 p-5 text-zinc-500 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-400">{t('events.engine.streaming.comingSoon')}</p>
          <h2 className="mt-2 text-3xl font-black uppercase text-zinc-500">{t('events.engine.streaming.disabledTitle')}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">{t('events.engine.streaming.disabledBody')}</p>
        </section>

        <section className="pointer-events-none select-none opacity-40 grayscale">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <DisabledStudioBlock title={t('events.engine.streaming.destinations.title')} body={t('events.engine.streaming.disabledDestinations')} />
            <DisabledStudioBlock title={t('events.engine.streaming.cameras.title')} body={t('events.engine.streaming.disabledCameras')} />
            <DisabledStudioBlock title={t('events.engine.streaming.localCapture')} body={t('events.engine.streaming.disabledLocalCapture')} />
          </div>
          <div className="mt-5 border border-zinc-300 bg-white p-4">
            <div className="aspect-video bg-zinc-900" />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="h-11 border border-zinc-300 bg-zinc-100" />
              <div className="h-11 border border-zinc-300 bg-zinc-100" />
              <div className="h-11 border border-zinc-300 bg-zinc-100" />
            </div>
          </div>
        </section>
      </Frame>
    );
  }

  return (
    <Frame>
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C0001E]">{t('events.engine.brand')}</p>
          <h1 className="mt-2 text-4xl font-black uppercase text-zinc-900 sm:text-5xl">{t('events.engine.streaming.title')}</h1>
          <p className="mt-2 text-sm text-zinc-600">{event?.event_name}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
          <Link href={`/events/${eventId}/manage/settings`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.settings')}</Link>
          <Link href={`/events/${eventId}/manage/matchmaking`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.matchmaking')}</Link>
          <Link href={`/events/${eventId}/manage/bouts`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.bouts')}</Link>
          <Link href={`/events/${eventId}/manage/print`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.print')}</Link>
          <Link href={`/events/${eventId}/manage/live`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.live')}</Link>
          <Link href={`/events/${eventId}`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.event')}</Link>
        </div>
      </header>

      <section className="border border-zinc-200 bg-white p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C0001E]">{t('events.engine.streaming.studioStatus')}</p>
        <h2 className="mt-2 text-2xl font-black uppercase text-zinc-900">{t('events.engine.streaming.enabled')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{t('events.engine.streaming.enabledBody')}</p>
      </section>

      <section className="border border-zinc-200 bg-white p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C0001E]">{t('events.engine.streaming.localModeEyebrow')}</p>
        <h2 className="mt-2 text-2xl font-black uppercase text-zinc-900">{t('events.engine.streaming.localModeTitle')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{t('events.engine.streaming.localModeBody')}</p>
      </section>

      <Panel title={t('events.engine.streaming.destinations.title')}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t('events.engine.streaming.destinations.enabledCount')}</p>
            <p className="mt-2 text-4xl font-black text-zinc-900">{enabledDestinationCount}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{t('events.engine.streaming.destinations.body')}</p>
            <div className="mt-4 border border-zinc-200 bg-white p-3">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-900">{t('events.engine.streaming.destinations.securityTitle')}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600">{t('events.engine.streaming.destinations.securityBody')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {STREAM_DESTINATIONS.map((platform) => {
              const destination = destinations[platform];
              return (
                <div key={platform} className="border border-zinc-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black uppercase tracking-wide text-zinc-900">{t(`events.engine.streaming.destinations.platforms.${platform}`)}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">{t('events.engine.streaming.destinations.pendingServer')}</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-700">
                      <input
                        type="checkbox"
                        checked={destination.enabled}
                        onChange={(changeEvent) => updateDestination(platform, { enabled: changeEvent.target.checked })}
                        className="h-4 w-4 accent-[#C0001E]"
                      />
                      {t('events.engine.streaming.destinations.enabled')}
                    </label>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <label>
                      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.streaming.destinations.name')}</span>
                      <input
                        type="text"
                        value={destination.name}
                        onChange={(changeEvent) => updateDestination(platform, { name: changeEvent.target.value })}
                        placeholder={t('events.engine.streaming.destinations.namePlaceholder')}
                        className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.streaming.destinations.rtmpUrl')}</span>
                      <input
                        type="text"
                        value={destination.rtmpUrl}
                        onChange={(changeEvent) => updateDestination(platform, { rtmpUrl: changeEvent.target.value })}
                        placeholder={t('events.engine.streaming.destinations.rtmpPlaceholder')}
                        className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.streaming.destinations.keyReference')}</span>
                      <input
                        type="text"
                        value={destination.streamKeyRef}
                        onChange={(changeEvent) => updateDestination(platform, { streamKeyRef: changeEvent.target.value })}
                        placeholder={t('events.engine.streaming.destinations.keyReferencePlaceholder')}
                        className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      <Panel title={t('events.engine.streaming.cameras.title')}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t('events.engine.streaming.cameras.connectedCount')}</p>
            <p className="mt-2 text-4xl font-black text-zinc-900">{connectedCameraCount}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{t('events.engine.streaming.cameras.body')}</p>
            <div className="mt-4 border border-zinc-200 bg-white p-3">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-900">{t('events.engine.streaming.cameras.accountRuleTitle')}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600">{t('events.engine.streaming.cameras.accountRuleBody')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {CAMERA_SLOTS.map((slot) => {
              const camera = cameraSlots[slot];
              const displayStatus = slot === programSlot
                ? 'output'
                : slot === previewSlot
                  ? 'preview'
                  : camera.status;

              return (
                <div key={slot} className="border border-zinc-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black uppercase tracking-wide text-zinc-900">{t(`events.engine.streaming.cameraSlots.${slot}`)}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                        {t(`events.engine.streaming.cameras.status.${displayStatus}`)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => markLocalCameraAsSlot(slot)}
                      className="min-h-10 border border-zinc-300 px-3 py-2 text-xs font-black uppercase text-zinc-900"
                    >
                      {t('events.engine.streaming.cameras.useLocal')}
                    </button>
                  </div>

                  <label className="mt-4 block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.streaming.cameras.operator')}</span>
                    <input
                      type="text"
                      value={camera.operatorName}
                      onChange={(changeEvent) => updateCameraSlot(slot, { operatorName: changeEvent.target.value })}
                      placeholder={t('events.engine.streaming.cameras.operatorPlaceholder')}
                      className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
                    />
                  </label>

                  <div className="mt-3 border border-zinc-200 bg-zinc-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t('events.engine.streaming.cameras.accessCode')}</p>
                    <p className="mt-1 break-all text-sm font-bold text-zinc-900">{camera.accessCode || t('events.engine.streaming.cameras.noCode')}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => generateCameraAccessCode(slot)}
                      className="min-h-11 border border-zinc-300 px-3 py-2 text-xs font-black uppercase text-zinc-900"
                    >
                      {t('events.engine.streaming.cameras.createLink')}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyCameraInvite(slot)}
                      className="min-h-11 border border-zinc-300 px-3 py-2 text-xs font-black uppercase text-zinc-900"
                    >
                      {copiedCameraSlot === slot ? t('events.engine.streaming.cameras.copied') : t('events.engine.streaming.cameras.copyInvite')}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCameraSlot(slot, { status: 'connected' })}
                      className="min-h-11 bg-zinc-900 px-3 py-2 text-xs font-black uppercase text-white"
                    >
                      {t('events.engine.streaming.cameras.markConnected')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <div className="border border-zinc-200 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">{t('events.engine.streaming.programMonitor')}</h2>
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">{t(`events.engine.streaming.cameraSlots.${programSlot}`)}</span>
          </div>
          <div className="relative aspect-video overflow-hidden bg-black">
            <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            {!localCameraActive && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                <p className="max-w-md text-sm text-zinc-400">{t('events.engine.streaming.noCameraPreview')}</p>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 border-t border-white/20 bg-black/80 p-3 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-300">{event?.event_name ?? t('events.engine.streaming.eventLabel')}</p>
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <FighterOverlayName name={getBoutFighterName(activeBout, 'a')} />
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{t('events.engine.streaming.round')} {roundNumber}</p>
                  <p className="text-xl font-black tabular-nums">{formatSeconds(remainingSeconds)}</p>
                </div>
                <FighterOverlayName name={getBoutFighterName(activeBout, 'b')} align="right" />
              </div>
            </div>
          </div>
        </div>

        <Panel title={t('events.engine.streaming.localCapture')}>
          <div className="grid grid-cols-2 gap-3">
            <StatusBlock label={t('events.engine.streaming.camera')} value={localCameraActive ? t('events.engine.streaming.active') : t('events.engine.streaming.stopped')} />
            <StatusBlock label={t('events.engine.streaming.recording')} value={localRecording ? t('events.engine.streaming.recordingActive') : t('events.engine.streaming.stopped')} />
          </div>
          {localError && <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{localError}</p>}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={startLocalCamera} disabled={localCameraActive} className="min-h-11 border border-zinc-300 px-3 py-2 text-xs font-black uppercase text-zinc-900 disabled:text-zinc-400">
              {t('events.engine.streaming.startCamera')}
            </button>
            <button type="button" onClick={stopLocalCamera} disabled={!localCameraActive} className="min-h-11 border border-zinc-300 px-3 py-2 text-xs font-black uppercase text-zinc-900 disabled:text-zinc-400">
              {t('events.engine.streaming.stopCamera')}
            </button>
            <button type="button" onClick={startLocalRecording} disabled={!localCameraActive || localRecording} className="min-h-11 bg-zinc-900 px-3 py-2 text-xs font-black uppercase text-white disabled:bg-zinc-200 disabled:text-zinc-400">
              {t('events.engine.streaming.startRecording')}
            </button>
            <button type="button" onClick={stopLocalRecording} disabled={!localRecording} className="min-h-11 border border-zinc-300 px-3 py-2 text-xs font-black uppercase text-zinc-900 disabled:text-zinc-400">
              {t('events.engine.streaming.stopRecording')}
            </button>
          </div>
          {localRecordingUrl ? (
            <a href={localRecordingUrl} download={`strikersmatch-local-recording.${recordingExtension(localRecordingMimeType)}`} className="mt-3 block min-h-11 bg-[#C0001E] px-3 py-3 text-center text-xs font-black uppercase tracking-widest text-white">
              {t('events.engine.streaming.downloadRecording')}
            </a>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">{t('events.engine.streaming.downloadHelp')}</p>
          )}
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title={t('events.engine.streaming.productionControls')}>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.streaming.previewSource')}</span>
            <select value={previewSlot} onChange={(changeEvent) => setPreviewSlot(changeEvent.target.value as (typeof CAMERA_SLOTS)[number])}
              className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900">
              {CAMERA_SLOTS.map((slot) => <option key={slot} value={slot}>{t(`events.engine.streaming.cameraSlots.${slot}`)}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setProgramSlot(previewSlot)} className="mt-3 min-h-12 w-full bg-zinc-900 px-4 py-3 text-sm font-black uppercase tracking-widest text-white">
            {t('events.engine.streaming.take')}
          </button>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatusBlock label={t('events.engine.streaming.preview')} value={t(`events.engine.streaming.cameraSlots.${previewSlot}`)} />
            <StatusBlock label={t('events.engine.streaming.program')} value={t(`events.engine.streaming.cameraSlots.${programSlot}`)} />
          </div>
        </Panel>

        <Panel title={t('events.engine.streaming.roundTimer')}>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.streaming.round')}</span>
              <input type="number" min={1} value={roundNumber} onChange={(changeEvent) => setRoundNumber(changeEvent.target.value)}
                className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.streaming.duration')}</span>
              <input type="number" min={1} value={roundSeconds} onChange={(changeEvent) => updateRoundDuration(changeEvent.target.value)}
                className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900" />
            </label>
          </div>
          <p className="mt-4 text-5xl font-black tabular-nums text-zinc-900">{formatSeconds(remainingSeconds)}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setTimerRunning(true)} className="min-h-11 border border-zinc-300 px-3 py-2 text-xs font-black uppercase text-zinc-900">{t('events.engine.streaming.start')}</button>
            <button type="button" onClick={() => setTimerRunning(false)} className="min-h-11 border border-zinc-300 px-3 py-2 text-xs font-black uppercase text-zinc-900">{t('events.engine.streaming.pause')}</button>
            <button type="button" onClick={resetTimer} className="min-h-11 border border-zinc-300 px-3 py-2 text-xs font-black uppercase text-zinc-900">{t('events.engine.streaming.reset')}</button>
          </div>
        </Panel>

        <Panel title={t('events.engine.streaming.serverOutput')}>
          <p className="text-sm leading-relaxed text-zinc-600">{t('events.engine.streaming.serverOutputBody')}</p>
          <div className="mt-4 border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-zinc-900">{t('events.engine.streaming.deferredTitle')}</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-600">
              <li>{t('events.engine.streaming.deferred.remoteCameras')}</li>
              <li>{t('events.engine.streaming.deferred.publicLive')}</li>
              <li>{t('events.engine.streaming.deferred.rtmp')}</li>
              <li>{t('events.engine.streaming.deferred.serverProgram')}</li>
              <li>{t('events.engine.streaming.deferred.serverRecording')}</li>
            </ul>
          </div>
          <button type="button" disabled className="mt-4 min-h-11 w-full border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-widest text-zinc-400">
            {t('events.engine.streaming.goLiveDisabled')}
          </button>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title={t('events.engine.streaming.fightCard')}>
          {bouts.length === 0 ? (
            <p className="text-sm text-zinc-500">{t('events.engine.streaming.noBouts')}</p>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.streaming.activeBout')}</span>
                <select value={activeBoutId} onChange={(changeEvent) => setActiveBoutId(changeEvent.target.value)}
                  className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900">
                  {bouts.map((bout) => (
                    <option key={bout.id} value={bout.id}>
                      {bout.bout_number ?? t('events.engine.streaming.unordered')} · {getBoutFighterName(bout, 'a')} {t('events.engine.streaming.versus')} {getBoutFighterName(bout, 'b')}
                    </option>
                  ))}
                </select>
              </label>
              <div className="divide-y divide-zinc-200 border border-zinc-200">
                {bouts.map((bout) => (
                  <button key={bout.id} type="button" onClick={() => setActiveBoutId(bout.id)}
                    className={`block w-full p-3 text-left transition-colors ${activeBoutId === bout.id ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900 hover:bg-zinc-50'}`}>
                    <p className="text-xs font-black uppercase tracking-wide opacity-70">{t('events.engine.streaming.bout')} {bout.bout_number ?? '—'} · {bout.weight_class ?? t('events.engine.streaming.openWeight')}</p>
                    <p className="mt-1 text-sm font-bold">{getBoutFighterName(bout, 'a')} {t('events.engine.streaming.versus')} {getBoutFighterName(bout, 'b')}</p>
                    <p className="mt-1 text-xs opacity-70">{bout.discipline ?? '—'} · {t(`events.engine.status.${bout.status}`)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel title={t('events.engine.streaming.graphicsPreview')}>
          <div className="border border-zinc-200 p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#C0001E]">{event?.event_name ?? t('events.engine.streaming.eventLabel')}</p>
            <h3 className="mt-3 text-3xl font-black uppercase text-zinc-900">{getBoutFighterName(activeBout, 'a')}</h3>
            <p className="my-2 text-sm font-black uppercase tracking-widest text-zinc-500">{t('events.engine.streaming.versus')}</p>
            <h3 className="text-3xl font-black uppercase text-zinc-900">{getBoutFighterName(activeBout, 'b')}</h3>
            <p className="mt-4 text-sm text-zinc-600">{activeBout?.weight_class ?? t('events.engine.streaming.openWeight')} · {activeBout?.discipline ?? t('events.engine.streaming.noDiscipline')}</p>
          </div>
          <p className="mt-3 text-xs text-zinc-500">{t('events.engine.streaming.graphicsHelp')}</p>
        </Panel>
      </section>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <EventManageFrame>{children}</EventManageFrame>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-zinc-200 bg-white p-4 sm:p-5">
      <h2 className="border-b border-zinc-200 pb-3 text-sm font-black uppercase tracking-widest text-zinc-900">{title}</h2>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function DisabledStudioBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-zinc-300 bg-white p-4">
      <h2 className="border-b border-zinc-200 pb-3 text-sm font-black uppercase tracking-widest text-zinc-500">{title}</h2>
      <p className="pt-4 text-sm leading-relaxed text-zinc-500">{body}</p>
    </div>
  );
}

function StatusBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-zinc-900">{value}</p>
    </div>
  );
}

function FighterOverlayName({ name, align = 'left' }: { name: string; align?: 'left' | 'right' }) {
  return <p className={`truncate text-lg font-black uppercase sm:text-2xl ${align === 'right' ? 'text-right' : ''}`}>{name}</p>;
}

function getBoutFighterName(bout: Bout | null, side: 'a' | 'b') {
  if (!bout) return '—';
  if (side === 'a') return bout.fighter_a?.profiles?.full_name ?? bout.fighter_a_snapshot?.name ?? '—';
  return bout.fighter_b?.profiles?.full_name ?? bout.fighter_b_snapshot?.name ?? '—';
}

function formatSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';

  const supportedTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];

  return supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function recordingExtension(mimeType: string) {
  return mimeType.includes('mp4') ? 'mp4' : 'webm';
}
