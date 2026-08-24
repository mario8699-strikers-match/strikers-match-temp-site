import { CameraSource } from "../camera-sources/camera-sources.service";
import { StudioEvent } from "../events/events.service";
import { FightCardWithBouts } from "../fight-cards/fight-cards.service";
import { GraphicsCue } from "../graphics-cues/graphics-cues.service";

export type ProductionSession = {
  id: string;
  event_id: string;
  status: string;
  preview_camera_source_id: string | null;
  program_camera_source_id: string | null;
  active_bout_id: string | null;
  went_live_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RoundTimer = {
  id: string;
  production_session_id: string;
  current_round: number;
  duration_seconds: number;
  remaining_seconds: number;
  status: string;
  started_at: string | null;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Recording = {
  id: string;
  event_id: string;
  production_session_id: string;
  status: string;
  format: "MP4";
  storage_bucket: string | null;
  storage_key: string | null;
  started_at: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DestinationProfileSummary = {
  id: string;
  event_destination_profile_id: string;
  name: string;
  platform: string;
  status: string;
  is_enabled: boolean;
};

export type StudioState = {
  event: StudioEvent;
  fightCards: FightCardWithBouts[];
  cameraSources: CameraSource[];
  productionSession: ProductionSession | null;
  roundTimer: RoundTimer | null;
  recording: Recording | null;
  destinationProfiles: DestinationProfileSummary[];
  graphicsCues: GraphicsCue[];
};
