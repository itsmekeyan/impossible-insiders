'use server';
/**
 * @fileOverview This file defines a Genkit flow for analyzing event details and predicting risk.
 *
 * It takes event details as input and returns a risk assessment with recommendations.
 * @module get-event-risk-profile
 *
 * - `getEventRiskProfile`: Asynchronous function to initiate the event risk analysis flow.
 * - `GetEventRiskProfileInput`: Interface defining the structure of the input data.
 * - `GetEventRiskProfileOutput`: Interface defining the structure of the output data.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetEventRiskProfileInputSchema = z.object({
  location: z
    .string()
    .describe('The location of the event (e.g., Central Park).'),
  date: z.string().describe('The date of the event (e.g., 2024-08-15).'),
  attendees: z.number().describe('The expected number of attendees.'),
  eventType: z.string().describe('The type of event (e.g., concert, protest).'),
  crazeMultiplier: z
    .number()
    .describe('A multiplier reflecting public excitement (YouTube views, etc.).'),
  areaSquareMeters: z.number().describe('The area of the venue in square meters.'),
});
export type GetEventRiskProfileInput = z.infer<typeof GetEventRiskProfileInputSchema>;

const GetEventRiskProfileOutputSchema = z.object({
  predictedRiskScore: z
    .string()
    .describe('The predicted risk score (Low, Medium, High).'),
  recommendedEntryPoints: z
    .string()
    .describe('Recommended number and location of entry points.'),
  suggestedSecurityPersonnel: z
    .number()
    .describe('Suggested number of security personnel.'),
  suggestedMedicalPersonnel: z
    .number()
    .describe('Suggested number of medical personnel.'),
  suggestedDrones: z.number().describe('Suggested number of drones.'),
  requiredInfrastructure: z
    .string()
    .describe('Necessary infrastructure (barriers, lighting, loudspeakers).'),
  maximumCapacity: z
    .number()
    .describe('The maximum number of people that can be accommodated in the venue, assuming 1 person per square meter.'),
  areaSquareFeet: z.number().describe('The total area of the venue in square feet.'),
  actionChecklist: z
    .array(z.string())
    .describe('A checklist of actions to take for event preparation.'),
});
export type GetEventRiskProfileOutput = z.infer<typeof GetEventRiskProfileOutputSchema>;

const getEventRiskProfilePrompt = ai.definePrompt({
  name: 'getEventRiskProfilePrompt',
  input: {schema: GetEventRiskProfileInputSchema},
  output: {schema: GetEventRiskProfileOutputSchema},
  prompt: `You are an AI agent designed to analyze event details and predict potential risks. Your calculations must follow the rules provided below exactly.

  **Event Information:**
  - Location: {{{location}}}
  - Date: {{{date}}}
  - Expected Attendees: {{{attendees}}}
  - Event Type: {{{eventType}}}
  - Craze Multiplier (0-10): {{{crazeMultiplier}}}
  - Venue Area (Square Meters): {{{areaSquareMeters}}}

  **Calculation Rules:**

  1.  **Predicted Risk Score:**
      - Base the score on the event type (e.g., 'Protest' is higher risk than 'Conference'), number of attendees, and the craze multiplier. A craze multiplier above 7 significantly increases risk.
      - Output one of: "Low", "Medium", or "High".

  2.  **Maximum Capacity:**
      - This is equal to the provided Venue Area in Square Meters.
      - Assume a density of 1 person per square meter.
      - The final number must be an integer.

  3.  **Area in Square Feet:**
      - Convert the provided Venue Area from square meters to square feet.
      - Formula: Area in square feet = ({{{areaSquareMeters}}}) * 10.764.
      - The final number must be an integer.

  4.  **Suggested Security Personnel:**
      - Base calculation: 1 security person for every 100 attendees.
      - Adjustment for risk:
          - Medium Risk: Increase base by 25%.
          - High Risk: Increase base by 50%.
      - Adjustment for craze: Add (crazeMultiplier * 5) to the total.
      - The final number must be an integer.

  5.  **Suggested Medical Personnel:**
      - Base calculation: 1 medical person for every 1,000 attendees.
      - Adjustment for risk:
          - Medium Risk: Increase base by 50%.
          - High Risk: Increase base by 100% (double the base).
      - The final number must be an integer.

  6.  **Suggested Drones:**
      - Base calculation: 2 drones for events with < 50,000 attendees. 4 drones for events with >= 50,000 attendees.
      - Adjustment for risk:
          - Medium Risk: Add 2 drones.
          - High Risk: Add 4 drones.
      - The final number must be an integer.

  7.  **Recommended Entry Points & Infrastructure:**
      - Based on the number of attendees and risk score, recommend a number of entry points and list necessary infrastructure (e.g., barriers, lighting, loudspeakers).
  
  8.  **Action Checklist:**
      - Generate a list of actionable checklist items for the event planner.
      - The checklist should be comprehensive and tailored to the event's risk profile.
      - Include items related to security, medical, infrastructure, and coordination.

  Provide a response strictly following the output schema based on these rules.
`,
});


const getEventRiskProfileFlow = ai.defineFlow(
  {
    name: 'getEventRiskProfileFlow',
    inputSchema: GetEventRiskProfileInputSchema,
    outputSchema: GetEventRiskProfileOutputSchema,
  },
  async input => {
    const {output} = await getEventRiskProfilePrompt(input);
    return output!;
  }
);

export async function getEventRiskProfile(input: GetEventRiskProfileInput): Promise<GetEventRiskProfileOutput> {
  return getEventRiskProfileFlow(input);
}
