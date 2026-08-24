import { Module } from "@nestjs/common";
import { CameraSourcesModule } from "../camera-sources/camera-sources.module";
import { DatabaseModule } from "../database/database.module";
import { EventsModule } from "../events/events.module";
import { FightCardsModule } from "../fight-cards/fight-cards.module";
import { GraphicsCuesModule } from "../graphics-cues/graphics-cues.module";
import { ProductionSessionsController } from "./production-sessions.controller";
import { ProductionSessionsService } from "./production-sessions.service";

@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    FightCardsModule,
    CameraSourcesModule,
    GraphicsCuesModule,
  ],
  controllers: [ProductionSessionsController],
  providers: [ProductionSessionsService],
})
export class ProductionSessionsModule {}
