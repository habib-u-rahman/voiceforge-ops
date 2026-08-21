import os
import time
import json
import httpx
from dotenv import load_dotenv

# Load configuration variables from .env
load_dotenv()

# Retrieve Make Webhook URL
MAKE_WEBHOOK_URL = os.getenv("MAKE_WEBHOOK_URL")

# Test Payloads
SINGLE_INTENT_PAYLOAD = {
    "summary": "Synchronize project task on Trello board",
    "meta": {
        "confidence_score": 0.99,
        "risk_level": "LOW",
        "requires_human_confirmation": False,
        "estimated_execution_time_ms": 150,
        "schedule_conflicts": []
    },
    "actions": [
        {
            "type": "task",
            "board": "Sprint Planning",
            "title": "Update API documentation logs",
            "priority": "Medium"
        }
    ]
}

MULTI_INTENT_PAYLOAD = {
    "summary": "Meeting with Lead Architect, Docker staging prep, and email follow-up",
    "meta": {
        "confidence_score": 0.98,
        "risk_level": "LOW",
        "requires_human_confirmation": False,
        "estimated_execution_time_ms": 320,
        "schedule_conflicts": []
    },
    "actions": [
        {
            "type": "calendar",
            "title": "Architecture Sync",
            "start_time": "2026-08-21T10:00:00Z",
            "duration_minutes": 30
        },
        {
            "type": "task",
            "board": "Engineering Ops",
            "title": "Push Docker staging build",
            "priority": "High"
        },
        {
            "type": "communication",
            "channel": "email",
            "recipient": "lead@voiceforge.ai",
            "subject": "Sync Agenda",
            "body": "Hi team, let's review the staging build."
        }
    ]
}

def print_separator(title: str):
    print("\n" + "=" * 60)
    print(f" {title} ".center(60, "-"))
    print("=" * 60 + "\n")

async def send_payload(url: str, payload: dict, test_description: str, timeout: float = 10.0):
    print(f"Running Test: {test_description}")
    print(f"Target Endpoint: {url}")
    
    start_time = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
        latency = (time.perf_counter() - start_time) * 1000
        
        print(f"HTTP Status Code: {response.status_code}")
        print(f"Latency: {latency:.2f}ms")
        print("Response Headers:")
        for k, v in response.headers.items():
            print(f"  {k}: {v}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 200:
            print("Verdict: SUCCESS [OK]")
        else:
            print("Verdict: SERVER ERROR [FAILED]")
            
    except httpx.TimeoutException:
        print("Verdict: TIMEOUT ERROR [FAILED] (The request exceeded the allotted time limit)")
    except httpx.RequestError as re:
        print(f"Verdict: REQUEST CONNECTION ERROR [FAILED] ({str(re)})")
    except Exception as e:
        print(f"Verdict: UNEXPECTED FAILURE [FAILED] ({str(e)})")

async def main():
    print_separator("VoiceForge Ops - Webhook Automation Test Suite")
    
    if not MAKE_WEBHOOK_URL:
        print("WARNING: MAKE_WEBHOOK_URL is not set in your .env file.")
        print("Tests requiring live connections to Make.com will be skipped.")
    else:
        # 1. Test Single Intent Payload Delivery
        print_separator("TEST 1: Single Intent Action Delivery")
        await send_payload(MAKE_WEBHOOK_URL, SINGLE_INTENT_PAYLOAD, "Single Intent Action (Trello task)")

        # 2. Test Multi-Intent Payload Delivery
        print_separator("TEST 2: Multi-Intent Composite Delivery")
        await send_payload(MAKE_WEBHOOK_URL, MULTI_INTENT_PAYLOAD, "Multi-Intent Actions (Calendar, Trello, Email)")

    # 3. Test Failure Modes: Invalid URL Configuration
    print_separator("TEST 3: Failure Mode - Invalid URL Target")
    bad_url = "http://invalid-endpoint-domain-voiceforge.test/webhook"
    await send_payload(bad_url, MULTI_INTENT_PAYLOAD, "Invalid Host Target Connection Failure")

    # 4. Test Failure Modes: Webhook Timeout Simulation
    print_separator("TEST 4: Failure Mode - Webhook Timeout Threshold")
    # Using an unresponsive port or target to simulate timeout
    timeout_url = "http://10.255.255.1/" # Non-routable IP to force a socket timeout
    await send_payload(timeout_url, MULTI_INTENT_PAYLOAD, "Force Timeout Trigger", timeout=2.0)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
