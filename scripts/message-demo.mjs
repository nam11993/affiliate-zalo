import { MessageRouter } from '../src/messaging/router.mjs';

const router = new MessageRouter();

const scenarios = [
  {
    name: 'Shopee link → mock affiliate reply',
    input: {
      senderId: 'zalo-user-123', senderName: 'Thanh Thanh', groupId: 'group-test', messageId: 'msg-001',
      text: 'https://shopee.vn/product/731999859/41261407193?d_id=e13c7&utm_content=test'
    },
    options: { mockAffiliate: { affiliateUrl: 'https://s.shopee.vn/TEST_PHASE1', productName: 'Sản phẩm test Phase 1', commission: 12350 } }
  },
  {
    name: 'Command parser preview',
    input: { senderId: 'zalo-user-456', senderName: 'Trang', groupId: 'group-test', messageId: 'msg-002', text: '#vitien' },
    options: { previewCommands: true }
  },
  {
    name: 'Normal text → ignore',
    input: { senderId: 'zalo-user-789', senderName: 'Nam', groupId: 'group-test', messageId: 'msg-003', text: 'xin chào mọi người' },
    options: {}
  }
];

for (const scenario of scenarios) {
  const result = await router.route(scenario.input, scenario.options);
  console.log(`\n=== ${scenario.name} ===`);
  console.log('parsed:', JSON.stringify(result.parsed));
  console.log('action:', result.action);
  if (result.reply) {
    console.log('quote:', result.reply.quoteMessageId);
    console.log('mentions:', JSON.stringify(result.reply.mentions));
    console.log('\n' + result.reply.text);
  } else {
    console.log('reason:', result.reason);
  }
}
