import type { MeterAdapter, AdapterResponse, MeterConfig } from "./types";
import { adapterError } from "./types";

/**
 * MANUAL adapter — used for meters that don't expose any network API.
 *
 * The reading is entered by an operator through the UI (or imported via
 * CSV by the CSV_IMPORT adapter). For programmatic sync attempts this
 * adapter always returns "no autonomous fetch available".
 */
export const manualAdapter: MeterAdapter = {
  name: "MANUAL",
  async fetchReading(_meter: MeterConfig, _secret: string | null): Promise<AdapterResponse> {
    return adapterError(
      "MANUAL meters have no API. Use the 'Record reading' UI or the CSV importer.",
      false,
    );
  },
};
