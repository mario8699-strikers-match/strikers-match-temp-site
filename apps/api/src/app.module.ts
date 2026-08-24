import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CameraSourcesModule } from "./camera-sources/camera-sources.module";
import { DatabaseModule } from "./database/database.module";
import { DestinationProfilesModule } from "./destination-profiles/destination-profiles.module";
import { EventsModule } from "./events/events.module";
import { FightCardsModule } from "./fight-cards/fight-cards.module";
import { GraphicsCuesModule } from "./graphics-cues/graphics-cues.module";
import { HealthModule } from "./health/health.module";
import { ProductionSessionsModule } from "./production-sessions/production-sessions.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env.local", ".env.local", ".env"],
    }),
    DatabaseModule,
    EventsModule,
    FightCardsModule,
    CameraSourcesModule,
    DestinationProfilesModule,
    GraphicsCuesModule,
    ProductionSessionsModule,
    HealthModule,
  ],
})
export class AppModule {}
