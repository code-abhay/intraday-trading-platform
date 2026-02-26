/**
 * Segment config for NIFTY, BANKNIFTY, SENSEX, MIDCPNIFTY
 * Angel One tokens from OpenAPIScripMaster.json
 *
 * Weekly expiry days (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat):
 *   NIFTY      → Tuesday  (2)
 *   BANKNIFTY  → Wednesday(3)
 *   SENSEX     → Friday   (5)
 *   MIDCPNIFTY → Monday   (1)
 */

import type { ExpiryDay } from "@/lib/expiry-utils";

export type SegmentId = "NIFTY" | "BANKNIFTY" | "SENSEX" | "MIDCPNIFTY";

export interface SegmentStrategyConfig {
  rsiBullishThreshold: number;
  rsiBearishThreshold: number;
  pcrBullishThreshold: number;
  pcrBearishThreshold: number;
  choppinessThreshold: number;
  biasStrongThreshold: number;
  biasModerateThreshold: number;
  orbBreakoutBufferPct: number;
  cprNarrowThresholdPct: number;
  cprWideThresholdPct: number;
}

export interface SegmentConfig {
  id: SegmentId;
  label: string;
  nseSymbol: string;
  angelToken: string;
  angelSymbol: string;
  angelPCRFilter: (tradingSymbol: string) => boolean;
  exchange: "NSE" | "BSE";
  strikeStep: number;
  lotSize: number;
  fallbackLTP: number;
  expiryDay: ExpiryDay;
  strategy: SegmentStrategyConfig;
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
      return (
        (u.startsWith("NIFTY") || u.startsWith("NIFTY ")) &&
        !u.includes("BANK") &&
        !u.includes("MIDCP") &&
        !u.includes("FIN") &&
        !u.includes("NXT") &&
        !u.includes("IT")
      );
    },
    exchange: "NSE",
    strikeStep: 50,
    lotSize: 65,
    fallbackLTP: 25500,
    expiryDay: 2, // Tuesday
    strategy: {
      rsiBullishThreshold: 52,
      rsiBearishThreshold: 48,
      pcrBullishThreshold: 1.2,
      pcrBearishThreshold: 0.8,
      choppinessThreshold: 61.8,
      biasStrongThreshold: 6,
      biasModerateThreshold: 3,
      orbBreakoutBufferPct: 0.0005,
      cprNarrowThresholdPct: 0.2,
      cprWideThresholdPct: 0.6,
    },
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
    lotSize: 30,
    fallbackLTP: 61000,
    expiryDay: 3, // Wednesday
    strategy: {
      rsiBullishThreshold: 51,
      rsiBearishThreshold: 49,
      pcrBullishThreshold: 1.15,
      pcrBearishThreshold: 0.85,
      choppinessThreshold: 64,
      biasStrongThreshold: 6,
      biasModerateThreshold: 3,
      orbBreakoutBufferPct: 0.0008,
      cprNarrowThresholdPct: 0.25,
      cprWideThresholdPct: 0.75,
    },
  },
  {
    id: "SENSEX",
    label: "SENSEX",
    nseSymbol: "",
    angelToken: "99926037",
    angelSymbol: "SENSEX",
    angelPCRFilter: (s) => s.toUpperCase().includes("SENSEX"),
    exchange: "BSE",
    strikeStep: 100,
    lotSize: 20,
    fallbackLTP: 82500,
    expiryDay: 5, // Friday
    strategy: {
      rsiBullishThreshold: 52,
      rsiBearishThreshold: 48,
      pcrBullishThreshold: 1.15,
      pcrBearishThreshold: 0.85,
      choppinessThreshold: 62.5,
      biasStrongThreshold: 6,
      biasModerateThreshold: 3,
      orbBreakoutBufferPct: 0.0006,
      cprNarrowThresholdPct: 0.22,
      cprWideThresholdPct: 0.65,
    },
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
    lotSize: 120,
    fallbackLTP: 12500,
    expiryDay: 1, // Monday
    strategy: {
      rsiBullishThreshold: 53,
      rsiBearishThreshold: 47,
      pcrBullishThreshold: 1.22,
      pcrBearishThreshold: 0.78,
      choppinessThreshold: 60.5,
      biasStrongThreshold: 6,
      biasModerateThreshold: 3,
      orbBreakoutBufferPct: 0.0007,
      cprNarrowThresholdPct: 0.2,
      cprWideThresholdPct: 0.6,
    },
  },
];

export function getSegment(id: SegmentId): SegmentConfig {
  const s = SEGMENTS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown segment: ${id}`);
  return s;
}
