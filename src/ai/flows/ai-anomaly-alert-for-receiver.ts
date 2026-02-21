'use server';
/**
 * @fileOverview A Genkit flow for detecting anomalies in a visually impaired person's location data
 * and generating a natural language alert for the receiver.
 *
 * - aiAnomalyAlertForReceiver - The main function to call the Genkit flow.
 * - AnomalyAlertInput - The input type for the flow.
 * - AnomalyAlertOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Helper function to calculate distance between two lat/lon points (Haversine formula)
// This is a simplified version, for production use a robust geospatial library.
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

// Helper function to check if a point is inside a polygon
// This is a basic ray-casting algorithm.
function isPointInsidePolygon(point: { lat: number; lon: number }, polygon: { lat: number; lon: number }[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lon, yi = polygon[i].lat;
    const xj = polygon[j].lon, yj = polygon[j].lat;

    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lon < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}


const AnomalyAlertInputSchema = z.object({
  senderCurrentLocation: z.object({
    lat: z.number(),
    lon: z.number(),
    timestamp: z.number(), // Unix timestamp in milliseconds
  }).describe('The current GPS location of the sender including a timestamp.'),
  senderLocationHistory: z.array(z.object({
    lat: z.number(),
    lon: z.number(),
    timestamp: z.number(), // Unix timestamp in milliseconds
  })).describe('An array of recent location history for the sender, ordered from oldest to newest.'),
  safeZonePolygon: z.array(z.object({
    lat: z.number(),
    lon: z.number(),
  })).describe('An array of coordinates defining a polygonal safe zone.').optional(),
  inactivityThresholdMinutes: z.number().min(1).describe('The duration in minutes after which inactivity is considered an anomaly.'),
  safeZoneThresholdMeters: z.number().min(1).describe('The maximum distance in meters to consider movement for inactivity detection.').default(10),
  receiverName: z.string().optional().describe('The name of the receiver for personalization in the alert message.'),
  senderName: z.string().optional().describe('The name of the sender for personalization in the alert message.'),
});
export type AnomalyAlertInput = z.infer<typeof AnomalyAlertInputSchema>;

const AnomalyAlertOutputSchema = z.object({
  alertMessage: z.string().describe('A natural language summary of the detected anomaly.'),
  anomalyDetected: z.boolean().describe('Whether an anomaly was detected.'),
  anomalyType: z.array(z.enum(['inactivity', 'out_of_safe_zone'])).describe('The type(s) of anomaly detected.').optional(),
});
export type AnomalyAlertOutput = z.infer<typeof AnomalyAlertOutputSchema>;

export async function aiAnomalyAlertForReceiver(input: AnomalyAlertInput): Promise<AnomalyAlertOutput> {
  return aiAnomalyAlertForReceiverFlow(input);
}

const anomalyAlertPrompt = ai.definePrompt({
  name: 'anomalyAlertPrompt',
  input: {
    schema: z.object({
      senderCurrentLocationDisplay: z.string().describe('Human-readable current location of the sender.'),
      inactivityDurationMinutes: z.number().optional().describe('Duration of inactivity in minutes, if detected.'),
      isOutsideSafeZone: z.boolean().describe('True if the sender is currently outside the defined safe zone.'),
      safeZoneDescription: z.string().optional().describe('A description of the safe zone, e.g., "home area".'),
      receiverName: z.string().optional().describe('The name of the receiver.'),
      senderName: z.string().optional().describe('The name of the sender.'),
      anomalyDetected: z.boolean().describe('Indicates if any anomaly was detected by the system logic.'),
      anomalyTypesDetected: z.array(z.enum(['inactivity', 'out_of_safe_zone'])).describe('The types of anomalies detected by the system logic.').optional(),
    })
  },
  output: { schema: AnomalyAlertOutputSchema },
  prompt: `You are an AI assistant designed to generate urgent alerts for a receiver tracking a visually impaired person.\nYour goal is to summarize potential risk situations based on location data in a clear, natural, and actionable language in Turkish.\n\nHere is the current status:\n{{#if senderName}}\n{{senderName}} şu anda: {{{senderCurrentLocationDisplay}}}.\n{{else}}\nTakip ettiğiniz kişi şu anda: {{{senderCurrentLocationDisplay}}}.\n{{/if}}\n\n{{#if inactivityDurationMinutes}}\nYaklaşık {{inactivityDurationMinutes}} dakikadır bu konumda önemli bir hareketlilik olmadan duruyor.\n{{/if}}\n\n{{#if isOutsideSafeZone}}\nBu konum, belirlenen güvenli alan{{#if safeZoneDescription}} ({{safeZoneDescription}} olarak tanımlanan){{/if}} dışındadır.\n{{/if}}\n\n{{#if anomalyDetected}}\nYukarıdaki bilgilere dayanarak, durumu özetleyen ve hızlı müdahale gerektiren kısa ve acil bir uyarı mesajı oluşturun.\n{{else}}\nTüm veriler normal görünüyor. Lütfen takip edilen kişinin güvende olduğunu belirten kısa bir onay mesajı oluşturun.\n{{/if}}\n\nYanıtınız, aşağıdaki şemaya kesinlikle uyan bir JSON nesnesi OLMALIDIR. Lütfen 'anomalyDetected' ve 'anomalyType' alanlarını sağlanan bilgilere göre doğru bir şekilde ayarlayın.\nOutput Schema:\n\`\`\`json\n{{json (zod-to-json-schema AnomalyAlertOutputSchema)}}\n\`\`\`\n`
});

const aiAnomalyAlertForReceiverFlow = ai.defineFlow(
  {
    name: 'aiAnomalyAlertForReceiverFlow',
    inputSchema: AnomalyAlertInputSchema,
    outputSchema: AnomalyAlertOutputSchema,
  },
  async (input) => {
    const {
      senderCurrentLocation,
      senderLocationHistory,
      safeZonePolygon,
      inactivityThresholdMinutes,
      safeZoneThresholdMeters,
      receiverName,
      senderName,
    } = input;

    let anomalyDetected = false;
    const anomalyTypes: Array<'inactivity' | 'out_of_safe_zone'> = [];
    let detectedInactivityDurationMinutes: number | undefined;
    let isOutsideSafeZone = false;

    // 1. Check for inactivity
    // Only proceed if there's enough history to check for inactivity over the threshold.
    if (senderLocationHistory.length > 0) {
      const timeThresholdMillis = inactivityThresholdMinutes * 60 * 1000;
      // Filter locations within the threshold window ending at current location's timestamp
      const relevantLocations = senderLocationHistory.filter(loc =>
        senderCurrentLocation.timestamp - loc.timestamp <= timeThresholdMillis
      );
      relevantLocations.push(senderCurrentLocation); // Add current location to the check

      // Ensure we have at least two points to calculate movement and cover the time threshold
      if (relevantLocations.length > 1) {
        const oldestRelevantTimestamp = relevantLocations[0].timestamp;
        const newestRelevantTimestamp = relevantLocations[relevantLocations.length - 1].timestamp;

        // Calculate total distance moved within the relevant period
        let totalDistanceMoved = 0;
        for (let i = 1; i < relevantLocations.length; i++) {
          const prevLoc = relevantLocations[i - 1];
          const currentLoc = relevantLocations[i];
          totalDistanceMoved += calculateDistance(prevLoc.lat, prevLoc.lon, currentLoc.lat, currentLoc.lon);
        }

        // Check if the total movement is below the threshold and the duration covers the inactivity threshold
        if (totalDistanceMoved < safeZoneThresholdMeters && (newestRelevantTimestamp - oldestRelevantTimestamp) >= timeThresholdMillis) {
          anomalyDetected = true;
          anomalyTypes.push('inactivity');
          detectedInactivityDurationMinutes = Math.floor((newestRelevantTimestamp - oldestRelevantTimestamp) / (60 * 1000));
        }
      }
    }


    // 2. Check if out of safe zone
    if (safeZonePolygon && safeZonePolygon.length >= 3) { // Polygon needs at least 3 points
      if (!isPointInsidePolygon(senderCurrentLocation, safeZonePolygon)) {
        anomalyDetected = true;
        anomalyTypes.push('out_of_safe_zone');
        isOutsideSafeZone = true;
      }
    }

    const senderCurrentLocationDisplay = `${senderCurrentLocation.lat.toFixed(4)} N, ${senderCurrentLocation.lon.toFixed(4)} E`;
    const safeZoneDescription = "belirlenen güvenli alan"; // A generic description, could be made dynamic if available in input.

    const { output } = await anomalyAlertPrompt({
      senderCurrentLocationDisplay,
      inactivityDurationMinutes: detectedInactivityDurationMinutes,
      isOutsideSafeZone,
      safeZoneDescription: isOutsideSafeZone ? safeZoneDescription : undefined,
      receiverName,
      senderName,
      anomalyDetected, // Pass this to prompt to help guide message generation
      anomalyTypesDetected: anomalyTypes, // Pass this to prompt to help guide message generation
    });

    if (!output) {
      throw new Error('Failed to generate anomaly alert message.');
    }

    // Trust the flow's detection for 'anomalyDetected' and 'anomalyType'
    // but use the LLM's `alertMessage`.
    return {
      alertMessage: output.alertMessage,
      anomalyDetected: anomalyDetected, // Use the flow's calculated value
      anomalyType: anomalyTypes.length > 0 ? anomalyTypes : undefined, // Use the flow's calculated value
    };
  }
);
