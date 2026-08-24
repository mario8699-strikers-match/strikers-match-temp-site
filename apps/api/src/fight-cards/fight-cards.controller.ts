import { Controller, Get, Param } from "@nestjs/common";
import { FightCardsService } from "./fight-cards.service";

@Controller("events/:eventId/fight-cards")
export class FightCardsController {
  constructor(private readonly fightCardsService: FightCardsService) {}

  @Get()
  listFightCardsForEvent(@Param("eventId") eventId: string) {
    return this.fightCardsService.listFightCardsForEvent(eventId);
  }
}
