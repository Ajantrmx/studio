
"use client";

/**
 * Represent a tracking session in the system.
 * Aligned with backend.json entity definitions.
 */
export interface TrackingData {
  id: string; // This is the tracking code (doc ID)
  trackingCode: string;
  transmitterUserId: string;
  isActive: boolean;
  createdAt: string;
  lastKnownLatitude: number;
  lastKnownLongitude: number;
  lastUpdated: string;
  history: { lat: number; lon: number; timestamp: number }[];
}

/**
 * Generates a unique 6-character alphanumeric tracking code.
 */
export function generateTrackingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
