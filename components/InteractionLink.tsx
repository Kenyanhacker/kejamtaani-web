"use client";

import { MouseEvent, ReactNode, useState } from "react";

type Props = {
  href: string;
  listingId: string;
  interactionType: "whatsapp_click" | "phone_click" | "viewing_request";
  children: ReactNode;
  className: string;
  target?: string;
};

export default function InteractionLink({ href, listingId, interactionType, children, className, target }: Props) {
  const [feedback, setFeedback] = useState("");

  const record = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    void fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, interactionType }),
      keepalive: true,
    }).then(async (response) => {
      if (response.status === 401) setFeedback("Sign in to keep a history of your property enquiries.");
      else if (!response.ok) setFeedback("Your enquiry will open, but its interaction could not be recorded.");
    }).catch((error: unknown) => {
      console.error("Unable to send interaction event.", error);
      setFeedback("Your enquiry will open, but its interaction could not be recorded.");
    });
  };

  return (
    <>
      <a href={href} target={target} rel={target === "_blank" ? "noopener noreferrer" : undefined} onClick={record} className={className}>{children}</a>
      {feedback && <span role="status" className="block text-xs text-neutral-600">{feedback}</span>}
    </>
  );
}
