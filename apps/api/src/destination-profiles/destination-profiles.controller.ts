import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { DestinationProfilesService } from "./destination-profiles.service";
import type { CreateDestinationProfileInput } from "./destination-profiles.service";

type LinkDestinationBody = {
  destinationProfileId: string;
  isEnabled?: boolean;
};

type SetEnabledBody = {
  isEnabled: boolean;
};

@Controller()
export class DestinationProfilesController {
  constructor(
    private readonly destinationProfilesService: DestinationProfilesService,
  ) {}

  @Get("destination-profiles")
  listDestinationProfiles() {
    return this.destinationProfilesService.listDestinationProfiles();
  }

  @Post("destination-profiles")
  createDestinationProfile(@Body() body: CreateDestinationProfileInput) {
    return this.destinationProfilesService.createDestinationProfile(body);
  }

  @Post("events/:eventId/destination-profiles")
  linkDestinationToEvent(
    @Param("eventId") eventId: string,
    @Body() body: LinkDestinationBody,
  ) {
    return this.destinationProfilesService.linkDestinationToEvent(
      eventId,
      body.destinationProfileId,
      body.isEnabled ?? true,
    );
  }

  @Patch("event-destination-profiles/:eventDestinationProfileId")
  setEventDestinationEnabled(
    @Param("eventDestinationProfileId") eventDestinationProfileId: string,
    @Body() body: SetEnabledBody,
  ) {
    return this.destinationProfilesService.setEventDestinationEnabled(
      eventDestinationProfileId,
      body.isEnabled,
    );
  }
}
