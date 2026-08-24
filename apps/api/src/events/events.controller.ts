import { Controller, Get, Param } from "@nestjs/common";
import { EventsService } from "./events.service";

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  listEvents() {
    return this.eventsService.listEvents();
  }

  @Get(":eventId")
  getEvent(@Param("eventId") eventId: string) {
    return this.eventsService.getEvent(eventId);
  }
}
