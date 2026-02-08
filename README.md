# Medical Clinic VoiceBot - Appointment Booking System

## Demo Video

Watch the application in action: [View Demo Video](https://drive.google.com/file/d/1-tKkApfgpHLQlfD0uBHMJi-vz9IxMsPh/view?usp=sharing)

## Project Overview

The Medical Clinic VoiceBot is a voice-enabled appointment booking system designed to make scheduling medical appointments simple and hands-free. Instead of typing, patients can simply speak naturally into their microphone to book an appointment. The system uses advanced AI and speech recognition technology to understand human language and extract appointment details automatically.

## What This Project Does

This application allows patients to book medical appointments by speaking naturally. For example, a patient can say something like:

- "My name is John Smith, I want to book an appointment on February 9th at 2 PM"
- "Please schedule me for tomorrow at 10 in the morning, my name is Sarah Johnson"
- "I'm Ahmed Al-Rashid, can I get an appointment on March 15 at 3:30?"

The system will process this voice input, extract the appointment details (name, date, and time), and create a booking confirmation.

## Key Features

### 1. Voice Input Recognition

- Uses the Web Speech API to capture voice input from the browser
- Works primarily in Chrome and Chrome-based browsers
- Automatically detects when the user has finished speaking
- Shows real-time status updates during the conversation

### 2. Intelligent Data Extraction

The system uses two methods to extract appointment information:

- **Primary Method (AI-Powered)**: Uses Google Gemini Pro AI to understand freeform text naturally. This handles complex sentences and variations in how people speak.
- **Fallback Method (Pattern-Based)**: If the AI service is unavailable, the system uses regular expressions to find dates, times, and names from the text.

### 3. Interactive Conversation

- The system guides the user through each step (name, date, time)
- If a field is missing, it asks follow-up questions
- Allows users to retry or correct information
- Shows confirmation of the extracted data before finalizing the booking

### 4. Appointment Management

- Stores bookings with a unique ID
- Records the exact time the appointment was created
- Provides a receipt that can be downloaded
- Uses in-memory storage (suitable for demonstration purposes)

## Technical Architecture

### Backend (FastAPI)

The backend is built with **FastAPI**, a modern Python web framework that provides high performance and automatic API documentation.

**Key Components:**

| Component              | Purpose                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| **Gemini AI Parser**   | Calls Google's Gemini Pro API to intelligently extract appointment details from user speech |
| **Fallback Parser**    | Uses regex patterns to extract details if the AI service fails                              |
| **Booking API**        | Receives booking requests and stores them in memory                                         |
| **Template Rendering** | Serves the HTML interface to users                                                          |
| **Static File Server** | Delivers CSS and JavaScript files to the browser                                            |

### Frontend (HTML + JavaScript)

The user interface is a single-page application that handles all voice interaction.

**Key Components:**

| Component                  | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| **Web Speech API**         | Captures voice input from the microphone                           |
| **Status Updates**         | Shows the user what the system is doing and what input it received |
| **Form Validation**        | Guides the user through each required field (name, date, time)     |
| **Receipt Display**        | Shows the confirmed appointment details                            |
| **Download Functionality** | Allows users to save their receipt as a file                       |

### File Structure

```
voicebot-medical-booking/
├── main.py                 # Backend FastAPI application
├── requirements.txt        # Python dependencies
├── templates/
│   └── index.html         # Main user interface
└── static/
    ├── script.js          # Frontend logic and voice handling
    └── style.css          # User interface styling
```

## How It Works - Step by Step

### The Booking Process

1. **User Clicks "Call"**
   - The browser requests access to the microphone
   - The listening interface becomes active

2. **System Asks for Information**
   - First, it asks: "What is your name?"
   - The user speaks their name
   - The system sends the audio to Google's speech recognition service
   - It converts the speech to text

3. **AI Extracts the Information**
   - The text is sent to the `/ai-parse` endpoint
   - If a Gemini API key is available, the AI analyzes the text and extracts structured data
   - If the AI is unavailable, the fallback parser attempts to extract information using regular expressions
   - The system returns: `{"name": "John Smith", "date": "", "time": ""}`

4. **Follow-up Questions**
   - The system asks: "Thank you John. What date do you want to book?"
   - User responds: "February 9th"
   - The system extracts the date and asks: "What time works for you?"
   - User responds: "2 PM"
   - The system extracts the time

5. **Confirmation and Booking**
   - The system displays all the information for confirmation
   - The user clicks "Confirm" or makes corrections
   - The booking is sent to the `/book` endpoint
   - A unique booking ID is generated
   - A receipt is displayed and can be downloaded

## Technology Stack

### Backend

- **FastAPI 0.128.3** - Web framework for building REST APIs
- **Uvicorn 0.40.0** - ASGI server to run the FastAPI application
- **Pydantic 2.12.5** - Data validation using Python type hints
- **python-dotenv 1.2.1** - Loads environment variables from .env file
- **requests** - HTTP library for calling external APIs

### Frontend

- **HTML5** - Markup for the user interface
- **CSS3** - Styling and responsive design
- **JavaScript (ES6)** - Handles voice interaction and form logic
- **Web Speech API** - Browser's native API for speech recognition

### AI Integration

- **Google Generative AI (Gemini Pro)** - Processes natural language and extracts appointment information

## Setup and Installation

### Prerequisites

- Python 3.8 or higher
- A web browser that supports Web Speech API (Chrome, Edge, Safari)
- A Gemini API key from Google Cloud (optional but recommended)

### Step 1: Clone or Download the Project

```bash
cd d:\voicebot-medical-booking
```

### Step 2: Create a Virtual Environment

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1      # On Windows PowerShell
# or
source .venv/bin/activate         # On Mac/Linux
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 4: Set Up Environment Variables

Create a `.env` file in the project root directory:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

To get a Gemini API key:

1. Visit https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key and paste it into your `.env` file

### Step 5: Run the Application

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The application will start on `http://localhost:8000`

## How to Use

1. **Open the Application**
   - Navigate to `http://localhost:8000` in your browser
   - You should see the "Medical Clinic — Voice Booking" interface

2. **Grant Microphone Permission**
   - Click the "Call" button
   - Your browser will ask for permission to access the microphone
   - Click "Allow"

3. **Speak Naturally**
   - The system will ask for your name - speak your full name
   - Wait for it to process (or it will automatically detect silence)
   - Then it asks for a date - provide the date like "February 9" or "tomorrow"
   - Finally, it asks for a time - say something like "2 PM" or "14:00"

4. **Review and Confirm**
   - Check the information displayed
   - Click "Confirm" if everything is correct
   - Download the receipt if needed

## Environment Variables Explained

| Variable         | Purpose                                                          | Required                                |
| ---------------- | ---------------------------------------------------------------- | --------------------------------------- |
| `GEMINI_API_KEY` | Used to call Google's Gemini Pro API for AI-powered text parsing | No, but recommended for better accuracy |

**Note:** If the `GEMINI_API_KEY` is not set, the system falls back to regex-based parsing, which is less accurate but still functional for basic cases.

## Data Storage

Currently, the application stores bookings in memory using a Python list. This means:

- Bookings are lost when the server restarts
- Bookings are shared across all browser sessions
- No persistent database is used

For production use, you should:

- Set up a database (PostgreSQL, MongoDB, etc.)
- Add database storage to the `/book` endpoint
- Implement authentication to track which patient made which booking

## API Endpoints

### GET `/`

Returns the main HTML interface.

**Response:** HTML page with the booking interface

### POST `/ai-parse`

Processes text using AI to extract appointment information.

**Request Body:**

```json
{
  "text": "My name is John Smith and I want to book on February 9 at 2 PM"
}
```

**Response:**

```json
{
  "name": "John Smith",
  "date": "2026-02-09",
  "time": "14:00"
}
```

### POST `/book`

Creates a new appointment booking.

**Request Body:**

```json
{
  "name": "John Smith",
  "date": "2026-02-09",
  "time": "14:00"
}
```

**Response:**

```json
{
  "status": "ok",
  "booking": {
    "id": "A1B2C3D4",
    "name": "John Smith",
    "date": "2026-02-09",
    "time": "14:00",
    "created_at": "2026-02-08T15:30:45.123456Z"
  }
}
```

## Troubleshooting

### "SpeechRecognition not supported"

- **Problem:** The message appears on page load
- **Solution:** Use Chrome, Edge, or Safari. Firefox and some other browsers don't support Web Speech API

### AI Parser Returns No Results

- **Problem:** The system falls back to regex parsing
- **Cause:** Gemini API key is missing, network error, or API quota exceeded
- **Solution:** Check your `.env` file has the correct API key, check network connection

### Microphone Not Working

- **Problem:** Click "Call" but no listening interface appears
- **Cause:** Browser permission denied or no microphone connected
- **Solution:** Check browser permissions in Settings > Privacy & Security > Microphone

### Booking Not Saved

- **Problem:** Receipt shows but refreshing the page shows no bookings
- **Cause:** Bookings use in-memory storage, not a database
- **Solution:** Implement database storage for persistence (see Data Storage section)

## Future Improvements

- Add a database for persistent booking storage
- Implement user authentication and patient accounts
- Add email or SMS confirmation notifications
- Support multiple languages
- Add appointment confirmation via phone call
- Integrate with actual clinic management systems
- Add doctor/time slot availability checking

## License

This project is provided as-is for educational and demonstration purposes.

## Support

For issues or questions about this project, please refer to the code comments in `main.py` and `static/script.js`, which explain the logic in detail.

---

**Last Updated:** February 8, 2026
**Version:** 1.0.0
