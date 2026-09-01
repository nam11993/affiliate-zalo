import { processShopeeLink } from '../src/services/phase1.mjs';

const input = process.argv[2] || 'https://vn.shp.ee/FzQcBoQr';
const userId = process.argv[3] || 'U000123';
const displayName = process.argv[4] || 'Thanh';

try {
  const result = await processShopeeLink({ url: input, userId, displayName, resolve: true });
  console.log(JSON.stringify(result, null, 2));
  console.log('\n--- Zalo reply ---\n' + result.replyText);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
