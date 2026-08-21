import os
import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from fastapi import UploadFile, HTTPException
import httpx

from app.config import groq_client, supabase_client, GROQ_API_KEY, MAKE_WEBHOOK_URL, logger

# ---------------------------------------------------------------------------
# Cost-per-action-type estimates (ms), used by the Risk Agent to compute a
# deterministic pipeline latency instead of asking the LLM to guess a number.
# ---------------------------------------------------------------------------
_ACTION_COST_MS = {
    "calendar": 200,
    "task": 150,
    "communication": 300,
}


async def transcribe_audio_service(file: UploadFile) -> str:
    """
    Transcription Agent: converts audio bytes to text using Groq Whisper-v3 LPU.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Invalid audio file upload.")

    filename = file.filename
    _, ext = os.path.splitext(filename.lower())
    supported_extensions = {".mp3", ".wav", ".m4a", ".webm", ".ogg"}
    if ext not in supported_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension: '{ext}'. Supported extensions: {', '.join(supported_extensions)}"
        )

    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API Key is not configured on the server.")

    try:
        audio_data = await file.read()
        transcription = groq_client.audio.transcriptions.create(
            file=(filename, audio_data),
            model="whisper-large-v3",
            response_format="json"
        )
        return transcription.text
    except Exception as e:
        logger.error(f"Audio transcription service failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Audio transcription failed: {str(e)}")


# ---------------------------------------------------------------------------
# Intent Agent — first LLM pass. Splits the raw transcript into discrete
# operational intents. Deliberately does NOT decide risk/confidence/conflicts;
# that's the Risk Agent's and Calendar Agent's job downstream, so each model
# call stays focused on one concern.
# ---------------------------------------------------------------------------
async def _intent_agent(text: str, current_utc_time: str) -> dict:
    system_prompt = (
        "You are the Intent Agent in a multi-agent operations pipeline.\n"
        "Your ONLY job is to read the user's raw transcript and split it into discrete, structured operational actions.\n"
        f"The current UTC date and time is: {current_utc_time}.\n"
        "Use this to resolve relative dates/times (e.g. 'tomorrow at 3 PM', 'next Monday', 'in 2 hours') into "
        "accurate absolute ISO-8601 timestamps (format: YYYY-MM-DDTHH:MM:SSZ).\n\n"
        "Respond with strict JSON only, matching this schema:\n"
        "{\n"
        '  "summary": "Concise 1-2 sentence executive summary of the requested actions",\n'
        '  "actions": [\n'
        '    {"type": "calendar", "title": "...", "start_time": "YYYY-MM-DDTHH:MM:SSZ", "duration_minutes": 30},\n'
        '    {"type": "task", "board": "Trello", "title": "...", "priority": "High | Medium | Low"},\n'
        '    {"type": "communication", "channel": "email | slack", "recipient": "...", "subject": "...", "body": "..."}\n'
        "  ]\n"
        "}\n\n"
        "Defaults when parameters are omitted: calendar duration 30 minutes, task priority 'Medium', "
        "communication channel 'email'. Do not include any risk, confidence, or conflict fields — "
        "those are computed by downstream agents. Output valid JSON only."
    )

    completion = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ],
        response_format={"type": "json_object"}
    )
    response_content = completion.choices[0].message.content
    if not response_content:
        raise ValueError("Empty response received from Intent Agent.")
    return json.loads(response_content)


# ---------------------------------------------------------------------------
# Calendar Agent — real (non-hallucinated) conflict detection + autonomous
# rescheduling. Checks each proposed calendar action against events the
# frontend already knows about (existing_events) plus other calendar actions
# in the same batch, and if it overlaps, walks forward in 15-minute steps
# (09:00-19:00 business hours) until it finds a free slot.
# ---------------------------------------------------------------------------
def _parse_dt(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def _overlaps(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    return start_a < end_b and start_b < end_a


def _find_conflict(start: datetime, end: datetime, busy: List[Tuple[str, datetime, datetime]]) -> Optional[str]:
    for title, busy_start, busy_end in busy:
        if _overlaps(start, end, busy_start, busy_end):
            return title
    return None


def _find_next_free_slot(start: datetime, duration_minutes: int, busy: List[Tuple[str, datetime, datetime]]) -> datetime:
    candidate = start
    step = timedelta(minutes=15)
    duration = timedelta(minutes=duration_minutes)
    for _ in range(192):  # up to ~2 days of 15-min steps
        if 9 <= candidate.hour < 19:
            if _find_conflict(candidate, candidate + duration, busy) is None:
                return candidate
        candidate += step
        if candidate.hour >= 19:
            candidate = (candidate + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
    return candidate


async def _calendar_agent(action: dict, busy: List[Tuple[str, datetime, datetime]]) -> Tuple[dict, Optional[str]]:
    action = dict(action)
    action.setdefault("duration_minutes", 30)
    start = _parse_dt(action.get("start_time", ""))

    if start is None:
        action["reasoning"] = "Could not parse a valid timestamp for this event; dispatched as-is for manual review."
        action["rescheduled"] = False
        return action, "Unparseable start_time — flagged for manual review."

    duration = action.get("duration_minutes", 30)
    end = start + timedelta(minutes=duration)
    conflict_title = _find_conflict(start, end, busy)

    if conflict_title is None:
        action["start_time"] = start.strftime("%Y-%m-%dT%H:%M:%SZ")
        action["reasoning"] = f"Checked against {len(busy)} known event(s); no overlap found. Slot confirmed as requested."
        action["rescheduled"] = False
        busy.append((action["title"], start, end))
        return action, None

    new_start = _find_next_free_slot(start, duration, busy)
    new_end = new_start + timedelta(minutes=duration)
    conflict_note = (
        f"'{action.get('title', 'Event')}' conflicted with '{conflict_title}' at "
        f"{start.strftime('%Y-%m-%d %H:%M UTC')} — auto-rescheduled to {new_start.strftime('%Y-%m-%d %H:%M UTC')}."
    )
    action["reasoning"] = (
        f"Original time overlapped with '{conflict_title}'. Autonomously moved to the next free "
        f"business-hours slot at {new_start.strftime('%Y-%m-%d %H:%M UTC')} without requiring user input."
    )
    action["start_time"] = new_start.strftime("%Y-%m-%dT%H:%M:%SZ")
    action["rescheduled"] = True
    busy.append((action["title"], new_start, new_end))
    return action, conflict_note


# ---------------------------------------------------------------------------
# Task Agent & Communication Agent — lightweight specialist enrichers.
# They don't need a full LLM round-trip; they attach a human-readable
# rationale for the routing decision the Intent Agent already made.
# ---------------------------------------------------------------------------
async def _task_agent(action: dict) -> dict:
    action = dict(action)
    action.setdefault("board", "Trello")
    action.setdefault("priority", "Medium")
    action["reasoning"] = (
        f"Routed to the '{action['board']}' board at {action['priority']} priority based on "
        f"urgency language detected in the transcript."
    )
    return action


async def _communication_agent(action: dict) -> dict:
    action = dict(action)
    action.setdefault("channel", "email")
    if action["channel"] == "slack":
        action["reasoning"] = f"Routed to Slack ({action.get('recipient', '#channel')}) for immediate team visibility."
    else:
        action["reasoning"] = f"Drafted as an email to {action.get('recipient', 'recipient')} for a formal, written record."
    return action


# ---------------------------------------------------------------------------
# Risk Agent — second LLM pass. Evaluates the ALREADY-enriched action set
# (post conflict-resolution) for safety/confidence, so it reasons over ground
# truth rather than guessing at conflicts itself.
# ---------------------------------------------------------------------------
async def _risk_agent(text: str, summary: str, actions: List[dict], conflict_notes: List[str]) -> dict:
    system_prompt = (
        "You are the Risk Agent, the final safety gate in a multi-agent operations pipeline.\n"
        "You receive the original user transcript, an executive summary, and the FINAL enriched action set "
        "(already conflict-checked and rescheduled by upstream specialist agents). Your job is to assess "
        "overall confidence and risk — not to re-derive scheduling.\n\n"
        "Respond with strict JSON only, matching this schema:\n"
        "{\n"
        '  "confidence_score": 0.95, // 0.0-1.0, based on transcript clarity/ambiguity\n'
        '  "risk_level": "LOW | MEDIUM | CRITICAL", // CRITICAL for financial/credential actions or severe data ops; '
        'MEDIUM for external emails or highly ambiguous requests; LOW otherwise\n'
        '  "requires_human_confirmation": false, // true if risk_level is MEDIUM/CRITICAL or conflicts were detected\n'
        '  "risk_reasoning": "One or two sentences citing the specific action(s) that drove this rating"\n'
        "}\n\nOutput valid JSON only."
    )

    user_payload = json.dumps({
        "original_transcript": text,
        "summary": summary,
        "actions": actions,
        "conflicts_detected": conflict_notes,
    })

    completion = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_payload}
        ],
        response_format={"type": "json_object"}
    )
    response_content = completion.choices[0].message.content
    if not response_content:
        raise ValueError("Empty response received from Risk Agent.")
    result = json.loads(response_content)

    if conflict_notes and not result.get("requires_human_confirmation"):
        result["requires_human_confirmation"] = True

    return result


async def parse_actions_service(text: str, existing_events: Optional[List[dict]] = None) -> dict:
    """
    Multi-Agent Orchestrator:
      Intent Agent -> [Calendar Agent | Task Agent | Communication Agent] (specialist enrichment)
                    -> Risk Agent (final safety gate)
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty.")

    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API Key is not configured on the server.")

    current_utc_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    agent_trace = []

    try:
        # 1. Intent Agent
        intent_result = await _intent_agent(text, current_utc_time)
        agent_trace.append("Intent Agent")

        summary = intent_result.get("summary", "")
        raw_actions = intent_result.get("actions", [])
        if not isinstance(raw_actions, list):
            raise ValueError("Intent Agent returned a malformed actions list.")

        # Seed the calendar's known-busy list with events the frontend already
        # knows about (from dispatch history), so conflicts are checked against
        # real prior commitments, not just this batch.
        busy: List[Tuple[str, datetime, datetime]] = []
        for ev in (existing_events or []):
            ev_start = _parse_dt(ev.get("start_time", ""))
            if ev_start:
                ev_dur = ev.get("duration_minutes", 30)
                busy.append((ev.get("title", "Existing event"), ev_start, ev_start + timedelta(minutes=ev_dur)))

        calendar_raw = [a for a in raw_actions if a.get("type") == "calendar"]
        other_raw = [a for a in raw_actions if a.get("type") != "calendar"]

        # 2a. Calendar Agent — sequential, since each new booking affects the
        # next conflict check (shared `busy` state).
        conflict_notes: List[str] = []
        calendar_enriched: List[dict] = []
        if calendar_raw:
            agent_trace.append("Calendar Agent")
            for action in calendar_raw:
                enriched, conflict_note = await _calendar_agent(action, busy)
                calendar_enriched.append(enriched)
                if conflict_note:
                    conflict_notes.append(conflict_note)

        # 2b. Task Agent + Communication Agent — independent of each other and
        # of the calendar's shared state, so they run concurrently.
        other_tasks = []
        for action in other_raw:
            if action.get("type") == "task":
                other_tasks.append(_task_agent(action))
            elif action.get("type") == "communication":
                other_tasks.append(_communication_agent(action))
            else:
                other_tasks.append(asyncio.sleep(0, result=action))

        if any(a.get("type") == "task" for a in other_raw):
            agent_trace.append("Task Agent")
        if any(a.get("type") == "communication" for a in other_raw):
            agent_trace.append("Communication Agent")

        other_enriched = list(await asyncio.gather(*other_tasks)) if other_tasks else []

        all_actions = calendar_enriched + other_enriched

        # 3. Risk Agent — final safety gate, reasoning over the enriched set.
        agent_trace.append("Risk Agent")
        risk_result = await _risk_agent(text, summary, all_actions, conflict_notes)

        estimated_ms = sum(_ACTION_COST_MS.get(a.get("type"), 150) for a in all_actions) or 150

        meta = {
            "confidence_score": risk_result.get("confidence_score", 0.9),
            "risk_level": risk_result.get("risk_level", "LOW"),
            "requires_human_confirmation": risk_result.get("requires_human_confirmation", False),
            "estimated_execution_time_ms": estimated_ms,
            "schedule_conflicts": conflict_notes,
            "risk_reasoning": risk_result.get("risk_reasoning", ""),
            "agent_trace": agent_trace,
        }

        return {"summary": summary, "actions": all_actions, "meta": meta}

    except json.JSONDecodeError as jde:
        logger.error(f"JSON parsing of an agent response failed: {str(jde)}")
        raise HTTPException(
            status_code=500,
            detail="One of the AI agents generated an invalid JSON response structure."
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Multi-agent action parsing pipeline failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Action parsing failed: {str(e)}"
        )


async def dispatch_actions_service(summary: str, raw_transcript: Optional[str], actions: List[dict], meta: Optional[dict] = None) -> dict:
    """
    Service to execute webhook dispatch and database audit logging.
    """
    webhook_dispatched = False
    logged_to_db = False
    status = "dispatched"

    # 1. Dispatch to Make Webhook
    if MAKE_WEBHOOK_URL:
        payload = {
            "summary": summary,
            "raw_transcript": raw_transcript,
            "actions": actions,
            "meta": meta or {}
        }

        # Log exact webhook payload in server terminal for debugging during hackathon demos
        logger.info(f"Dispatching payload to Make Webhook. Payload content:\n{json.dumps(payload, indent=2)}")

        # Retry logic with exponential backoff (2 retries max, total 3 attempts)
        max_retries = 2
        retry_delay = 1.0  # seconds

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                for attempt in range(max_retries + 1):
                    try:
                        response = await client.post(
                            MAKE_WEBHOOK_URL,
                            json=payload,
                            headers={"Content-Type": "application/json"}
                        )

                        # Log response status in server terminal
                        logger.info(f"Make Webhook attempt {attempt + 1} response status: {response.status_code}")

                        # If status is successful (e.g. 200), handle response
                        if response.status_code == 200:
                            webhook_dispatched = True
                            logger.info("Successfully dispatched payload to Make webhook.")
                            break

                        # If status code is 429 or 5xx, retry with backoff
                        elif response.status_code == 429 or (500 <= response.status_code < 600):
                            if attempt < max_retries:
                                logger.warning(f"Make Webhook returned status {response.status_code}. Retrying in {retry_delay}s (Attempt {attempt + 1}/{max_retries})...")
                                await asyncio.sleep(retry_delay)
                                retry_delay *= 2  # Exponential backoff
                            else:
                                response.raise_for_status()
                        else:
                            response.raise_for_status()

                    except (httpx.HTTPStatusError, httpx.RequestError) as err:
                        if attempt < max_retries:
                            logger.warning(f"Connection/HTTP error on attempt {attempt + 1}: {str(err)}. Retrying in {retry_delay}s...")
                            await asyncio.sleep(retry_delay)
                            retry_delay *= 2
                        else:
                            raise err
        except httpx.HTTPStatusError as hse:
            logger.error(f"Make Webhook HTTP error: {hse.response.status_code} - {hse.response.text}")
            status = "failed"
        except httpx.RequestError as re:
            logger.error(f"Make Webhook request failed: {str(re)}")
            status = "failed"
        except Exception as e:
            logger.error(f"Make Webhook dispatch failure: {str(e)}")
            status = "failed"
    else:
        logger.info("Make Webhook URL is not configured. Webhook step skipped.")

    # 2. Log payload to Supabase
    if supabase_client:
        try:
            log_data = {
                "summary": summary,
                "raw_transcript": raw_transcript or "",
                "actions_count": len(actions),
                "payload": {
                    "actions": actions,
                    "meta": meta or {}
                },
                "status": status,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            # Wrap database execution to protect client flows
            supabase_client.table("action_logs").insert(log_data).execute()
            logged_to_db = True
            logger.info("Successfully logged action execution to Supabase.")
        except Exception as db_err:
            logger.error(f"Supabase logging failed: {str(db_err)}")
    else:
        logger.info("Supabase client not initialized. Database logging skipped.")

    return {
        "status": "success" if status == "dispatched" else "failed",
        "webhook_dispatched": webhook_dispatched,
        "logged_to_db": logged_to_db,
        "actions_count": len(actions),
        "message": "All actions successfully dispatched to execution router." if status == "dispatched" else "Dispatch failed due to webhook connection/status error."
    }
