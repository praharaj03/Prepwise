"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Download, Mic, MicOff, Play, RotateCcw, Square, Volume2 } from "lucide-react";

interface RecognitionResult { isFinal: boolean; [index: number]: { transcript: string } }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; abort: () => void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export default function BrowserPractice({ questions, role }: { questions: string[]; role: string }) {
  const [phase, setPhase] = useState<"ready" | "active" | "complete">("ready");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const speechVersion = useRef(0);

  useEffect(() => () => {
    speechVersion.current++;
    if (recognition.current) {
      recognition.current.onresult = null;
      recognition.current.onerror = null;
      recognition.current.onend = null;
      recognition.current.abort();
    }
    window.speechSynthesis?.cancel();
  }, []);

  function stopAudio() {
    speechVersion.current++;
    const current = recognition.current;
    recognition.current = null;
    current?.abort();
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setListening(false);
  }

  function readQuestion(questionIndex = index) {
    stopAudio();
    setNotice("");
    if (!("speechSynthesis" in window)) {
      setNotice("Read-aloud isn’t available in this browser. You can read the question on screen and answer at your own pace.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(questions[questionIndex]);
    const localEnglish = window.speechSynthesis.getVoices().find((voice) => voice.localService && voice.lang.startsWith("en"));
    if (localEnglish) utterance.voice = localEnglish;
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    const version = speechVersion.current;
    utterance.onstart = () => { if (version === speechVersion.current) setSpeaking(true); };
    utterance.onend = () => { if (version === speechVersion.current) setSpeaking(false); };
    utterance.onerror = () => {
      if (version !== speechVersion.current) return;
      setSpeaking(false);
      setNotice("The voice couldn’t read this question. You can keep practicing with the text on screen.");
    };
    window.speechSynthesis.speak(utterance);
  }

  function dictate() {
    if (listening) { stopAudio(); return; }
    stopAudio();
    setNotice("");
    const Constructor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) {
      setNotice("Dictation isn’t supported here. Type your notes, or answer out loud and move to the next question.");
      return;
    }
    const instance = new Constructor();
    recognition.current = instance;
    instance.lang = "en-US";
    instance.continuous = false;
    instance.interimResults = false;
    const previous = answers[index];
    instance.onresult = (event) => {
      if (recognition.current !== instance) return;
      const transcript = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0].transcript).join(" ");
      setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? [previous, transcript].filter(Boolean).join(" ") : answer));
    };
    instance.onerror = (event) => {
      if (recognition.current !== instance) return;
      setListening(false);
      setNotice(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Microphone permission wasn’t granted. You can still type notes or answer out loud." : "Dictation stopped. Try again, or type your notes instead.");
    };
    instance.onend = () => { if (recognition.current === instance) setListening(false); };
    try { instance.start(); setListening(true); }
    catch { recognition.current = null; setNotice("Couldn’t start dictation. You can still type your notes."); }
  }

  function begin() {
    stopAudio();
    setIndex(0);
    setAnswers(questions.map(() => ""));
    setNotice("");
    setPhase("active");
    readQuestion(0);
  }

  function next() {
    stopAudio();
    setNotice("");
    if (index === questions.length - 1) { setPhase("complete"); return; }
    setIndex(index + 1);
    readQuestion(index + 1);
  }

  function download() {
    const content = role + " — PrepWise practice notes\n\n" + questions.map((question, questionIndex) => (questionIndex + 1) + ". " + question + "\n" + (answers[questionIndex] || "No notes added.")).join("\n\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "prepwise-practice-notes.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!questions.length) return <section className="panel error-panel"><h2>No questions to practice yet.</h2><p>Create an interview with at least one question.</p></section>;

  return <section className="voice-room" aria-label="Free browser practice">
    <div className="voice-room-bar"><span className="call-status live"><i />Browser practice · No credits needed</span><span className="call-timer">{phase === "ready" ? questions.length + " questions" : phase === "complete" ? "COMPLETE" : String(index + 1).padStart(2, "0") + " / " + String(questions.length).padStart(2, "0")}</span></div>
    {phase === "ready" ? <div className="free-practice-intro"><span className="voice-avatar"><Volume2 size={35} /></span><span className="eyebrow">YOUR OWN SPACE TO REHEARSE</span><h2>Let’s find your words.</h2><p>Read or listen to one question at a time. Answer out loud, type notes, or use optional browser dictation. Move on when you’re ready.</p><button type="button" className="primary-button" onClick={begin}><Play size={16} />Start free practice</button><span className="quiet-note">No AI conversation service, API key, or voice credits required.</span></div> : phase === "complete" ? <div className="free-practice-intro"><span className="voice-avatar"><Check size={35} /></span><span className="eyebrow">YOU SHOWED UP FOR YOURSELF</span><h2>One conversation more prepared.</h2><p>You worked through {questions.length} questions. Pick one answer you want to improve, then come back for another attempt.</p><div className="free-practice-actions"><button className="primary-button" onClick={download}><Download size={16} />Download your notes</button><button className="secondary-button" onClick={begin}><RotateCcw size={16} />Practice again</button></div><span className="quiet-note">Notes stay in this session. Download them before leaving or restarting.</span></div> : <div className="free-practice-active"><div className="free-question"><span className="eyebrow">QUESTION {String(index + 1).padStart(2, "0")}</span><h2>{questions[index]}</h2><button className="text-link" type="button" onClick={() => speaking ? stopAudio() : readQuestion()}>{speaking ? <><Square size={14} />Stop reading</> : <><Volume2 size={16} />Read question aloud</>}</button></div><div className="free-answer"><div><label htmlFor="practice-answer">Your answer or notes <span>OPTIONAL</span></label><button className="text-link" type="button" onClick={dictate}>{listening ? <><MicOff size={14} />Stop dictation</> : <><Mic size={14} />Dictate answer</>}</button></div><textarea id="practice-answer" rows={5} value={answers[index]} placeholder="Start with the situation, explain your action, and share what changed…" onChange={(event) => { const value = event.target.value; setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? value : answer)); }} /><p>Dictation depends on browser support and may use your browser’s speech service. Typing and reading work without it.</p></div><div className="free-practice-actions"><button className="secondary-button" onClick={download}><Download size={15} />Save notes</button><button className="primary-button" onClick={next}>{index === questions.length - 1 ? "Finish practice" : "Next question"}<ArrowRight size={16} /></button></div></div>}
    {notice && <p className="browser-notice" role="status">{notice}</p>}
  </section>;
}
