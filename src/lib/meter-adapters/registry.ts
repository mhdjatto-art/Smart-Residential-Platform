import type { MeterAdapter, AdapterName } from "./types";
import { httpRestAdapter }  from "./http-rest";
import { mqttAdapter }      from "./mqtt";
import { modbusAdapter }    from "./modbus";
import { stsTokenAdapter }  from "./sts-token";
import { manualAdapter }    from "./manual";
import { mikrotikAdapter }  from "./mikrotik";

/**
 * Adapter registry. Add a new vendor by:
 *   1. Create src/lib/meter-adapters/<name>.ts implementing MeterAdapter
 *   2. Import it here
 *   3. Register it below
 *   4. Use the registered name as electricity_meters.api_provider
 */
const REGISTRY: Record<string, MeterAdapter> = {
  HTTP_REST:    httpRestAdapter,
  MQTT:         mqttAdapter,
  MODBUS_TCP:   modbusAdapter,
  STS_TOKEN:    stsTokenAdapter,
  HEXING:       stsTokenAdapter,  // Hexing uses the same STS handling
  ITRON_TOKEN:  stsTokenAdapter,
  MANUAL:       manualAdapter,
  CSV_IMPORT:   manualAdapter,    // CSV import lands as a MANUAL reading
  MIKROTIK:     mikrotikAdapter,
};

export function getAdapter(name: string | null): MeterAdapter | null {
  if (!name) return null;
  return REGISTRY[name as AdapterName] ?? null;
}

export function listAdapters(): Array<{ name: string; supportsFetch: boolean; supportsDisconnect: boolean }> {
  return Object.entries(REGISTRY).map(([name, a]) => ({
    name,
    supportsFetch: typeof a.fetchReading === "function",
    supportsDisconnect: typeof a.disconnect === "function",
  }));
}
