import 'dotenv/config';
import { createApp } from './app';

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = createApp();
const port = Number(process.env.PORT) || 4000;

app.listen(port, '0.0.0.0', () => {
  console.log(`GoldSilverShop API listening on 0.0.0.0:${port}`);
});
