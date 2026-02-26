/**
 * Segment config for NIFTY, BANKNIFTY, SENSEX, MIDCPNIFTY
 * Angel One tokens from OpenAPIScripMaster.json
 * NSE option chain: NIFTY, BANKNIFTY, MIDCPNIFTY (SENSEX is BSE - no NSE option chain)
 */

export type SegmentId = "NIFTY" | "BANKNIFTY" | "SENSEX" | "MIDCPNIFTY";

export interface SegmentConfig {
  id: SegmentId;
  label: string;
  nseSymbol: string; // NSE option chain symbol (empty if not available)
  angelToken: string;
  angelSymbol: string; // tradingsymbol for LTP
  angelPCRFilter: (tradingSymbol: string) => boolean;
  exchange: "NSE" | "BSE";
  strikeStep: number;
  fallbackLTP: number; // demo/fallback when LTP fails
}

export const SEGMENTS: SegmentConfig[] = [
  {
    id: "NIFTY",
    label: "NIFTY 50",
    nseSymbol: "NIFTY",
    angelToken: "99926000",
    angelSymbol: "NIFTY",
    angelPCRFilter: (s) => {
      const u = s.toUpperCase();
      return u.startsWith("NIFTY") && !u.includes("BANK") && !u.includes("MIDCP");
    },
    exchange: "NSE",
    strikeStep: 50,
    fallbackLTP: 25500,
  },
  {
    id: "BANKNIFTY",
    label: "BANK NIFTY",
    nseSymbol: "BANKNIFTY",
    angelToken: "99926009",
    angelSymbol: "BANKNIFTY",
    angelPCRFilter: (s) => {
      const u = s.toUpperCase();
      return u.includes("BANKNIFTY") || u.includes("NIFTY BANK");
    },
    exchange: "NSE",
    strikeStep: 100,
    fallbackLTP: 61000,
  },
  {
    id: "SENSEX",
    label: "SENSEX",
    nseSymbol: "", // BSE index - no NSE option chain
    angelToken: "99926037",
    angelSymbol: "SENSEX",
    angelPCRFilter: (s) => s.toUpperCase().includes("SENSEX"),
    exchange: "BSE",
    strikeStep: 100,
    fallbackLTP: 82500,
  },
  {
    id: "MIDCPNIFTY",
    label: "Nifty Midcap",
    nseSymbol: "MIDCPNIFTY",
    angelToken: "99926010",
    angelSymbol: "MIDCPNIFTY",
    angelPCRFilter: (s) => {
      const u = s.toUpperCase();
      return u.includes("MIDCPNIFTY") || u.includes("NIFTY MIDCAP");
    },
    exchange: "NSE",
    strikeStep: 25,
    fallbackLTP: 12500,
  },
];

export function getSegment(id: SegmentId): SegmentConfig {
  const s = SEGMENTS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown segment: ${id}`);
  return s;
}
