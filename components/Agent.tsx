"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { toast } from "sonner";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { auth } from "@/firebase/client";

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
  const starting = useRef(false);
  const mounted = useRef(false);
  const callStarted = useRef(false);

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
      (type === "generate" && !process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID)) {
      toast.error("Voice interviews are not configured yet.");
      return;
    }
    starting.current = true;
    callStarted.current = false;
    setMessages([]);
    setCallStatus(CallStatus.CONNECTING);
    try {
      let call;
      if (type === "generate") {
        await auth.authStateReady();
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken || auth.currentUser?.uid !== userId) {
          throw new Error("Please sign in again before generating an interview.");
        }
        if (!mounted.current) return;
        call = await vapi.start(process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID!, {
          variableValues: { userName, userId, userid: userId, idToken },
        });
      } else {
        if (!questions?.length) throw new Error("This interview has no questions.");
        call = await vapi.start(interviewer, {
          variableValues: { questions: questions.join("\n") },
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
  return (
    <>
      <div className="call-view">
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="vapi"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="user avatar"
              width={540}
              height={540}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript" aria-live="polite">
            <p key={lastMessage} className={cn('transition-opacity duration-500 opacity-0', 'animate-fadeIn opacity-100')}>
                {lastMessage}
            </p>
          </div>
        </div>
      )}

      <div className="w-full flex justify-center">
        {callStatus !== CallStatus.ACTIVE ? (
          <button type="button" className="relative btn-call" onClick={handleCall}
            disabled={callStatus === CallStatus.CONNECTING}>
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus !== CallStatus.CONNECTING && "hidden",
              )}
            />
            <span>
              {callStatus === "INACTIVE" || callStatus === "FINISHED"
                ? "Call"
                : "... "}
            </span>
          </button>
        ) : (
          <button type="button" className="btn-disconnect" onClick={handleDisconnect}>End</button>
        )}
      </div>
    </>
  );
};

export default Agent;
