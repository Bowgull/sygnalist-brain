"use client";

import { useState, useEffect } from "react";

const MESSAGES = [
  "Making the bots work for you",
  "Scanning the signal",
  "Filtering the noise",
  "Not gaslighting. Promise",
  "Checking every corner of the internet",
  "Your resume is doing the heavy lifting",
  "Running the numbers",
  "Talking to our contacts",
  "Cross-referencing your skills",
  "Separating wheat from chaff",
  "Finding the needle in the haystack",
  "Almost there. Probably",
  "Asking nicely for job data",
  "Let's not romanticize this",
  "Doing the thing you hate doing",
  "Working harder than your last recruiter",
  "No fluff. Just signal",
  "Checking if anyone is actually hiring",
  "Scoring matches against your profile",
  "Running quality checks",
  "Building your shortlist",
  "Comparing notes with the market",
  "Processing... like a responsible adult",
  "Crunching the fit scores",
  "Prioritizing what matters",
  "One moment. Real work is happening",
  "Reviewing the landscape",
  "Matching roles to your lane",
  "Enriching job details",
  "Generating fit analysis",
];

const ROTATE_INTERVAL = 6000;

export default function LoadingMessages() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * MESSAGES.length));

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % MESSAGES.length);
    }, ROTATE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Animated radar icon */}
      <div className="relative mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0B1512] to-[#0F2A23] ring-1 ring-[#6AD7A3]/20 animate-pulse-glow">
          <svg viewBox="0 0 64 64" className="h-10 w-10">
            <circle cx="32" cy="32" r="17" fill="none" stroke="url(#loadGrad)" strokeWidth="3.8" opacity="0.95" />
            <circle cx="32" cy="32" r="10" fill="none" stroke="#A9FFB5" strokeWidth="2" opacity="0.16" />
            <path d="M32 32 L49 22" stroke="url(#loadGrad)" strokeWidth="3" strokeLinecap="round" opacity="0.80">
              <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="3s" repeatCount="indefinite" />
            </path>
            <circle cx="32" cy="32" r="4.4" fill="url(#loadGrad)" />
            <defs>
              <linearGradient id="loadGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#A9FFB5" />
                <stop offset="0.55" stopColor="#5EF2C7" />
                <stop offset="1" stopColor="#39D6FF" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      <p className="text-[0.9375rem] font-medium text-[#6AD7A3] transition-opacity duration-500" key={index}>
        {MESSAGES[index]}
      </p>
      <p className="mt-2 text-[0.75rem] text-[#9CA3AF]">
        This may take a moment...
      </p>
    </div>
  );
}
