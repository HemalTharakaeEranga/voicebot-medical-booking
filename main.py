import os
import json
import uuid
import requests
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# In-memory storage for bookings (for demo purposes only)
bookings = []


class Booking(BaseModel):
    name: str
    date: str
    time: str


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# --- Primary parser using Gemini Pro to extract structured data from freeform text ---
def call_gemini_extract(text: str):
    if not GEMINI_API_KEY:
        return None

    prompt = f"""
Extract appointment fields from the user's utterance and return ONLY JSON.
Return exactly one JSON object with keys: "name", "date", "time".
- "name": person's full name or empty string
- "date": ISO date YYYY-MM-DD or empty string
- "time": 24-hour HH:MM or empty string

User utterance:
\"\"\"{text}\"\"\"

Examples:
Input: "My name is John Smith, book on February 9 at 2 pm"
Output: {{"name":"John Smith","date":"2026-02-09","time":"14:00"}}

If you cannot determine a field, set it to an empty string.
Return JSON only.
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={GEMINI_API_KEY}"

    try:
        resp = requests.post(
            url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=10
        )
        resp.raise_for_status()
        data = resp.json()
        # Gemini's response format can be a bit nested; try to extract the text content where the JSON is expected to be
        out = ""
        try:
            out = data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            out = data.get("output", "")
        if "{" in out:
            start = out.find("{")
            end = out.rfind("}") + 1
            json_text = out[start:end]
            try:
                parsed = json.loads(json_text)
                # ensure all keys are present and are strings
                return {
                    "name": parsed.get("name", "") or "",
                    "date": parsed.get("date", "") or "",
                    "time": parsed.get("time", "") or "",
                }
            except Exception:
                return None
        return None
    except Exception:
        return None


# --- Fallback parser using regexes for basic patterns (not as good as Gemini but better than nothing) ---
def fallback_parse(text: str):
    import re

    lower = text.lower()
    result = {"name": "", "date": "", "time": ""}

    # date YYYY-MM-DD
    m = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", lower)
    if m:
        result["date"] = m.group(1)

    months = {
        "january": 1,
        "february": 2,
        "march": 3,
        "april": 4,
        "may": 5,
        "june": 6,
        "july": 7,
        "august": 8,
        "september": 9,
        "october": 10,
        "november": 11,
        "december": 12,
    }
    for name, idx in months.items():
        m = re.search(rf"\b{name}\s+(\d{{1,2}})\b", lower)
        if m and not result["date"]:
            day = int(m.group(1))
            year = datetime.now().year
            result["date"] = f"{year}-{idx:02d}-{day:02d}"
            break

    # time HH:MM or H am/pm
    m = re.search(r"\b([01]?\d|2[0-3])[:\.]([0-5]\d)\b", lower)
    if m:
        result["time"] = f"{int(m.group(1)):02d}:{m.group(2)}"
    else:
        m = re.search(r"\b(\d{1,2})(?:[:\.](\d{2}))?\s*(am|pm)\b", lower)
        if m:
            hour = int(m.group(1))
            mins = int(m.group(2) or 0)
            ampm = m.group(3)
            if ampm == "pm" and hour != 12:
                hour += 12
            if ampm == "am" and hour == 12:
                hour = 0
            result["time"] = f"{hour:02d}:{mins:02d}"

    # name (look for "my name is X" pattern)
    m = re.search(r"my name is\s+([a-zA-Z\s'\-]{2,80})", text, flags=re.IGNORECASE)
    if m:
        result["name"] = " ".join([w.capitalize() for w in m.group(1).strip().split()])
    else:
        # if we couldn't find a name pattern, try to extract leftover words as a naive name guess (not reliable but better than nothing)
        cleaned = lower
        for token in [result["date"], result["time"]]:
            if token:
                cleaned = cleaned.replace(token, "")
        for k in months.keys():
            cleaned = cleaned.replace(k, "")
        cleaned = (
            cleaned.replace("book", "")
            .replace("appointment", "")
            .replace("on", "")
            .replace("at", "")
            .replace("please", "")
            .strip()
        )
        words = [w for w in cleaned.split() if w.isalpha() and len(w) > 1]
        if words:
            result["name"] = " ".join([w.capitalize() for w in words[:3]])

    return result


@app.post("/ai-parse")
async def ai_parse(payload: dict):
    text = payload.get("text", "")
    if not text:
        return JSONResponse({"error": "no text"}, status_code=400)

    parsed = call_gemini_extract(text)
    if parsed:
        return parsed
    # fallback
    fb = fallback_parse(text)
    return fb


@app.post("/book")
async def book_appointment(booking: Booking):
    booking_id = uuid.uuid4().hex[:8].upper()
    timestamp = datetime.utcnow().isoformat() + "Z"
    record = {
        "id": booking_id,
        "name": booking.name,
        "date": booking.date,
        "time": booking.time,
        "created_at": timestamp,
    }
    bookings.append(record)
    return JSONResponse({"status": "ok", "booking": record})
