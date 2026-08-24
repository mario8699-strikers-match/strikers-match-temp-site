import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { DestinationProfilesController } from "./destination-profiles.controller";
import { DestinationProfilesService } from "./destination-profiles.service";

@Module({
  imports: [DatabaseModule],
  controllers: [DestinationProfilesController],
  providers: [DestinationProfilesService],
})
export class DestinationProfilesModule {}
