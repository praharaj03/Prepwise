"use client";

import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { getClientAuth } from "@/firebase/client";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { Form } from "@/components/ui/form";
import { signIn, signUp } from "@/lib/actions/auth.action";
import FormField from "./FormField";

const authFormSchema = (type: FormType) => z.object({
  name: type === "sign-up" ? z.string().trim().min(3, "Use at least 3 characters.").max(100) : z.string().optional(),
  email: z.string().trim().email("Enter a valid email address."),
  password: type === "sign-up" ? z.string().min(8, "Use at least 8 characters.") : z.string().min(1, "Enter your password."),
});

export default function AuthForm({ type }: { type: FormType }) {
  const router = useRouter();
  const formSchema = authFormSchema(type);
  const form = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema), defaultValues: { name: "", email: "", password: "" } });
  const isSignIn = type === "sign-in";

  async function onSubmit(data: z.infer<typeof formSchema>) {
    form.clearErrors("root");
    try {
      const auth = getClientAuth();
      if (type === "sign-up") {
        const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        await updateProfile(credential.user, { displayName: data.name! });
        const result = await signUp({ idToken: await credential.user.getIdToken(true), name: data.name! });
        if (!result.success) { form.setError("root", { message: result.message }); return; }
        toast.success("Your account is ready. Sign in to get started.");
        router.push("/sign-in");
      } else {
        const credential = await signInWithEmailAndPassword(auth, data.email, data.password);
        const result = await signIn({ email: data.email, idToken: await credential.user.getIdToken() });
        if (!result.success) { form.setError("root", { message: result.message }); return; }
        toast.success("Welcome back. Let’s get practicing.");
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      const message = code === "auth/invalid-credential" ? "The email or password doesn’t match. Please try again." : code === "auth/email-already-in-use" ? "An account already uses this email. Try signing in." : code === "auth/network-request-failed" ? "We couldn’t connect. Check your connection and try again." : error instanceof Error ? error.message : "We couldn’t sign you in. Please try again.";
      form.setError("root", { message });
    }
  }

  return <div className="auth-form-wrap"><span className="eyebrow">{isSignIn ? "GOOD TO SEE YOU AGAIN" : "MAKE ROOM FOR YOUR NEXT CHAPTER"}</span><h2>{isSignIn ? "Welcome back." : "Your future starts here."}</h2><p className="auth-description">{isSignIn ? "A little practice today. A little more confidence tomorrow." : "Create your account. Start showing up for the role you want."}</p><Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="auth-form" noValidate>{!isSignIn && <FormField control={form.control} name="name" label="Your name" placeholder="Alex Morgan" type="text" autoComplete="name" />}<FormField control={form.control} name="email" label="Email address" placeholder="you@example.com" type="email" autoComplete="email" /><FormField control={form.control} name="password" label="Password" placeholder={isSignIn ? "Enter your password" : "At least 8 characters"} type="password" autoComplete={isSignIn ? "current-password" : "new-password"} />{form.formState.errors.root && <p role="alert" className="form-error">{form.formState.errors.root.message}</p>}<button className="primary-button auth-submit" type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <><LoaderCircle size={17} className="spin" />Just a moment…</> : <>{isSignIn ? "Sign in to your workspace" : "Create your account"}<ArrowRight size={17} /></>}</button></form></Form><p className="auth-switch">{isSignIn ? "New to PrepWise?" : "Already have an account?"} <Link href={isSignIn ? "/sign-up" : "/sign-in"}>{isSignIn ? "Create an account" : "Sign in"}<ArrowUpRightIcon /></Link></p><div className="auth-security"><LockKeyhole size={13} />A personal space for your preparation.</div></div>;
}

function ArrowUpRightIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>; }
