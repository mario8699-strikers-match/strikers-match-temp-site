import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { CameraSourcesController } from "./camera-sources.controller";
import { CameraSourcesService } from "./camera-sources.service";

@Module({
  imports: [DatabaseModule],
  controllers: [CameraSourcesController],
  providers: [CameraSourcesService],
  exports: [CameraSourcesService],
})
export class CameraSourcesModule {}
