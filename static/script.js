const startBtn = document.getElementById("startBtn");
const cancelBtn = document.getElementById("cancelBtn");
const status = document.getElementById("status");
const receiptEl = document.getElementById("receipt");
const receiptBody = document.getElementById("receiptBody");
const downloadBtn = document.getElementById("downloadBtn");
const errorEl = document.getElementById("error");

let recognition;
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
let booking = { name: "", date: "", time: "" };
let state = "idle";
let retryCounts = { name: 0, date: 0, time: 0 };

// timers for handling silence and max listen time
let silenceTimer = null;
let overallTimer = null;
const SILENCE_MS = 3000; // consider it "silence" if no speech results for 3 seconds - this allows for natural pauses without cutting off too early
const MAX_LISTEN_MS = 15000; // hard max of 15 seconds listening per question to avoid getting stuck forever if something goes wrong with recognition

if (!SpeechRecognition) {
  status.textContent = "SpeechRecognition not supported — use Chrome.";
  startBtn.disabled = true;
} else {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true; // get interim results for better UX
  recognition.maxAlternatives = 1;
  recognition.continuous = false; // we'll handle restarts manually to control timing better
}

function clearListenTimers() {
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  if (overallTimer) {
    clearTimeout(overallTimer);
    overallTimer = null;
  }
}

function startListeningWithSilence() {
  if (!recognition) return;
  recognition.onresult = onRecognitionResult;
  recognition.onerror = onRecognitionError;
  recognition.onend = onRecognitionEnd;

  try {
    recognition.start();
  } catch (e) {
    // can get "recognition has already started" error if start is called multiple times rapidly - ignore this
    console.warn("recognition.start error", e);
  }
  overallTimer = setTimeout(() => {
    try {
      recognition.stop();
    } catch (e) {}
  }, MAX_LISTEN_MS);
}

// track last interim and final results to handle cases where interim keeps changing but final is stable, and to show interim results live
let lastInterim = "";
let lastFinal = "";

function onRecognitionResult(ev) {
  // combine all interim results into one string and all final results into another string
  let interim = "";
  let final = "";
  for (let i = 0; i < ev.results.length; i++) {
    const res = ev.results[i];
    const t = res[0].transcript;
    if (res.isFinal) final += (final ? " " : "") + t;
    else interim += (interim ? " " : "") + t;
  }

  // update trackers - only update final if we got new final text, otherwise keep old final until we get it (handles cases where interim keeps changing but final is stable)
  if (final.trim()) lastFinal = final.trim();
  lastInterim = interim.trim();

  // update status with interim + final (final takes precedence)
  status.textContent = lastFinal || lastInterim || "Listening...";

  // reset silence timer on every result to allow for pauses in speech
  if (silenceTimer) clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => {
    // silence timer hit - stop recognition to process what we have
    try {
      recognition.stop();
    } catch (e) {}
  }, SILENCE_MS);
}

function onRecognitionError(e) {
  console.warn("recognition error", e);
  clearListenTimers();
  // on certain errors, we can retry the same question a couple times before giving up
  if (state === "askName" && retryCounts.name < 2) {
    retryCounts.name++;
    speak("I couldn't hear you. Please say your name.", () => listenAfterTTS());
  } else if (state === "askDate" && retryCounts.date < 2) {
    retryCounts.date++;
    speak("I couldn't hear the date. Please say the appointment date.", () =>
      listenAfterTTS()
    );
  } else if (state === "askTime" && retryCounts.time < 2) {
    retryCounts.time++;
    speak("I couldn't hear the time. Please say the appointment time.", () =>
      listenAfterTTS()
    );
  } else {
    showError("Voice recognition error. Try again.");
  }
}

function onRecognitionEnd() {
  // recognition ended, either from silence timer or manual stop - process what we got
  clearListenTimers();
  const transcript =
    lastFinal && lastFinal.length > 0 ? lastFinal : lastInterim;
  lastFinal = "";
  lastInterim = "";

  if (!transcript || transcript.trim().length === 0) {
    if (state === "askName" && retryCounts.name < 2) {
      retryCounts.name++;
      speak("I didn't catch that. Please say your name.", () =>
        listenAfterTTS()
      );
      return;
    } else if (state === "askDate" && retryCounts.date < 2) {
      retryCounts.date++;
      speak("I didn't catch the date. Please say it again.", () =>
        listenAfterTTS()
      );
      return;
    } else if (state === "askTime" && retryCounts.time < 2) {
      retryCounts.time++;
      speak("I didn't catch the time. Please say it again.", () =>
        listenAfterTTS()
      );
      return;
    } else {
      
      showError("No speech detected. You can try again.");
      return;
    }
  }

 
  handleTranscriptForState(transcript);
}

// small wrapper to wait a short moment then start listening (used after TTS to avoid cutting off speech)
function listenAfterTTS() {
  setTimeout(() => {
    // reset interim trackers
    lastInterim = "";
    lastFinal = "";
    startListeningWithSilence();
  }, 300); // 300ms delay after TTS ends before starting to listen
}

// speak helper with callback when done
function speak(text, callback) {
  status.textContent = text;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 1;
  u.onend = () => {
    if (callback) callback();
  };
  speechSynthesis.speak(u);
}

async function handleTranscriptForState(transcript) {
  transcript = transcript.trim();
  console.log("Processing transcript for state", state, "->", transcript);

  let parsed = null;
  try {
    const res = await fetch("/ai-parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: transcript }),
    });
    parsed = await res.json();
  } catch (err) {
    console.warn("AI parse failed, will use client fallback", err);
  }

  if (state === "askName") {
    booking.name = parsed && parsed.name ? parsed.name : formatName(transcript);
    retryCounts.name = 0;
    await askDate();
    return;
  }

  if (state === "askDate") {
    if (parsed && parsed.date) booking.date = parsed.date;
    else {
      const d = parseSimpleDate(transcript);
      if (d) booking.date = d;
    }

    if (booking.date) {
      retryCounts.date = 0;
      await askTime();
    } else {
      retryCounts.date++;
      if (retryCounts.date < 2) {
        speak("I didn't get the date. Please say it again.", () =>
          listenAfterTTS()
        );
      } else {

        await askTime();
      }
    }
    return;
  }

  if (state === "askTime") {
    if (parsed && parsed.time) booking.time = parsed.time;
    else {
      const t = parseSimpleTime(transcript);
      if (t) booking.time = t;
    }

    if (booking.time) {
      retryCounts.time = 0;
      await confirmAndBook();
    } else {
      retryCounts.time++;
      if (retryCounts.time < 2) {
        speak("I didn't get the time. Please say it again.", () =>
          listenAfterTTS()
        );
      } else {
        await confirmAndBook();
      }
    }
    return;
  }


  console.log("Transcript handled but state unknown.");
}


startBtn.addEventListener("click", () => {
  reset();
  greetAndAskName();
});

cancelBtn.addEventListener("click", () => {
  try {
    if (recognition) recognition.abort();
  } catch (e) {}
  reset();
  status.textContent = "Call canceled.";
});

function greetAndAskName() {
  state = "askName";

  const now = new Date();
  const hr = now.getHours();
  const min = now.getMinutes();
  const timeValue = hr + min / 60;

  let greet = "";

  if (timeValue >= 1 && timeValue < 12) {
    greet = "Good morning";
  } else if (timeValue >= 12 && timeValue < 13) {
    greet = "Good noon";
  } else if (timeValue >= 13 && timeValue < 15) {
    greet = "Good afternoon";
  } else if (timeValue >= 15 && timeValue < 18) {
    greet = "Good evening";
  } else if (timeValue >= 19 && timeValue <= 23.59) {
    greet = "Hope you're having a pleasant evening";
  } else {
    greet = "Hello";
  }

  speak(`${greet}. What is your name?`, () => {
    listenAfterTTS();
  });
}

async function askDate() {
  state = "askDate";
  const spoken = booking.name
    ? `Hello ${booking.name}. What day do you need the appointment?`
    : "What day do you need the appointment?";
  speak(spoken, () => listenAfterTTS());
}

async function askTime() {
  state = "askTime";
  speak("What time would you like the appointment?", () => listenAfterTTS());
}

async function confirmAndBook() {
  state = "confirm";
  const nameSpoken = booking.name || "unknown";
  const dateSpoken = booking.date || "unknown date";
  const timeSpoken = booking.time || "unknown time";
  speak(
    `Confirming appointment for ${nameSpoken} on ${dateSpoken} at ${timeSpoken}. Booking now.`,
    async () => {
      await sendBooking();
    }
  );
}

// booking send
async function sendBooking() {
  try {
    status.textContent = "Saving booking...";
    const res = await fetch("/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking),
    });
    const json = await res.json();
    if (json && json.booking) {
      showReceipt(json.booking);
      speak("Your appointment has been booked. Thank you.");
    } else {
      showError("Booking failed.");
    }
  } catch (err) {
    console.error(err);
    showError("Network error while booking.");
  }
}

function showReceipt(b) {
  receiptEl.classList.remove("hidden");
  const body = [
    `Booking ID: ${b.id}`,
    `Name      : ${b.name}`,
    `Date      : ${b.date}`,
    `Time      : ${b.time}`,
    `Created   : ${b.created_at}`,
  ].join("\n");
  receiptBody.textContent = body;
  status.textContent = "Appointment booked.";
  downloadBtn.onclick = () => {
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt_${b.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
  status.textContent = msg;
}

function reset() {
  state = "idle";
  booking = { name: "", date: "", time: "" };
  receiptEl.classList.add("hidden");
  receiptBody.textContent = "";
  errorEl.classList.add("hidden");
  retryCounts = { name: 0, date: 0, time: 0 };
  clearListenTimers();
  lastInterim = "";
  lastFinal = "";
  status.textContent = "Press Call to begin voice booking.";
}


function formatName(raw) {
  return raw
    .replace(/[^a-zA-Z\s'-]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseSimpleDate(text) {
  text = text.toLowerCase().trim();
  let m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  if (text.includes("today")) {
    const d = new Date();
    return isoDate(d);
  }
  if (text.includes("tomorrow")) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  }
  const months = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };
  let pattern = new RegExp(
    `\\b(${Object.keys(months).join("|")})\\s+(\\d{1,2})\\b`,
    "i"
  );
  m = text.match(pattern);
  if (m) {
    const year = new Date().getFullYear();
    const mon = months[m[1].toLowerCase()];
    const day = parseInt(m[2], 10);
    return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  }
  m = text.match(/\b(\d{1,2})[\/\.\-](\d{1,2})\b/);
  if (m) {
    const mm = parseInt(m[1], 10),
      dd = parseInt(m[2], 10);
    let month = mm,
      day = dd;
    if (mm > 12 && dd <= 12) {
      month = dd;
      day = mm;
    }
    const year = new Date().getFullYear();
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  }
  return null;
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseSimpleTime(text) {
  text = text.toLowerCase().trim();
  let m = text.match(/\b([01]?\d|2[0-3])[:\.]([0-5]\d)\b/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  m = text.match(/\b(\d{1,2})(?:[:\.](\d{2}))?\s*(am|pm)\b/);
  if (m) {
    let h = parseInt(m[1], 10);
    const mins = m[2] ? parseInt(m[2], 10) : 0;
    const p = m[3];
    if (p === "pm" && h !== 12) h += 12;
    if (p === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }
  return null;
}
