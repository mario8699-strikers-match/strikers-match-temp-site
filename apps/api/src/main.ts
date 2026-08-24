import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { getEnvironment } from "./config/environment";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const environment = getEnvironment();

  app.enableCors({
    origin: true,
  });

  await app.listen(environment.port);
}

void bootstrap();
