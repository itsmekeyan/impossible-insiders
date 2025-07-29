
import datetime
from typing import Dict, List, Any, Optional
from google.cloud import firestore
from google.oauth2.service_account import Credentials
from google.adk.agents import Agent

credentials = Credentials.from_service_account_file('service_account.json')
DB_CLIENT = firestore.Client(
    project="qualified-acre-466511-u6",
    credentials=credentials
)
COLLECTION = DB_CLIENT.collection("incidents")

def summarize_security_concerns(zone_id: Optional[str] = None) -> str:
    """
    Summarizes security concerns from the incidents collection.

    Args:
        zone_id (str, optional): The zone to filter incidents by. Defaults to None.

    Returns:
        str: A summary of security concerns.
    """
    try:
        query = COLLECTION
        print("Got the Zone ID: ", zone_id)
        if zone_id:
            query = query.where("zone_id", "==", zone_id)

        incidents = list(query.stream())

        if not incidents:
            message = "No security concerns found"
            if zone_id:
                message += f" in zone {zone_id}"
            message += "."
            return message

        summary = "Summary of Security Concerns"
        if zone_id:
            summary += f" in zone {zone_id}"
        summary += ":\n"

        for incident_snapshot in incidents:
            data = incident_snapshot.to_dict()
            summary += f"- {data.get('type', 'N/A')} at {data.get('ts', 'N/A')} in zone {data.get('zone_id', 'N/A')} (Severity: {data.get('severity', 'N/A')})\n"

        return summary
    except Exception as e:
        return f"Error summarizing security concerns: {str(e)}" 


class SecurityAgent:
    def __init__(self):
        self.root_agent = Agent(
            name="security_agent",
            model="gemini-2.0-flash",
            description='A helpful, conversational agent that provides detailed, AI-powered situational summaries for crowd safety, including specific incident and location information when requested.',
            instruction=(
                "When asked about security concerns, provide a clear and friendly summary based on the available data. "
                "If a zone is specified, focus your summary on that area. "
                "The available zones are: Zone A, Zone B, Zone C, and Zone D. "
                "Be conversational and thorough in your responses, making sure to highlight important details that may help users understand the situation better."
                "For example, If the user asks about specific incidents, include as much detail as possible, especially the location (zone) and time of each incident. "
            ),
            tools=[summarize_security_concerns],
        )