# Suggested next Codex task

Connect a personal Zalo transport adapter to the already-tested message router without changing business rules.

Acceptance criteria:
1. `npm test` passes.
2. Login/session logic is isolated under `src/zalo/`.
3. A live group event is mapped into `{senderId,senderName,groupId,messageId,text,isOwnMessage}`.
4. The adapter sends `reply.text`, quotes `reply.quoteMessageId`, and mentions `reply.mentions` when supported.
5. Only allowlisted groups are processed.
6. Own messages and duplicates are ignored.
7. Normal chat is ignored.
8. Shopee URLs route to the affiliate handler.
9. Until Shopee Open API is approved, the live path must not invent an affiliate URL or commission.
10. Do not implement wallet/orders/withdrawal yet.

Manual parser/template preview remains available at `http://localhost:3000/simulator`.
