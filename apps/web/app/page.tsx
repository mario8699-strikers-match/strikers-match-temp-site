"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_STUDIO_API_URL ?? "http://localhost:3001";

type StudioEvent = {
  id: string;
  name: string;
  venue_name: string | null;
  starts_at: string | null;
  status: string;
};

type FightCardBout = {
  id: string;
  red_fighter_name: string;
  blue_fighter_name: string;
  weight_class: string | null;
  scheduled_rounds: number;
  round_duration_seconds: number;
  sort_order: number;
};

type FightCard = {
  id: string;
  name: string;
  bouts: FightCardBout[];
};

type CameraSource = {
  id: string;
  role_name: string;
  source_index: number;
  ingest_url: string | null;
  status: string;
  device_label: string | null;
};

type ProductionSession = {
  id: string;
  event_id: string;
  status: string;
  preview_camera_source_id: string | null;
  program_camera_source_id: string | null;
  active_bout_id: string | null;
  went_live_at: string | null;
  ended_at: string | null;
};

type RoundTimer = {
  id: string;
  current_round: number;
  duration_seconds: number;
  remaining_seconds: number;
  status: string;
};

type Recording = {
  id: string;
  status: string;
  format: "MP4";
  storage_bucket: string | null;
  storage_key: string | null;
};

type DestinationProfileSummary = {
  id: string;
  event_destination_profile_id: string;
  name: string;
  platform: string;
  status: string;
  is_enabled: boolean;
};

type DestinationProfile = {
  id: string;
  name: string;
  platform: string;
  rtmp_url: string;
  stream_key_secret_ref: string;
  status: string;
};

type GraphicsCue = {
  id: string;
  event_id: string;
  cue_type: string;
  name: string;
  payload: Record<string, unknown>;
  is_active: boolean;
};

type StudioState = {
  event: StudioEvent;
  fightCards: FightCard[];
  cameraSources: CameraSource[];
  productionSession: ProductionSession | null;
  roundTimer: RoundTimer | null;
  recording: Recording | null;
  destinationProfiles: DestinationProfileSummary[];
  graphicsCues: GraphicsCue[];
};

export default function Home() {
  const [events, setEvents] = useState<StudioEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [studioState, setStudioState] = useState<StudioState | null>(null);
  const [destinationProfiles, setDestinationProfiles] = useState<DestinationProfile[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingState, setLoadingState] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const [localCameraActive, setLocalCameraActive] = useState(false);
  const [localRecording, setLocalRecording] = useState(false);
  const [localRecordingUrl, setLocalRecordingUrl] = useState<string | null>(null);
  const [localRecordingMimeType, setLocalRecordingMimeType] = useState<string>("");
  const [newDestination, setNewDestination] = useState({
    name: "",
    platform: "YouTube",
    rtmpUrl: "",
    streamKeySecretRef: "",
  });
  const [newGraphicsCue, setNewGraphicsCue] = useState({
    name: "",
    cueType: "Event Branding",
    payloadText: "{\n  \"title\": \"\"\n}",
  });
  const [roundConfig, setRoundConfig] = useState({
    currentRound: "1",
    durationSeconds: "180",
  });

  useEffect(() => {
    let active = true;

    async function loadEvents() {
      setLoadingEvents(true);
      setError(null);

      try {
        const result = await request<StudioEvent[]>("/events");
        const profiles = await request<DestinationProfile[]>("/destination-profiles");
        if (!active) return;
        setEvents(result);
        setDestinationProfiles(profiles);
        setSelectedEventId((current) => current || result[0]?.id || "");
      } catch (requestError) {
        if (!active) return;
        setError(errorMessage(requestError));
      } finally {
        if (active) setLoadingEvents(false);
      }
    }

    void loadEvents();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }

      for (const track of localStreamRef.current?.getTracks() ?? []) {
        track.stop();
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (localRecordingUrl) URL.revokeObjectURL(localRecordingUrl);
    };
  }, [localRecordingUrl]);

  useEffect(() => {
    if (!selectedEventId) {
      setStudioState(null);
      return;
    }

    let active = true;

    async function loadStudioState() {
      setLoadingState(true);
      setError(null);

      try {
        const result = await request<StudioState>(
          `/production-sessions/events/${selectedEventId}/state`,
        );
        if (active) setStudioState(result);
      } catch (requestError) {
        if (active) setError(errorMessage(requestError));
      } finally {
        if (active) setLoadingState(false);
      }
    }

    void loadStudioState();

    return () => {
      active = false;
    };
  }, [selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const previewCamera = useMemo(
    () =>
      studioState?.cameraSources.find(
        (source) =>
          source.id === studioState.productionSession?.preview_camera_source_id,
      ) ?? null,
    [studioState],
  );

  const programCamera = useMemo(
    () =>
      studioState?.cameraSources.find(
        (source) =>
          source.id === studioState.productionSession?.program_camera_source_id,
      ) ?? null,
    [studioState],
  );

  async function reloadState() {
    if (!selectedEventId) return;
    const result = await request<StudioState>(
      `/production-sessions/events/${selectedEventId}/state`,
    );
    setStudioState(result);
  }

  async function reloadDestinationProfiles() {
    const profiles = await request<DestinationProfile[]>("/destination-profiles");
    setDestinationProfiles(profiles);
  }

  async function startSession() {
    if (!selectedEventId) return;

    setActing("session");
    setError(null);

    try {
      await request<ProductionSession>("/production-sessions", {
        method: "POST",
        body: JSON.stringify({ eventId: selectedEventId }),
      });
      await reloadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing(null);
    }
  }

  async function selectPreview(cameraSourceId: string) {
    if (!studioState?.productionSession) return;

    setActing(cameraSourceId);
    setError(null);

    try {
      await request<ProductionSession>(
        `/production-sessions/${studioState.productionSession.id}/preview`,
        {
          method: "PATCH",
          body: JSON.stringify({ cameraSourceId }),
        },
      );
      await reloadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing(null);
    }
  }

  async function takePreviewToProgram() {
    if (!studioState?.productionSession) return;

    setActing("take");
    setError(null);

    try {
      await request<ProductionSession>(
        `/production-sessions/${studioState.productionSession.id}/take`,
        { method: "POST" },
      );
      await reloadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing(null);
    }
  }

  async function setActiveBout(boutId: string) {
    if (!studioState?.productionSession) return;

    setActing("active-bout");
    setError(null);

    try {
      await request<ProductionSession>(
        `/production-sessions/${studioState.productionSession.id}/active-bout`,
        {
          method: "PATCH",
          body: JSON.stringify({ boutId: boutId || null }),
        },
      );
      await reloadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing(null);
    }
  }

  async function configureRoundTimer() {
    if (!studioState?.productionSession) return;

    setActing("round-config");
    setError(null);

    try {
      await request<RoundTimer>(
        `/production-sessions/${studioState.productionSession.id}/round-timer`,
        {
          method: "POST",
          body: JSON.stringify({
            currentRound: Number(roundConfig.currentRound),
            durationSeconds: Number(roundConfig.durationSeconds),
          }),
        },
      );
      await reloadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing(null);
    }
  }

  async function runTimerAction(action: "start" | "pause" | "reset") {
    if (!studioState?.productionSession) return;

    setActing(`timer-${action}`);
    setError(null);

    try {
      await request<RoundTimer>(
        `/production-sessions/${studioState.productionSession.id}/round-timer/${action}`,
        { method: "POST" },
      );
      await reloadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing(null);
    }
  }

  async function createDestinationProfile() {
    setActing("destination-create");
    setError(null);

    try {
      await request<DestinationProfile>("/destination-profiles", {
        method: "POST",
        body: JSON.stringify(newDestination),
      });
      setNewDestination({
        name: "",
        platform: "YouTube",
        rtmpUrl: "",
        streamKeySecretRef: "",
      });
      await reloadDestinationProfiles();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing(null);
    }
  }

  async function linkDestinationProfile(destinationProfileId: string) {
    if (!selectedEventId) return;

    setActing(`destination-link-${destinationProfileId}`);
    setError(null);

    try {
      await request(`/events/${selectedEventId}/destination-profiles`, {
        method: "POST",
        body: JSON.stringify({ destinationProfileId, isEnabled: true }),
      });
      await reloadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing(null);
    }
  }

  async function setDestinationEnabled(
    eventDestinationProfileId: string,
    isEnabled: boolean,
  ) {
    setActing(`destination-toggle-${eventDestinationProfileId}`);
    setError(null);

    try {
      await request(`/event-destination-profiles/${eventDestinationProfileId}`, {
        method: "PATCH",
        body: JSON.stringify({ isEnabled }),
      });
      await reloadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing(null);
    }
  }

  async function createGraphicsCue() {
    if (!selectedEventId) return;

    setActing("graphics-create");
    setError(null);

    try {
      const payload = JSON.parse(newGraphicsCue.payloadText) as unknown;

      await request<GraphicsCue>(`/events/${selectedEventId}/graphics-cues`, {
        method: "POST",
        body: JSON.stringify({
          name: newGraphicsCue.name,
          cueType: newGraphicsCue.cueType,
          payload,
          isActive: false,
        }),
      });

      setNewGraphicsCue({
        name: "",
        cueType: "Event Branding",
        payloadText: "{\n  \"title\": \"\"\n}",
      });
      await reloadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing(null);
    }
  }

  async function setGraphicsCueActive(graphicsCueId: string, isActive: boolean) {
    setActing(`graphics-toggle-${graphicsCueId}`);
    setError(null);

    try {
      await request<GraphicsCue>(`/graphics-cues/${graphicsCueId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      await reloadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing(null);
    }
  }

  async function startLocalCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support local camera capture.");
      return;
    }

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment",
        },
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setLocalCameraActive(true);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  function stopLocalCamera() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    for (const track of localStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }

    localStreamRef.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setLocalCameraActive(false);
    setLocalRecording(false);
  }

  function startLocalRecording() {
    const stream = localStreamRef.current;
    if (!stream) {
      setError("Start the local camera before recording.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("This browser does not support local recording.");
      return;
    }

    const mimeType = getSupportedRecordingMimeType();
    recordedChunksRef.current = [];
    if (localRecordingUrl) URL.revokeObjectURL(localRecordingUrl);
    setLocalRecordingUrl(null);
    setLocalRecordingMimeType(mimeType);

    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, {
        type: mimeType || "video/webm",
      });
      setLocalRecordingUrl(URL.createObjectURL(blob));
      setLocalRecording(false);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setLocalRecording(true);
  }

  function stopLocalRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  const allBouts = useMemo(
    () => studioState?.fightCards.flatMap((card) => card.bouts) ?? [],
    [studioState],
  );

  const linkedDestinationIds = useMemo(
    () => new Set(studioState?.destinationProfiles.map((profile) => profile.id) ?? []),
    [studioState],
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">
                Strikers Match
              </p>
              <h1 className="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl">
                Studio Control Room
              </h1>
              <p className="mt-1 text-sm text-neutral-400">
                Preview / Program production workflow for live boxing events.
              </p>
            </div>
            <div className="grid gap-2 sm:min-w-80">
              <label
                htmlFor="event"
                className="text-xs font-bold uppercase tracking-wide text-neutral-400"
              >
                Event
              </label>
              <select
                id="event"
                value={selectedEventId}
                disabled={loadingEvents}
                onChange={(event) => setSelectedEventId(event.target.value)}
                className="min-h-11 border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-red-600"
              >
                {events.length === 0 ? (
                  <option value="">No events available</option>
                ) : (
                  events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </header>

        {error ? (
          <div className="border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section className="border border-amber-800 bg-amber-950/20 p-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-amber-300">
            Local Capture Mode
          </h2>
          <p className="mt-2 text-sm text-amber-100/80">
            No streaming server is connected in this phase. Camera preview and
            recording run in this browser and recordings are saved on this
            device.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MonitorPanel
              title="Preview"
              camera={previewCamera}
              emptyText={
                studioState?.productionSession
                  ? "Select a camera source for preview."
                  : "Start a production session to select preview."
              }
              tone="preview"
            />
            <MonitorPanel
              title="Program"
              camera={programCamera}
              emptyText="No program camera selected."
              tone="program"
            />
          </div>

          <div className="grid gap-4">
            <ControlPanel title="Session">
              <div className="grid grid-cols-2 gap-3">
                <StatusBlock
                  label="Event"
                  value={selectedEvent?.status ?? "No event"}
                />
                <StatusBlock
                  label="Session"
                  value={studioState?.productionSession?.status ?? "Not started"}
                />
                <StatusBlock
                  label="Recording"
                  value={studioState?.recording?.status ?? "Not recording"}
                />
                <StatusBlock
                  label="Destinations"
                  value={`${studioState?.destinationProfiles.filter((profile) => profile.is_enabled).length ?? 0} enabled`}
                />
              </div>
              <button
                type="button"
                disabled={!selectedEventId || acting === "session"}
                onClick={startSession}
                className="mt-4 min-h-12 w-full bg-red-700 px-4 py-3 text-sm font-black uppercase tracking-widest text-white disabled:bg-neutral-700 disabled:text-neutral-400"
              >
                {studioState?.productionSession
                  ? "Load Production Session"
                  : acting === "session"
                    ? "Starting"
                    : "Start Production Session"}
              </button>
              <button
                type="button"
                disabled={
                  !studioState?.productionSession ||
                  !studioState.productionSession.preview_camera_source_id ||
                  acting === "take"
                }
                onClick={takePreviewToProgram}
                className="mt-3 min-h-14 w-full bg-neutral-100 px-4 py-3 text-base font-black uppercase tracking-widest text-neutral-950 disabled:bg-neutral-700 disabled:text-neutral-400"
              >
                Take
              </button>
            </ControlPanel>

            <ControlPanel title="Round Timer">
              {studioState?.roundTimer ? (
                <div>
                  <p className="text-5xl font-black tabular-nums">
                    {formatSeconds(studioState.roundTimer.remaining_seconds)}
                  </p>
                  <p className="mt-2 text-sm text-neutral-400">
                    Round {studioState.roundTimer.current_round} ·{" "}
                    {studioState.roundTimer.status}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={acting === "timer-start"}
                      onClick={() => runTimerAction("start")}
                      className="min-h-11 border border-neutral-700 px-3 py-2 text-xs font-black uppercase text-neutral-100 disabled:text-neutral-600"
                    >
                      Start
                    </button>
                    <button
                      type="button"
                      disabled={acting === "timer-pause"}
                      onClick={() => runTimerAction("pause")}
                      className="min-h-11 border border-neutral-700 px-3 py-2 text-xs font-black uppercase text-neutral-100 disabled:text-neutral-600"
                    >
                      Pause
                    </button>
                    <button
                      type="button"
                      disabled={acting === "timer-reset"}
                      onClick={() => runTimerAction("reset")}
                      className="min-h-11 border border-neutral-700 px-3 py-2 text-xs font-black uppercase text-neutral-100 disabled:text-neutral-600"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-400">
                  No round timer state is active for this session.
                </p>
              )}
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  value={roundConfig.currentRound}
                  onChange={(event) =>
                    setRoundConfig((current) => ({
                      ...current,
                      currentRound: event.target.value,
                    }))
                  }
                  type="number"
                  min={1}
                  aria-label="Round"
                  className="min-h-11 border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-red-600"
                />
                <input
                  value={roundConfig.durationSeconds}
                  onChange={(event) =>
                    setRoundConfig((current) => ({
                      ...current,
                      durationSeconds: event.target.value,
                    }))
                  }
                  type="number"
                  min={1}
                  aria-label="Round duration seconds"
                  className="min-h-11 border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-red-600"
                />
                <button
                  type="button"
                  disabled={!studioState?.productionSession || acting === "round-config"}
                  onClick={configureRoundTimer}
                  className="min-h-11 border border-neutral-700 px-3 py-2 text-xs font-black uppercase text-neutral-100 disabled:text-neutral-600"
                >
                  Set
                </button>
              </div>
            </ControlPanel>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <ControlPanel title="Local Camera and Recording">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="overflow-hidden border border-neutral-800 bg-black">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-video w-full bg-black object-cover"
                />
              </div>
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <StatusBlock
                    label="Camera"
                    value={localCameraActive ? "Local active" : "Stopped"}
                  />
                  <StatusBlock
                    label="Local recording"
                    value={localRecording ? "Recording" : "Stopped"}
                  />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={startLocalCamera}
                    disabled={localCameraActive}
                    className="min-h-11 border border-neutral-700 px-3 py-2 text-xs font-black uppercase text-neutral-100 disabled:text-neutral-600"
                  >
                    Start Camera
                  </button>
                  <button
                    type="button"
                    onClick={stopLocalCamera}
                    disabled={!localCameraActive}
                    className="min-h-11 border border-neutral-700 px-3 py-2 text-xs font-black uppercase text-neutral-100 disabled:text-neutral-600"
                  >
                    Stop Camera
                  </button>
                  <button
                    type="button"
                    onClick={startLocalRecording}
                    disabled={!localCameraActive || localRecording}
                    className="min-h-11 border border-neutral-700 px-3 py-2 text-xs font-black uppercase text-neutral-100 disabled:text-neutral-600"
                  >
                    Start Recording
                  </button>
                  <button
                    type="button"
                    onClick={stopLocalRecording}
                    disabled={!localRecording}
                    className="min-h-11 border border-neutral-700 px-3 py-2 text-xs font-black uppercase text-neutral-100 disabled:text-neutral-600"
                  >
                    Stop Recording
                  </button>
                </div>
                {localRecordingUrl ? (
                  <a
                    href={localRecordingUrl}
                    download={`strikersmatch-local-recording.${recordingExtension(localRecordingMimeType)}`}
                    className="mt-3 block min-h-11 border border-red-700 px-3 py-3 text-center text-xs font-black uppercase tracking-widest text-red-200"
                  >
                    Download Recording
                  </a>
                ) : (
                  <p className="mt-3 text-xs text-neutral-500">
                    After stopping a recording, download it before closing this
                    page.
                  </p>
                )}
              </div>
            </div>
          </ControlPanel>

          <ControlPanel title="Server Streaming">
            <div className="space-y-3 text-sm text-neutral-400">
              <p>
                Real livestreaming is deferred until SRS and FFmpeg servers are
                funded and deployed.
              </p>
              <div className="border border-neutral-800 bg-neutral-950 p-3">
                <p className="font-bold uppercase text-neutral-200">
                  Disabled for current phase
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li>remote multi-camera ingest</li>
                  <li>public livestream</li>
                  <li>RTMP output to platforms</li>
                  <li>server-side program output</li>
                  <li>server-side recording</li>
                </ul>
              </div>
              <button
                type="button"
                disabled
                className="min-h-12 w-full border border-neutral-800 px-4 py-3 text-sm font-black uppercase tracking-widest text-neutral-600"
              >
                Go Live Requires Streaming Server
              </button>
            </div>
          </ControlPanel>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <ControlPanel title="Camera Sources">
            {loadingState ? (
              <p className="text-sm text-neutral-400">Loading studio state.</p>
            ) : studioState?.cameraSources.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {studioState.cameraSources.map((source) => (
                  <CameraTile
                    key={source.id}
                    source={source}
                    isPreview={
                      source.id ===
                      studioState.productionSession?.preview_camera_source_id
                    }
                    isProgram={
                      source.id ===
                      studioState.productionSession?.program_camera_source_id
                    }
                    disabled={!studioState.productionSession || acting === source.id}
                    onSelectPreview={() => selectPreview(source.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">
                Start a production session to create the six approved browser
                camera source slots.
              </p>
            )}
          </ControlPanel>

          <ControlPanel title="Fight Card">
            <div className="mb-4">
              <label
                htmlFor="active-bout"
                className="mb-2 block text-xs font-bold uppercase tracking-wide text-neutral-500"
              >
                Active Bout
              </label>
              <select
                id="active-bout"
                value={studioState?.productionSession?.active_bout_id ?? ""}
                disabled={!studioState?.productionSession || acting === "active-bout"}
                onChange={(event) => setActiveBout(event.target.value)}
                className="min-h-11 w-full border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-red-600"
              >
                <option value="">No active bout</option>
                {allBouts.map((bout) => (
                  <option key={bout.id} value={bout.id}>
                    {bout.sort_order}. {bout.red_fighter_name} vs {bout.blue_fighter_name}
                  </option>
                ))}
              </select>
            </div>
            {studioState?.fightCards.length ? (
              <div className="space-y-4">
                {studioState.fightCards.map((card) => (
                  <div key={card.id} className="border border-neutral-800">
                    <div className="border-b border-neutral-800 bg-neutral-950 px-3 py-2">
                      <p className="text-sm font-black uppercase">{card.name}</p>
                    </div>
                    <div className="divide-y divide-neutral-800">
                      {card.bouts.map((bout) => (
                        <div
                          key={bout.id}
                          className="grid gap-1 px-3 py-3 text-sm sm:grid-cols-[48px_1fr_auto] sm:items-center"
                        >
                          <p className="font-black text-neutral-500">
                            {bout.sort_order}
                          </p>
                          <div>
                            <p className="font-bold text-neutral-100">
                              {bout.red_fighter_name} vs {bout.blue_fighter_name}
                            </p>
                            <p className="mt-1 text-xs text-neutral-500">
                              {bout.scheduled_rounds} rounds ·{" "}
                              {formatSeconds(bout.round_duration_seconds)} each
                            </p>
                          </div>
                          <p className="text-xs font-bold uppercase text-neutral-400">
                            {bout.weight_class ?? "Open weight"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">
                No fight card data is available for the selected event.
              </p>
            )}
          </ControlPanel>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <ControlPanel title="Event Destinations">
            {studioState?.destinationProfiles.length ? (
              <div className="space-y-3">
                {studioState.destinationProfiles.map((profile) => (
                  <div
                    key={profile.event_destination_profile_id}
                    className="flex flex-col gap-3 border border-neutral-800 bg-neutral-950 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-bold">{profile.name}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {profile.platform} · {profile.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={
                        acting ===
                        `destination-toggle-${profile.event_destination_profile_id}`
                      }
                      onClick={() =>
                        setDestinationEnabled(
                          profile.event_destination_profile_id,
                          !profile.is_enabled,
                        )
                      }
                      className="min-h-11 border border-neutral-700 px-3 py-2 text-xs font-black uppercase text-neutral-100 disabled:text-neutral-600"
                    >
                      {profile.is_enabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">
                No destination profiles are linked to this event.
              </p>
            )}
          </ControlPanel>

          <ControlPanel title="Destination Profiles">
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={newDestination.name}
                  onChange={(event) =>
                    setNewDestination((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Profile name"
                  className="min-h-11 border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-red-600"
                />
                <select
                  value={newDestination.platform}
                  onChange={(event) =>
                    setNewDestination((current) => ({
                      ...current,
                      platform: event.target.value,
                    }))
                  }
                  className="min-h-11 border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-red-600"
                >
                  {["YouTube", "Facebook", "Instagram", "TikTok", "Custom RTMP"].map(
                    (platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ),
                  )}
                </select>
                <input
                  value={newDestination.rtmpUrl}
                  onChange={(event) =>
                    setNewDestination((current) => ({
                      ...current,
                      rtmpUrl: event.target.value,
                    }))
                  }
                  placeholder="RTMP URL"
                  className="min-h-11 border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-red-600"
                />
                <input
                  value={newDestination.streamKeySecretRef}
                  onChange={(event) =>
                    setNewDestination((current) => ({
                      ...current,
                      streamKeySecretRef: event.target.value,
                    }))
                  }
                  placeholder="Stream key secret reference"
                  className="min-h-11 border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-red-600"
                />
              </div>
              <button
                type="button"
                disabled={acting === "destination-create"}
                onClick={createDestinationProfile}
                className="min-h-11 w-full border border-neutral-700 px-3 py-2 text-xs font-black uppercase text-neutral-100 disabled:text-neutral-600"
              >
                Create Destination Profile
              </button>
              <div className="space-y-2 border-t border-neutral-800 pt-3">
                {destinationProfiles.map((profile) => {
                  const linked = linkedDestinationIds.has(profile.id);
                  return (
                    <div
                      key={profile.id}
                      className="flex flex-col gap-2 border border-neutral-800 bg-neutral-950 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-bold">{profile.name}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {profile.platform} · {profile.status}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={
                          linked || acting === `destination-link-${profile.id}`
                        }
                        onClick={() => linkDestinationProfile(profile.id)}
                        className="min-h-11 border border-neutral-700 px-3 py-2 text-xs font-black uppercase text-neutral-100 disabled:text-neutral-600"
                      >
                        {linked ? "Linked" : "Link to Event"}
                      </button>
                    </div>
                  );
                })}
                {destinationProfiles.length === 0 ? (
                  <p className="text-sm text-neutral-400">
                    No reusable RTMP destination profiles exist.
                  </p>
                ) : null}
              </div>
            </div>
          </ControlPanel>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <ControlPanel title="Graphics Cues">
            {studioState?.graphicsCues.length ? (
              <div className="space-y-3">
                {studioState.graphicsCues.map((cue) => (
                  <div
                    key={cue.id}
                    className="border border-neutral-800 bg-neutral-950 p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold">{cue.name}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {cue.cue_type} · {cue.is_active ? "Active" : "Inactive"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={acting === `graphics-toggle-${cue.id}`}
                        onClick={() =>
                          setGraphicsCueActive(cue.id, !cue.is_active)
                        }
                        className="min-h-11 border border-neutral-700 px-3 py-2 text-xs font-black uppercase text-neutral-100 disabled:text-neutral-600"
                      >
                        {cue.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                    <pre className="mt-3 max-h-44 overflow-auto border border-neutral-900 bg-black p-3 text-xs text-neutral-400">
                      {JSON.stringify(cue.payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">
                No graphics cues are configured for this event.
              </p>
            )}
          </ControlPanel>

          <ControlPanel title="Create Graphics Cue">
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={newGraphicsCue.name}
                  onChange={(event) =>
                    setNewGraphicsCue((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Cue name"
                  className="min-h-11 border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-red-600"
                />
                <select
                  value={newGraphicsCue.cueType}
                  onChange={(event) =>
                    setNewGraphicsCue((current) => ({
                      ...current,
                      cueType: event.target.value,
                    }))
                  }
                  className="min-h-11 border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-red-600"
                >
                  {[
                    "Event Branding",
                    "Fighter Intro Graphics",
                    "Matchup Graphics",
                    "Sponsor Overlays",
                  ].map((cueType) => (
                    <option key={cueType} value={cueType}>
                      {cueType}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={newGraphicsCue.payloadText}
                onChange={(event) =>
                  setNewGraphicsCue((current) => ({
                    ...current,
                    payloadText: event.target.value,
                  }))
                }
                rows={8}
                spellCheck={false}
                className="w-full border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs outline-none focus:border-red-600"
              />
              <p className="text-xs text-neutral-500">
                Payload must be a valid JSON object. This stores graphics state
                now; live rendering is deferred until the graphics package slice
                is approved.
              </p>
              <button
                type="button"
                disabled={!selectedEventId || acting === "graphics-create"}
                onClick={createGraphicsCue}
                className="min-h-11 w-full border border-neutral-700 px-3 py-2 text-xs font-black uppercase text-neutral-100 disabled:text-neutral-600"
              >
                Create Graphics Cue
              </button>
            </div>
          </ControlPanel>
        </section>
      </div>
    </main>
  );
}

function ControlPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="border-b border-neutral-800 pb-3 text-sm font-black uppercase tracking-widest text-neutral-300">
        {title}
      </h2>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function MonitorPanel({
  title,
  camera,
  emptyText,
  tone,
}: {
  title: string;
  camera: CameraSource | null;
  emptyText: string;
  tone: "preview" | "program";
}) {
  return (
    <section className="border border-neutral-800 bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <h2 className="text-sm font-black uppercase tracking-widest text-neutral-300">
          {title}
        </h2>
        <span
          className={`border px-2 py-1 text-xs font-bold uppercase ${
            tone === "program"
              ? "border-red-700 text-red-300"
              : "border-amber-700 text-amber-300"
          }`}
        >
          {tone}
        </span>
      </div>
      <div className="flex min-h-64 items-center justify-center bg-black p-4">
        {camera ? (
          <div className="text-center">
            <p className="text-3xl font-black uppercase">{camera.role_name}</p>
            <p className="mt-2 text-sm text-neutral-400">
              Camera {camera.source_index} · {camera.status}
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              {camera.device_label ?? "No browser device label"}
            </p>
          </div>
        ) : (
          <p className="max-w-72 text-center text-sm text-neutral-500">
            {emptyText}
          </p>
        )}
      </div>
    </section>
  );
}

function CameraTile({
  source,
  isPreview,
  isProgram,
  disabled,
  onSelectPreview,
}: {
  source: CameraSource;
  isPreview: boolean;
  isProgram: boolean;
  disabled: boolean;
  onSelectPreview: () => void;
}) {
  return (
    <div className="border border-neutral-800 bg-neutral-950 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-neutral-500">
            Camera {source.source_index}
          </p>
          <p className="mt-1 font-bold text-neutral-100">{source.role_name}</p>
          <p className="mt-1 text-xs text-neutral-500">{source.status}</p>
        </div>
        <div className="flex flex-col gap-1 text-right text-[10px] font-bold uppercase tracking-wide">
          {isPreview ? (
            <span className="border border-amber-700 px-2 py-1 text-amber-300">
              Preview
            </span>
          ) : null}
          {isProgram ? (
            <span className="border border-red-700 px-2 py-1 text-red-300">
              Program
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onSelectPreview}
        className="mt-4 min-h-11 w-full border border-neutral-700 px-3 py-2 text-xs font-black uppercase tracking-widest text-neutral-200 disabled:border-neutral-800 disabled:text-neutral-600"
      >
        Select Preview
      </button>
    </div>
  );
}

function StatusBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-neutral-800 bg-neutral-950 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-bold text-neutral-100">{value}</p>
    </div>
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `Request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  const supportedTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];

  return (
    supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
  );
}

function recordingExtension(mimeType: string) {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}
