import type { AppEnv } from "./config/env.js";
import type { TreasuryConfig } from "@tron-payments/shared";
import type { AuthService } from "./services/auth.service.js";
import type { AuditService } from "./services/audit.service.js";
import type { PaymentRequestService } from "./services/payment-request.service.js";
import type { BroadcastService } from "./services/broadcast.service.js";
import type { TronRpcService } from "./services/tron-rpc.service.js";
import type { TreasuryConfigService } from "./services/treasury-config.service.js";

export interface AppContext {
  env: AppEnv;
  config: TreasuryConfig | null;
  configValid: boolean;
  validationErrors: string[];
  auth: AuthService;
  audit: AuditService;
  paymentRequests: PaymentRequestService;
  broadcast: BroadcastService;
  tronRpc: TronRpcService;
  treasuryConfig: TreasuryConfigService;
  /** Hot-reload in-memory treasury config after admin save/validate. */
  applyTreasuryRuntime(
    config: TreasuryConfig | null,
    configValid: boolean,
    validationErrors: string[],
  ): void;
}
