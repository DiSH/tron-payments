export interface SignerConfig {
  label: string;
  address: string;
  weight: number;
  role: "signer_a" | "signer_b" | "signer_c";
}

export interface TreasuryConfig {
  network: string;
  treasuryAddress: string;
  activePermissionId: number;
  activePermissionName: string;
  threshold: number;
  signers: SignerConfig[];
  usdtContractAddress: string;
  usdtDecimals: number;
  transactionTtlSeconds: number;
  maxPaymentAmountRaw: string;
  dailyCumulativeLimitRaw: string | null;
  recipientAllowlistEnabled: boolean;
  requiredConfirmationsBeforeBroadcast: number;
}
