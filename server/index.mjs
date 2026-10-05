import { createServer } from "node:http";
import handler from "./handler.mjs";

createServer(handler).listen(
  Number(process.env.PORT || 8787),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      "Gantsta API: http://" +
      (process.env.HOST || "127.0.0.1") +
      ":" +
      (process.env.PORT || 8787),
    ),
);
