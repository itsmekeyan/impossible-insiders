from pydantic import BaseModel
from typing import Optional

class CustomerInquiryRequest(BaseModel):
    query: str
    session_id: str

class CustomerInquiryResponse(BaseModel):
    response: str