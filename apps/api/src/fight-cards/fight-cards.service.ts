import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { POSTGRES_POOL_PROVIDER } from "../database/postgres.provider";

export type FightCardBout = {
  id: string;
  fight_card_id: string;
  red_fighter_id: string;
  blue_fighter_id: string;
  red_fighter_name: string;
  blue_fighter_name: string;
  weight_class: string | null;
  scheduled_rounds: number;
  round_duration_seconds: number;
  sort_order: number;
};

type PublicBoutRow = {
  id: string;
  event_id: string;
  fighter_a_id: string;
  fighter_b_id: string;
  fighter_a_name: string | null;
  fighter_b_name: string | null;
  weight_class: string | null;
  bout_format: string | null;
  bout_number: number | null;
  mat_order: number | null;
  created_at: string;
  updated_at: string;
};

export type FightCardWithBouts = {
  id: string;
  event_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  bouts: FightCardBout[];
};

@Injectable()
export class FightCardsService {
  constructor(
    @Inject(POSTGRES_POOL_PROVIDER)
    private readonly pool: Pool,
  ) {}

  async listFightCardsForEvent(eventId: string): Promise<FightCardWithBouts[]> {
    const result = await this.pool.query<PublicBoutRow>(
      `
      select
        id,
        event_id,
        fighter_a_id,
        fighter_b_id,
        fighter_a_snapshot->>'name' as fighter_a_name,
        fighter_b_snapshot->>'name' as fighter_b_name,
        weight_class,
        bout_format,
        bout_number,
        mat_order,
        created_at,
        updated_at
      from public.bouts
      where event_id = $1
      order by bout_number nulls last, mat_order nulls last, created_at asc
      `,
      [eventId],
    );

    if (result.rows.length === 0) return [];

    const firstBout = result.rows[0];
    const lastUpdated = result.rows.reduce((latest, bout) =>
      new Date(bout.updated_at).getTime() > new Date(latest).getTime()
        ? bout.updated_at
        : latest,
    firstBout.updated_at);

    return [
      {
        id: eventId,
        event_id: eventId,
        name: "Event Fight Card",
        created_at: firstBout.created_at,
        updated_at: lastUpdated,
        bouts: result.rows.map((bout, index) => ({
          id: bout.id,
          fight_card_id: eventId,
          red_fighter_id: bout.fighter_a_id,
          blue_fighter_id: bout.fighter_b_id,
          red_fighter_name: bout.fighter_a_name ?? "Fighter A",
          blue_fighter_name: bout.fighter_b_name ?? "Fighter B",
          weight_class: bout.weight_class,
          scheduled_rounds: this.resolveScheduledRounds(bout.bout_format),
          round_duration_seconds: this.resolveRoundDurationSeconds(
            bout.bout_format,
          ),
          sort_order: bout.bout_number ?? bout.mat_order ?? index + 1,
        })),
      },
    ];
  }

  private resolveScheduledRounds(boutFormat: string | null): number {
    if (!boutFormat) return 3;

    const match = boutFormat.match(/(\d+)\s*(?:x|rounds?|rds?|asaltos?)/i);
    if (!match) return 3;

    const rounds = Number(match[1]);
    return Number.isFinite(rounds) && rounds > 0 ? rounds : 3;
  }

  private resolveRoundDurationSeconds(boutFormat: string | null): number {
    if (!boutFormat) return 180;

    const minuteMatch = boutFormat.match(/x\s*(\d+)\s*(?:min|m|'|minutes?)/i);
    if (minuteMatch) {
      const minutes = Number(minuteMatch[1]);
      return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : 180;
    }

    const secondMatch = boutFormat.match(/x\s*(\d+)\s*(?:sec|s|seconds?)/i);
    if (secondMatch) {
      const seconds = Number(secondMatch[1]);
      return Number.isFinite(seconds) && seconds > 0 ? seconds : 180;
    }

    return 180;
  }
}
