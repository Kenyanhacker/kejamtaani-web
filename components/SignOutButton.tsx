"use client";

import { useState } from "react";

export default function SignOutButton() {
  const [error, setError] = useState("");
  const signOut = async () => {
    setError("");
    try {
      const response = await fetch("/api/auth/signout", { method: "POST" });
      if (!response.ok) throw new Error("Unable to sign out. Please try again.");
      window.location.assign("/");
    } catch (cause) {
      console.error("Unable to sign out.", cause);
      setError(cause instanceof Error ? cause.message : "Unable to sign out.");
    }
  };
  return <span className="inline-flex items-center gap-2"><button type="button" onClick={signOut} className="underline">Sign out</button>{error && <span role="alert" className="text-rose-700">{error}</span>}</span>;
}
