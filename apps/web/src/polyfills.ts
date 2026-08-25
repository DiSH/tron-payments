import { Buffer } from "buffer";

// LedgerHQ packages expect Node's Buffer in the browser.
(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
