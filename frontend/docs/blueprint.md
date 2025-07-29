# **App Name**: EventRiskAI

## Core Features:

- Event Planning Form: Users input event details such as date, location using Google Maps API, expected attendees, and event type via a clear and intuitive form.
- Risk Simulation Agent: AI agent to process event details, access external APIs like Google Maps and YouTube, and compute event risk using a tool
- Interactive Map View: Display of event boundary, crowd density heatmap, and key risk metrics directly on an interactive Google Maps interface.
- YouTube Craze Detection: Fetch craze scores using the YouTube Data API, which the AI uses as a tool for assessing crowd enthusiasm and potential risks.
- Risk Report Summary: Display comprehensive risk assessment results including risk level, overcrowding probability, and a resource action checklist for event planners.
- Firebase Authentication: Role-based access control using Firebase Auth to limit feature access to planner/admin and guest/public roles.
- PDF Report Export: One-click generation of a detailed PDF report that consolidates risk metrics, map visuals, and resource allocation for distribution.

## Style Guidelines:

- Primary color: A deep blue (#3F51B5) to convey trust and authority, reflecting the seriousness of risk assessment.
- Background color: Light gray (#F5F5F5), offering a neutral backdrop to ensure the primary elements stand out.
- Accent color: A vivid orange (#FF5722) to highlight critical risk warnings and action items, drawing immediate attention.
- Font pairing: 'Space Grotesk' (sans-serif) for headers to give a computerized feel, paired with 'Inter' (sans-serif) for body text for a modern, neutral look.
- Use universally recognizable icons for different types of risks (e.g., overcrowding, security threats) with a consistent, minimalist style.
- Utilize a grid-based layout for a structured, easily navigable interface with distinct sections for the map view, risk metrics, and action items.
- Employ subtle animations to draw attention to important real-time updates or changes in risk levels, but avoid overly distracting effects.