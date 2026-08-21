from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Union

class MetaBlock(BaseModel):
    confidence_score: float = Field(..., description="Understanding confidence score from 0.0 to 1.0")
    risk_level: Literal["LOW", "MEDIUM", "CRITICAL"] = Field(..., description="Calculated risk level of the actions")
    requires_human_confirmation: bool = Field(..., description="Flag to indicate if human verification is required")
    estimated_execution_time_ms: int = Field(..., description="Estimated time to execute these actions in milliseconds")
    schedule_conflicts: List[str] = Field(default_factory=list, description="Details of any detected schedule conflicts")
    risk_reasoning: Optional[str] = Field(default=None, description="Explanation of why the Risk Agent assigned this risk level and confidence")
    agent_trace: List[str] = Field(default_factory=list, description="Ordered list of agents that participated in producing this result")

class ExistingEvent(BaseModel):
    title: str
    start_time: str
    duration_minutes: int = 30

class CalendarAction(BaseModel):
    type: Literal["calendar"]
    title: str
    start_time: str
    duration_minutes: int = 30
    reasoning: Optional[str] = Field(default=None, description="Calendar Agent's explanation for the scheduling decision, including any auto-reschedule")
    rescheduled: bool = False

class TaskAction(BaseModel):
    type: Literal["task"]
    board: str = "Trello"
    title: str
    priority: Literal["High", "Medium", "Low"] = "Medium"
    reasoning: Optional[str] = Field(default=None, description="Task Agent's explanation for the priority/board assignment")

class CommunicationAction(BaseModel):
    type: Literal["communication"]
    channel: Literal["email", "slack"] = "email"
    recipient: str
    subject: str
    body: str
    reasoning: Optional[str] = Field(default=None, description="Communication Agent's explanation for the channel/routing decision")

class DispatchPayload(BaseModel):
    summary: str
    meta: MetaBlock
    raw_transcript: Optional[str] = None
    actions: List[Union[CalendarAction, TaskAction, CommunicationAction]]

class ParseRequest(BaseModel):
    text: str
    existing_events: List[ExistingEvent] = Field(default_factory=list, description="Previously scheduled calendar events, used by the Calendar Agent for real conflict detection")

class SimulatePayload(BaseModel):
    actions: List[dict]
