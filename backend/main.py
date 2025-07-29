from fastapi import FastAPI, APIRouter, HTTPException
from models import CustomerInquiryRequest, CustomerInquiryResponse
from google.adk.sessions import DatabaseSessionService
from google.adk.runners import Runner
from multi_tool_agent.agent import SecurityAgent
from google.genai import types
import json
import re
import uuid
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()

# SQLlite DB init
DB_URL = "sqlite:///./multi_agent_data.db"
APP_NAME = "SecurityAgent"

# Create a lifespan event to initialize and clean up the session service
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup code
    print("Application starting up...")    
    # Initialize the DatabaseSessionService instance and store it in app.state
    try:
        app.state.session_service =DatabaseSessionService(db_url=DB_URL)
        print("Database session service initialized successfully.")
    except Exception as e:
        print("Database session service initialized failed.")
        print(e)
    
    yield # This is where the application runs, handling requests
    # Shutdown code
    print("Application shutting down...")
    
# FastAPI application setup
app = FastAPI(
    title="Security Agent",
    description="Multi-agent system for processing security inquiries",
    version="1.0.0",
    lifespan=lifespan,
)
# Initializing the Orchestrator
security_agent = SecurityAgent()
router = APIRouter()

@router.post("/process-inquiry", response_model=CustomerInquiryResponse)
async def process_customer_inquiry(
    request_body: CustomerInquiryRequest
):
    """
    Endpoint to interact with the multi-agent ADK system.
    request_body: {"query": "Whats the update on Zone D"}
    """
    # Extract customer inquiry from request
    customer_inquiry = request_body.query
    
    # Generate unique IDs for this processing session
    user_id = "common-user"

    try:
         # Get database session service from application state
        session_service: DatabaseSessionService = app.state.session_service
        
        # Try to get existing session or create new one
        current_session = None
        try:
            session_id = request_body.session_id
            current_session = await session_service.get_session(
                app_name=APP_NAME,
                user_id = user_id,
                session_id=session_id,
            )
        except Exception as e:
            print(f"Existing Session retrieval failed for session_id='{session_id}' "
                    f"and user_uid='{user_id}': {e}")
        
        # If no session found, creating new session
        if current_session is None:
            current_session = await session_service.create_session(
                app_name=APP_NAME,
                user_id=user_id,
                session_id=session_id,
            )
        else:
            print(f"Existing session '{session_id}'has been found. Resuming session.")

        # Initialize the ADK Runner with our multi-agent pipeline
        runner = Runner(
            app_name=APP_NAME,
            agent=security_agent.root_agent,
            session_service = session_service,
        )


         # Format the user query as a structured message using the google genais content types
        user_message = types.Content(
            role="user", parts=[types.Part.from_text(text=customer_inquiry)]
        )
        
        # Run the agent asynchronously
        events = runner.run_async(
            user_id = user_id,
            session_id = session_id,
            new_message = user_message,
        )

        # Process events to find the final response 
        final_response = None
        last_event_content = None
        async for event in events:
            if event.is_final_response():
                if event.content and event.content.parts:
                    last_event_content = event.content.parts[0].text

        if last_event_content:
            final_response = last_event_content
            print(f"Final response: {final_response}")
        else:
            print("No final response event found from the Sequential Agent.")
    
        # Parse the JSON response from agents
        if final_response is None:
            raise HTTPException(status_code=500, detail="No response received from agent.")
        
        # Return the structured response using your Pydantic model
        return CustomerInquiryResponse(
            response=final_response
        )
               
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process agent query: {e}")
    
# Include the router in the FastAPI app
app.include_router(router, prefix="/api", tags=["Security Agent"])