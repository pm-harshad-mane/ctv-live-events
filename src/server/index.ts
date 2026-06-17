import { createApp } from "./createApp";
import { getEnv } from "./config/env";

const app = createApp();
const env = getEnv();

app.listen(env.port, () => {
  console.log(`API server listening on http://localhost:${env.port}`);
});
