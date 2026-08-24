import { Controller, Get, Param } from "@nestjs/common";
import { CameraSourcesService } from "./camera-sources.service";

@Controller("events/:eventId/camera-sources")
export class CameraSourcesController {
  constructor(private readonly cameraSourcesService: CameraSourcesService) {}

  @Get()
  listCameraSourcesForEvent(@Param("eventId") eventId: string) {
    return this.cameraSourcesService.listCameraSourcesForEvent(eventId);
  }
}
