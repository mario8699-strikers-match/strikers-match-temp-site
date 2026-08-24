import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { EventsModule } from "../events/events.module";
import { GraphicsCuesController } from "./graphics-cues.controller";
import { GraphicsCuesService } from "./graphics-cues.service";

@Module({
  imports: [DatabaseModule, EventsModule],
  controllers: [GraphicsCuesController],
  providers: [GraphicsCuesService],
  exports: [GraphicsCuesService],
})
export class GraphicsCuesModule {}
