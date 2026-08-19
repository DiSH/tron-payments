import type { Network } from "../index.js";

export interface TokenConfig {
  symbol: string;
  contractAddress: string;
  decimals: number;
}

export interface CanonicalPaymentDigest {
  network: Network;
  treasuryAddress: string;
  permissionId: number;
  token: TokenConfig;
  operation: "transfer(address,uint256)";
  recipient: string;
  amountRaw: string;
  amountDisplay: string;
  expiration: string;
  requestId: string;
}

export interface PaymentRequestRecord {
  id: string;
  sequenceNumber: number;
  status: string;
  network: Network;
  treasuryAddress: string;
  permissionId: number;
  tokenContractAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  recipientAddress: string;
  amountRaw: string;
  amountDisplay: string;
  purpose: string;
  externalReference: string;
  documentUrl: string | null;
  expirationAt: string;
  rawDataHex: string;
  txId: string;
  canonicalPayloadJson: string;
  canonicalPayloadHash: string;
  createdBy: string;
  version: number;
}

export interface SignatureSubmission {
  requestId: string;
  signerAddress: string;
  signature: string;
  txId: string;
  payloadHash: string;
  signedAt: string;
}

export interface SignWeightResult {
  threshold: number;
  currentWeight: number;
  approvedSigners: string[];
  sufficient: boolean;
}
