import type { AppEnv, TreasuryConfig } from "../config/env.js";
import type { AuthService } from "../services/auth.service.js";
import type { AuditService } from "../services/audit.service.js";
import type { PaymentRequestService } from "../services/payment-request.service.js";
import type { BroadcastService } from "../services/broadcast.service.js";
import type { TronRpcService } from "../services/tron-rpc.service.js";

export interface AppContext {
  env: AppEnv;
  config: TreasuryConfig;
  configValid: boolean;
  validationErrors: string[];
  auth: AuthService;
  audit: AuditService;
  paymentRequests: PaymentRequestService;
  broadcast: BroadcastService;
  tronRpc: TronRpcService;
}
