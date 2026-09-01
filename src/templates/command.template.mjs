const COMMAND_LABELS = { vitien: '#vitien', donhang: '#donhang', bank: '#bank', ruttien: '#ruttien', id: '#id' };

export function buildCommandPreviewReply({ displayName, command }) {
  const who = displayName ? `@${displayName}` : 'Bạn';
  const label = COMMAND_LABELS[command] || `#${command}`;
  return `${who} ✅ Đã nhận diện lệnh ${label}. Handler này sẽ được bật ở phase sau.`;
}
