
"use client";

// Simple in-memory/local storage mock for tracking data
// In a real app, this would be a Firebase/Socket.io backend

export interface TrackingData {
  id: string;
  lat: number;
  lon: number;
  timestamp: number;
  history: { lat: number; lon: number; timestamp: number }[];
  active: boolean;
}

const STORAGE_KEY = "guvenli_iz_sessions";

export function saveTrackingSession(data: TrackingData) {
  if (typeof window === "undefined") return;
  const sessions = getSessions();
  sessions[data.id] = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getTrackingSession(id: string): TrackingData | null {
  if (typeof window === "undefined") return null;
  const sessions = getSessions();
  return sessions[id] || null;
}

function getSessions(): Record<string, TrackingData> {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
}

export function generateTrackingCode(): string {
  // Simple alphanumeric code generation
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
