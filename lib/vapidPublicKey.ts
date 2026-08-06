// Chave pública VAPID — segura para expor no cliente.
// Pode ser sobrescrita por NEXT_PUBLIC_VAPID_PUBLIC_KEY.
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BNwiOJi8Vb7tuHSA-a8nVj7p97XPYNBeDG8Y-wq8pFKTj6oCs3A5noilqJDO26u1Jv8aHTxXC3qJYE-3nzdZwMQ";
