"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Camera, CameraOff, Check, Clock3, Download, LoaderCircle, Mic, MicOff, Phone, PhoneOff, RotateCcw, Send, Volume2, X } from "lucide-react";
import { botTurnResponseSchema, type BotTurnRequest, type InterviewReport } from "@/lib/interview-bot";
import { savePracticeResult } from "@/lib/local-interviews";

interface RecognitionResult { isFinal: boolean; [index: number]: { transcript: string } }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
type Turn = BotTurnRequest["turns"][number];

export default function InterviewRoom({ interview }: { interview: Interview }) {
  const [phase, setPhase] = useState<"ready" | "active" | "complete">("ready");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [devicesReady, setDevicesReady] = useState(false);
  const [mediaPending, setMediaPending] = useState(false);
  const [micMuted, setMicMuted] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [report, setReport] = useState<InterviewReport | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const cameraVersion = useRef(0);
  const recognition = useRef<Recognition | null>(null);
  const microphoneMuted = useRef(true);
  const speechVersion = useRef(0);
  const mounted = useRef(false);
  const busy = useRef(false);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestController.current?.abort();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (recognition.current) {
        recognition.current.onend = null;
        recognition.current.onresult = null;
        recognition.current.onerror = null;
        recognition.current.abort();
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (phase !== "active") return;
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  function stopListening() {
    const current = recognition.current;
    recognition.current = null;
    current?.abort();
    setListening(false);
  }

  function stopSpeech() {
    speechVersion.current++;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  function stopCamera() {
    cameraVersion.current++;
    const media = stream.current;
    stream.current = null;
    media?.getTracks().forEach((track) => track.stop());
    if (video.current) video.current.srcObject = null;
    setCameraOn(false);
    setDevicesReady(false);
    setMediaPending(false);
    setMicMuted(true);
    microphoneMuted.current = true;
  }

  async function enableDevices() {
    if (mediaPending) return;
    const version = ++cameraVersion.current;
    setNotice("");
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) { setNotice("Camera and microphone access isn’t supported here. Use a supported browser or switch to Solo practice."); return; }
    setMediaPending(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
      if (!mounted.current || version !== cameraVersion.current || !video.current) { media.getTracks().forEach((track) => track.stop()); return; }
      if (!media.getVideoTracks().length || !media.getAudioTracks().length) { media.getTracks().forEach((track) => track.stop()); throw new Error("Both devices are required"); }
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = media;
      video.current.srcObject = media;
      for (const track of media.getTracks()) {
        track.addEventListener("ended", () => {
          if (!mounted.current || stream.current !== media) return;
          stopListening();
          stopCamera();
          setNotice("A camera or microphone disconnected. Re-enable both devices before starting. You can continue an active interview with typed answers.");
        }, { once: true });
      }
      setCameraOn(true);
      setDevicesReady(true);
      setMicMuted(false);
      microphoneMuted.current = false;
    } catch {
      if (mounted.current && version === cameraVersion.current) {
        setDevicesReady(false);
        setNotice("Allow both camera and microphone access before starting. Check the browser’s site permissions, then try again. Solo practice is also available.");
      }
    } finally { if (mounted.current && version === cameraVersion.current) setMediaPending(false); }
  }

  function toggleCamera() {
    if (!stream.current) return;
    const enabled = !cameraOn;
    stream.current.getVideoTracks().forEach((track) => { track.enabled = enabled; });
    setCameraOn(enabled);
  }

  function toggleMicrophone() {
    const muted = !microphoneMuted.current;
    microphoneMuted.current = muted;
    setMicMuted(muted);
    stream.current?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    if (muted) stopListening();
    else if (phase === "active" && !pending && !speaking) listen(question, turns, draft);
  }

  function speak(text: string, onDone?: () => void) {
    stopListening();
    stopSpeech();
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setNotice("Read the interviewer’s message on screen. You can answer by typing or using the microphone button.");
      return;
    }
    const version = speechVersion.current;
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = window.speechSynthesis.getVoices().find((item) => item.localService && item.lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    utterance.lang = "en-US";
    utterance.rate = 0.97;
    utterance.onstart = () => { if (mounted.current && version === speechVersion.current) setSpeaking(true); };
    utterance.onend = () => { if (mounted.current && version === speechVersion.current) { setSpeaking(false); onDone?.(); } };
    utterance.onerror = () => { if (mounted.current && version === speechVersion.current) { setSpeaking(false); setNotice("Audio playback stopped. Read the question and use the microphone or type your answer."); } };
    window.speechSynthesis.speak(utterance);
  }

  function listen(questionText: string, previousTurns: Turn[], base = "") {
    if (busy.current || microphoneMuted.current) return;
    stopListening();
    stopSpeech();
    const Constructor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) { setNotice("Speech recognition isn’t supported here. Type your answer and select Send answer."); return; }
    const instance = new Constructor();
    recognition.current = instance;
    instance.lang = "en-US";
    instance.continuous = false;
    instance.interimResults = true;
    let finalText = "";
    instance.onresult = (event) => {
      if (recognition.current !== instance || !mounted.current) return;
      const results = Array.from(event.results);
      finalText = results.filter((result) => result.isFinal).map((result) => result[0].transcript).join(" ");
      const interim = results.filter((result) => !result.isFinal).map((result) => result[0].transcript).join(" ");
      setDraft([base, finalText, interim].filter(Boolean).join(" ").slice(0, 3000));
    };
    instance.onerror = (event) => {
      if (recognition.current !== instance || !mounted.current) return;
      recognition.current = null;
      setListening(false);
      setNotice(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Microphone permission wasn’t granted. Type your answer to continue." : "The microphone stopped. Try the microphone button again, or type your answer.");
    };
    instance.onend = () => {
      if (recognition.current !== instance || !mounted.current) return;
      recognition.current = null;
      setListening(false);
      const answer = [base, finalText].filter(Boolean).join(" ").trim().slice(0, 3000);
      if (finalText.trim()) void requestTurn("answer", [...previousTurns, { question: questionText, answer }]);
    };
    try { instance.start(); setListening(true); }
    catch { recognition.current = null; setListening(false); setNotice("Couldn’t start the microphone. Type your answer or try the microphone button again."); }
  }

  async function requestTurn(action: BotTurnRequest["action"], nextTurns: Turn[]) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    stopListening();
    stopSpeech();
    const controller = new AbortController();
    requestController.current = controller;
    try {
      const response = await fetch("/api/interview/turn", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45_000)]),
        body: JSON.stringify({ action, role: interview.role, level: interview.level, difficulty: interview.difficulty || "Medium", focus: interview.type, skills: interview.techstack, questionCount: interview.questions.length, turns: nextTurns }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : "The interviewer couldn’t respond. Please retry.");
      const result = botTurnResponseSchema.parse(json);
      if (!mounted.current) return;
      setTurns(nextTurns);
      setReply(result.reply);
      setQuestion(result.nextQuestion);
      setDraft("");
      if (result.complete && result.report) {
        setPhase("complete");
        setReport(result.report);
        stopCamera();
        try { savePracticeResult(interview, result.report); }
        catch { setNotice("Your result is shown here, but browser storage could not save it. Download the report before leaving."); }
        speak(result.reply);
      } else {
        setPhase("active");
        // Release the request lock before the bot finishes speaking and opens the mic.
        busy.current = false;
        speak(result.reply + " " + result.nextQuestion, () => { if (!microphoneMuted.current) listen(result.nextQuestion, nextTurns); });
      }
    } catch (reason) {
      if (!mounted.current) return;
      setError(reason instanceof Error && reason.name !== "TimeoutError" ? reason.message : "The interviewer took too long. Retry when you’re ready; your answer is still here.");
      if (action === "start") stopCamera();
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }

  function begin() {
    if (busy.current || !devicesReady || mediaPending) return;
    setPhase("ready");
    setTurns([]);
    setReply("");
    setQuestion("");
    setDraft("");
    setElapsed(0);
    setReport(null);
    setNotice("");
    void requestTurn("start", []);
  }

  function resetInterview() {
    stopListening();
    stopSpeech();
    stopCamera();
    setPhase("ready");
    setReport(null);
    setTurns([]);
    setQuestion("");
    setReply("");
    setDraft("");
    setElapsed(0);
    setError("");
    setNotice("");
  }

  function submitAnswer() {
    const answer = draft.trim();
    if (!answer || !question || busy.current) return;
    void requestTurn("answer", [...turns, { question, answer }]);
  }

  function endInterview() {
    if (!window.confirm("End and evaluate this mock interview? Unanswered questions will count as zero.")) return;
    const nextTurns = draft.trim() && question ? [...turns, { question, answer: draft.trim() }] : turns;
    void requestTurn("finish", nextTurns);
  }

  function downloadReport() {
    if (!report) return;
    const data = { role: interview.role, difficulty: interview.difficulty || "Medium", date: new Date().toISOString(), ...report, transcript: turns };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "prepwise-interview-result.json"; anchor.click(); URL.revokeObjectURL(url);
  }

  const duration = String(Math.floor(elapsed / 60)).padStart(2, "0") + ":" + String(elapsed % 60).padStart(2, "0");
  const status = pending ? "Interviewer is thinking…" : phase === "complete" ? "Interview complete" : speaking ? "Interviewer is speaking" : listening ? "Listening to your answer" : phase === "active" ? "Your turn" : "Ready to meet your interviewer";

  return <section className="voice-room ai-interview-room" aria-label="One-to-one AI video interview">
    <div className="voice-room-bar"><span className={phase === "active" ? "call-status live" : "call-status"}><i />{status}</span><span className="call-timer"><Clock3 size={13} />{duration}</span></div>
    <div className="participants video-participants"><div className="participant bot-participant"><span className="participant-label">PREPWISE · AI INTERVIEWER</span><div className={speaking ? "bot-avatar is-speaking" : "bot-avatar"}><div className="bot-face"><span /><span /><i /></div></div><h3>Your personal interviewer</h3><p>{pending ? "Considering your response" : speaking ? "Asking, listening, helping you improve" : "One conversation. One step forward."}</p><span className="participant-icon" aria-hidden="true"><AudioLines size={15} /></span></div><div className="participant participant-human candidate-participant"><video ref={video} autoPlay playsInline muted className={cameraOn ? "candidate-video" : "candidate-video hidden-video"} />{!cameraOn && <><span className="human-avatar"><CameraOff size={27} /></span><h3>Your camera preview</h3><p>Camera off · Voice and text still work</p></>}<span className="participant-label candidate-label">YOU · CANDIDATE</span><span className="camera-local-label">Camera stays on your device</span></div></div>
    {phase === "ready" && <div className="device-check"><div><span className="eyebrow">STEP 1 / DEVICE CHECK</span><h3>{devicesReady ? "Your camera and microphone are ready." : "Enable your camera and microphone first."}</h3><p>Allow both devices, check your preview, then start. You can mute your microphone during the interview.</p><div className="device-status"><span className={devicesReady ? "ready" : ""}><Camera size={13} />Camera {devicesReady ? "ready" : "not enabled"}</span><span className={devicesReady ? "ready" : ""}><Mic size={13} />Microphone {devicesReady ? "ready" : "not enabled"}</span></div></div><button className="secondary-button" type="button" onClick={() => void enableDevices()} disabled={mediaPending || devicesReady}>{mediaPending ? <><LoaderCircle size={16} className="spin" />Waiting for permission...</> : devicesReady ? <><Check size={16} />Devices ready</> : <><Camera size={16} />Enable camera & microphone</>}</button></div>}
    {phase === "complete" && report ? <div className="interview-result"><div className={report.verdict === "SELECTED" ? "result-heading selected" : "result-heading rejected"}><span className="result-symbol">{report.verdict === "SELECTED" ? <Check size={29} /> : <X size={29} />}</span><div><span className="eyebrow">YOUR MOCK INTERVIEW RESULT</span><h2>{report.verdict === "SELECTED" ? "Selected" : "Rejected"}<span>{report.score}<small>/100</small></span></h2></div></div><p>{report.summary}</p><div className="score-breakdown">{Object.entries(report.scores).map(([key, score]) => <div key={key}><span>{key === "roleFit" ? "Role fit" : key}</span><strong>{score}<small>/100</small></strong><progress value={score} max={100} aria-label={key + " score"} /></div>)}</div><div className="result-notes"><div><h3>What worked</h3><ul>{report.strengths.length ? report.strengths.map((text) => <li key={text}>{text}</li>) : <li>Complete more answers to demonstrate your strengths.</li>}</ul></div><div><h3>What to work on</h3><ul>{report.improvements.map((text) => <li key={text}>{text}</li>)}</ul></div></div><p className="result-context">Practice outcome only. Selected means a score of 70 or more; this is not a company hiring decision. {report.answered}/{report.total} questions answered.</p><div className="free-practice-actions"><button className="secondary-button" onClick={downloadReport}><Download size={15} />Download report</button><button className="primary-button" onClick={resetInterview}><RotateCcw size={15} />Interview again</button></div></div> : <><div className="bot-conversation" aria-live="polite"><span className="eyebrow">{phase === "ready" ? "ONE CANDIDATE. ONE AI INTERVIEWER." : "QUESTION " + (turns.length + 1) + " OF " + interview.questions.length}</span>{reply && <p className="bot-reply">{reply}</p>}<h2>{question || "A real rehearsal for your next opportunity."}</h2>{phase === "ready" && <p>The bot will ask questions for your {interview.role} role at {interview.difficulty || "Medium"} complexity, respond to your answers, and give you a final Selected or Rejected mock result.</p>}</div>{phase === "active" && <div className="ai-answer"><label htmlFor="candidate-answer">Your answer <span>{micMuted ? "MICROPHONE MUTED" : listening ? "LISTENING" : "SPEAK OR TYPE"}</span></label><textarea id="candidate-answer" rows={4} maxLength={3000} value={draft} disabled={pending} onFocus={stopListening} onChange={(event) => setDraft(event.target.value)} placeholder="Explain your thinking. The interviewer will respond to your answer…" /><div className="answer-actions"><span>{listening ? "Your answer is sent when you finish speaking." : micMuted ? "Microphone muted. You can still type your answer." : "Type and send, or answer by voice."}</span><button className="text-link" disabled={pending || speaking || micMuted || listening} onClick={() => listen(question, turns, draft)}>Answer by voice</button><button className="primary-button" disabled={pending || !draft.trim()} onClick={submitAnswer}><Send size={15} />Send answer</button></div></div>}<div className="video-call-controls">{devicesReady && <><button className="secondary-button" type="button" onClick={toggleCamera} aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}>{cameraOn ? <Camera size={17} /> : <CameraOff size={17} />}</button><button className={micMuted ? "secondary-button" : "secondary-button mic-active"} type="button" onClick={toggleMicrophone} aria-label={micMuted ? "Unmute microphone" : "Mute microphone"} aria-pressed={micMuted}>{micMuted ? <MicOff size={17} /> : <Mic size={17} />}</button></>}{phase === "ready" ? <button className="primary-button" disabled={pending || !devicesReady || mediaPending} onClick={begin}>{pending ? <><LoaderCircle className="spin" size={16} />Connecting...</> : <><Phone size={16} />Start video interview</>}</button> : <><button className="call-button end-call" disabled={pending} onClick={endInterview}><PhoneOff size={16} />End interview</button><button className="secondary-button" disabled={pending} onClick={() => speaking ? stopSpeech() : speak(reply + " " + question)} aria-label={speaking ? "Stop interviewer audio" : "Replay interviewer question"}><Volume2 size={17} /></button></>}</div></>}
    {error && <p className="form-error interview-message" role="alert">{error}</p>}
    {notice && <p className="browser-notice" role="status">{notice}</p>}
    <p className="call-privacy">Camera video is a local preview and is not uploaded. Text answers are sent to Groq for AI evaluation. Browser speech recognition may use your browser’s speech service.</p>
  </section>;
}
