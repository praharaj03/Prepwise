"use client";

import { cn } from "@/lib/utils";
import { AudioLines, Clock3, FileText, LoaderCircle, Mic, Phone, PhoneOff, Volume2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { toast } from "sonner";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { getClientAuth } from "@/firebase/client";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

const Agent = ({ userName, userId, type, questions }: AgentProps) => {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const starting = useRef(false);
  const mounted = useRef(false);
  const callStarted = useRef(false);

  useEffect(() => {
    if (callStatus !== CallStatus.ACTIVE) return;
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [callStatus]);

  useEffect(() => {
    mounted.current = true;
    const onCallStart = () => {
      callStarted.current = true;
      setCallStatus(CallStatus.ACTIVE);
    };
    const onCallEnd = () => {
      starting.current = false;
      setCallStatus(CallStatus.FINISHED);
      setIsSpeaking(false);
      if (type === "generate" && callStarted.current) {
        router.push("/");
        router.refresh();
      }
    };
    const onSpeechStart = () => setIsSpeaking(true);
    const onSpeechEnd = () => setIsSpeaking(false);
    const onMessage = (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        setMessages((previous) => [...previous, message.transcript]);
      }
    };
    const onError = () => {
      starting.current = false;
      setCallStatus(CallStatus.INACTIVE);
      setIsSpeaking(false);
      toast.error("The voice call failed. Check microphone access and try again.");
    };
    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("message", onMessage);
    vapi.on("error", onError);
    return () => {
      mounted.current = false;
      vapi.removeListener("call-start", onCallStart);
      vapi.removeListener("call-end", onCallEnd);
      vapi.removeListener("speech-start", onSpeechStart);
      vapi.removeListener("speech-end", onSpeechEnd);
      vapi.removeListener("message", onMessage);
      vapi.removeListener("error", onError);
      void vapi.stop().catch(() => {});
    };
  }, [router, type]);

  const handleCall = async () => {
    if (starting.current) return;
    if (!process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN ||
      (type === "generate" && !process.env.NEXT_PUBLIC_VAPI_GENERATION_ASSISTANT_ID)) {
      toast.error("Voice interviews are not configured yet.");
      return;
    }
    starting.current = true;
    callStarted.current = false;
    setMessages([]);
    setElapsed(0);
    setCallStatus(CallStatus.CONNECTING);
    try {
      let call;
      if (type === "generate") {
        const auth = getClientAuth();
        await auth.authStateReady();
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken || auth.currentUser?.uid !== userId) {
          throw new Error("Please sign in again before generating an interview.");
        }
        if (!mounted.current) return;
        call = await vapi.start(process.env.NEXT_PUBLIC_VAPI_GENERATION_ASSISTANT_ID!, {
          variableValues: { userName, userId, userid: userId, idToken },
        });
      } else {
        if (!questions?.length) throw new Error("This interview has no questions.");
        call = await vapi.start(process.env.NEXT_PUBLIC_VAPI_INTERVIEW_ASSISTANT_ID || interviewer, {
          variableValues: { username: userName, userName, questions: questions.join("\n") },
        });
      }
      if (!mounted.current) {
        await vapi.stop();
        return;
      }
      if (!call) setCallStatus(CallStatus.INACTIVE);
    } catch (error) {
      if (mounted.current) {
        setCallStatus(CallStatus.INACTIVE);
        toast.error(error instanceof Error ? error.message : "Could not start the call.");
      }
    } finally {
      starting.current = false;
    }
  };

  const handleDisconnect = async () => {
    try {
      await vapi.stop();
      setCallStatus(CallStatus.FINISHED);
      setIsSpeaking(false);
    } catch {
      toast.error("Could not end the call. Please try again.");
    }
  };
  const lastMessage = messages[messages.length - 1];
  const voiceAvailable = !!process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;
  const statusLabel = callStatus === CallStatus.ACTIVE ? "Session in progress" : callStatus === CallStatus.CONNECTING ? "Connecting your call…" : callStatus === CallStatus.FINISHED ? "Session ended" : "Ready when you are";
  const duration = String(Math.floor(elapsed / 60)).padStart(2, "0") + ":" + String(elapsed % 60).padStart(2, "0");
  const initials = userName.split(" ").slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();

  return <section className="voice-room" aria-label="Voice practice room">
    <div className="voice-room-bar"><span className={callStatus === CallStatus.ACTIVE ? "call-status live" : "call-status"}><i />{statusLabel}</span><span className="call-timer"><Clock3 size={13} />{duration}</span></div>
    <div className="participants"><div className="participant"><span className="participant-label">YOUR INTERVIEWER</span><div className={cn("voice-avatar", isSpeaking && "speaking")}><AudioLines size={38} strokeWidth={1.5} /></div><h3>PrepWise interviewer</h3><p>{callStatus === CallStatus.ACTIVE ? isSpeaking ? "Speaking…" : "Listening to you" : "Here to help you prepare"}</p><span className="participant-icon" aria-hidden="true"><Volume2 size={13} /></span></div><div className="participant participant-human"><span className="participant-label">THE NEXT GREAT CANDIDATE</span><div className="human-avatar">{initials}</div><h3>{userName}</h3><p>{callStatus === CallStatus.ACTIVE ? "You’re in the conversation" : "A little more ready, every time"}</p><span className="participant-icon" aria-hidden="true"><Mic size={13} /></span></div></div>
    <div className="transcript-panel" aria-live="polite" aria-atomic="true"><span className="transcript-label"><FileText size={11} />LIVE TRANSCRIPT</span>{lastMessage ? <p>{lastMessage}</p> : <p className="transcript-placeholder">Your conversation will appear here. Take your time. You’ve got this.</p>}</div>
    <div className="call-controls">{callStatus === CallStatus.ACTIVE ? <button type="button" className="call-button end-call" onClick={handleDisconnect} aria-label="End voice call"><PhoneOff size={16} />End session</button> : <button type="button" className="call-button" onClick={handleCall} aria-label="Start voice call" disabled={callStatus === CallStatus.CONNECTING || !voiceAvailable}>{callStatus === CallStatus.CONNECTING ? <><LoaderCircle size={16} className="spin" />Connecting…</> : <><Phone size={16} />{callStatus === CallStatus.FINISHED ? "Practice again" : "Start conversation"}</>}</button>}<p>{!voiceAvailable ? "Voice practice isn’t available yet. You can still review your prepared questions below." : callStatus === CallStatus.FINISHED ? "Well done for showing up. Take a moment to reflect, or give it another go." : "Allow microphone access when prompted. Speak naturally, one answer at a time."}</p></div>
  </section>;
};

export default Agent;