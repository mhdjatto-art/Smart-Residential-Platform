import type { MeterAdapter, AdapterResponse, MeterConfig } from "./types";
import { adapterError } from "./types";

/**
 * Modbus TCP adapter — STUB with full design notes.
 *
 * Modbus is a raw industrial protocol. From Vercel serverless we cannot
 * hold long-lived TCP connections, but we CAN issue one-shot read function
 * code 3/4 over plain TCP to a Modbus gateway on the customer's network.
 *
 * Production options:
 *
 *   A) Local Modbus-to-HTTP gateway (recommended)
 *      Deploy a tiny script (Python pymodbus or Node modbus-serial) on a
 *      Raspberry Pi inside the compound's network. It exposes
 *      GET http://gateway.local/meter/<external_id>/reading and uses the
 *      HTTP_REST adapter from SRP's side. No firewall holes.
 *
 *   B) Direct serverless Modbus-TCP from SRP
 *      Open a TCP socket from a Vercel function. Works only if the meter
 *      gateway has a public IP + firewall whitelist. Implementation would
 *      need a small Modbus PDU encoder (function code 3, 4 registers,
 *      Big-Endian Float ABCD). The `node-net` socket API works in Edge
 *      runtime but not Modbus libraries directly.
 *
 *   C) Bridge through an MQTT broker
 *      Use the Pi to publish readings to MQTT; SRP consumes via the MQTT
 *      adapter worker.
 *
 * Config schema (when implemented via option A — HTTP gateway):
 *   {
 *     "endpoint": "http://gateway.compound.local/modbus/{external_id}",
 *     "register":  "0x0100",     // float ABCD register address
 *     "function":  4,             // 3=holding, 4=input
 *     "byte_order": "ABCD",       // ABCD | CDAB | BADC | DCBA
 *     "scale":     1.0            // multiply by scale before storing
 *   }
 *
 * For now this stub returns an error and points to the HTTP_REST adapter.
 */
export const modbusAdapter: MeterAdapter = {
  name: "MODBUS_TCP",
  async fetchReading(_meter: MeterConfig, _secret: string | null): Promise<AdapterResponse> {
    return adapterError(
      "Direct Modbus from serverless is not supported. Deploy a local Modbus→HTTP gateway and configure the HTTP_REST adapter instead.",
      false,
    );
  },
};
