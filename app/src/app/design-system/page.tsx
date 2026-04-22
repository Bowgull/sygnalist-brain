"use client";

import { useState } from "react";
import { Search, Plus, Inbox, RefreshCw, Radar, ExternalLink } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Section,
  Sheet,
  Skeleton,
  StatusPill,
  Tag,
} from "@/components/design-system";

export default function DesignSystemPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[var(--ds-bg-0)] font-[family-name:var(--font-ds-sans)] text-[var(--ds-text-1)]">
      <PageHeader
        eyebrow="Phase 1"
        title="Signal Desk — Design System"
        description="A calm operator's desk. Typographic, editorially spaced, numerics in mono. Every page from Phase 2 onward will be built from these pieces."
        actions={
          <div className="hidden md:flex items-center gap-2">
            <Badge tone="accent" dot>
              Live
            </Badge>
            <Badge tone="neutral">v0.1</Badge>
          </div>
        }
      />

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-10 space-y-14">
        {/* Type specimen */}
        <Section
          eyebrow="01 · Typography"
          title="Type system"
          description="Geist for display and body. Geist Mono for numerics, dates, stages, and meta. Numerics are always mono — counts, timestamps, durations."
        >
          <Card>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-baseline">
                <SpecLabel>Display</SpecLabel>
                <h1 className="text-[32px] md:text-[40px] font-semibold text-[var(--ds-text-0)] leading-[1.05] tracking-[-0.02em]">
                  Signal over noise for your job hunt.
                </h1>

                <SpecLabel>Heading</SpecLabel>
                <h2 className="text-[20px] font-semibold text-[var(--ds-text-0)] tracking-[-0.01em]">
                  Track what moves you forward.
                </h2>

                <SpecLabel>Body</SpecLabel>
                <p className="text-[14px] leading-relaxed max-w-[60ch] text-[var(--ds-text-1)]">
                  Sygnalist reads the jobs so you can decide fast. Each card carries a Job Summary and a
                  Why Fit block — no hype, no sludge. You drive the hunt.
                </p>

                <SpecLabel>Subtle</SpecLabel>
                <p className="text-[13px] text-[var(--ds-text-2)] max-w-[60ch]">
                  Secondary descriptions live here. Used for captions, helper text, and the quiet half
                  of a two-line label.
                </p>

                <SpecLabel>Mono / numerics</SpecLabel>
                <p className="font-[family-name:var(--font-ds-mono)] text-[13px] text-[var(--ds-text-1)]">
                  12 open sygnals · 47d in stage · 2026-04-22 10:29 UTC
                </p>

                <SpecLabel>Eyebrow</SpecLabel>
                <p className="font-[family-name:var(--font-ds-mono)] text-[11px] uppercase tracking-[0.14em] text-[var(--ds-text-3)]">
                  Section label · tracker · pipeline
                </p>
              </div>
            </CardBody>
          </Card>
        </Section>

        {/* Palette */}
        <Section
          eyebrow="02 · Palette"
          title="Surfaces and accent"
          description="Warm near-black with layered slate. One confident accent (muted sage — reinterpreted Radar Green). Signal gold stays, but only as rare emphasis."
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Swatch label="bg-0" value="#0F1115" bgVar="--ds-bg-0" />
            <Swatch label="bg-1" value="#14171D" bgVar="--ds-bg-1" />
            <Swatch label="bg-2" value="#1A1D24" bgVar="--ds-bg-2" />
            <Swatch label="bg-3" value="#20242C" bgVar="--ds-bg-3" />
            <Swatch label="text-0" value="#F5F5F2" bgVar="--ds-text-0" />
            <Swatch label="text-1" value="#C4C6C9" bgVar="--ds-text-1" />
            <Swatch label="text-2" value="#8E9196" bgVar="--ds-text-2" />
            <Swatch label="text-3" value="#5D6167" bgVar="--ds-text-3" />
            <Swatch label="accent-dim" value="#5D9379" bgVar="--ds-accent-dim" />
            <Swatch label="accent" value="#84BFA0" bgVar="--ds-accent" />
            <Swatch label="accent-bright" value="#A5D4BA" bgVar="--ds-accent-bright" />
            <Swatch label="signal" value="#E8C56B" bgVar="--ds-signal" />
          </div>
        </Section>

        {/* Buttons */}
        <Section
          eyebrow="03 · Buttons"
          title="Actions"
          description="Four variants, three sizes. Primary for the one committing action on a screen. Secondary for everything else. Ghost for low-weight. Destructive for delete-style actions."
        >
          <Card>
            <CardBody>
              <div className="space-y-5">
                <Row label="Variants">
                  <Button variant="primary" icon={<Radar size={14} strokeWidth={2} />}>
                    Scan for new roles
                  </Button>
                  <Button variant="secondary" icon={<Plus size={14} strokeWidth={2} />}>
                    Add manually
                  </Button>
                  <Button variant="ghost" icon={<RefreshCw size={14} strokeWidth={2} />}>
                    Refresh
                  </Button>
                  <Button variant="destructive">Remove</Button>
                </Row>
                <Row label="Sizes">
                  <Button variant="primary" size="sm">
                    Small
                  </Button>
                  <Button variant="primary" size="md">
                    Medium
                  </Button>
                  <Button variant="primary" size="lg">
                    Large
                  </Button>
                </Row>
                <Row label="Disabled">
                  <Button variant="primary" disabled>
                    Scan
                  </Button>
                  <Button variant="secondary" disabled>
                    Add
                  </Button>
                </Row>
              </div>
            </CardBody>
          </Card>
        </Section>

        {/* Badges and tags */}
        <Section
          eyebrow="04 · Badges and tags"
          title="Meta, counts, and status"
          description="Badges are lightweight status markers. Tags are metadata values (mono) — salary, lanes, sources."
        >
          <Card>
            <CardBody>
              <div className="space-y-5">
                <Row label="Badges">
                  <Badge tone="neutral">Neutral</Badge>
                  <Badge tone="accent" dot>
                    Active
                  </Badge>
                  <Badge tone="signal" dot>
                    S-tier
                  </Badge>
                  <Badge tone="ok">OK</Badge>
                  <Badge tone="warn">Review</Badge>
                  <Badge tone="err">Locked</Badge>
                </Row>
                <Row label="Status pills">
                  <StatusPill status="prospect" />
                  <StatusPill status="applied" />
                  <StatusPill status="interview" />
                  <StatusPill status="final" />
                  <StatusPill status="offer" />
                  <StatusPill status="rejected" />
                  <StatusPill status="ghosted" />
                </Row>
                <Row label="Tags">
                  <Tag>$140k – $180k</Tag>
                  <Tag>Remote · US</Tag>
                  <Tag>Platform Eng</Tag>
                  <Tag onRemove={() => {}}>Ashby</Tag>
                </Row>
              </div>
            </CardBody>
          </Card>
        </Section>

        {/* Cards */}
        <Section
          eyebrow="05 · Cards"
          title="Card anatomy"
          description="Standard resting card, interactive (hoverable) card, and elevated card. The card language for Inbox and Tracker will be built on these."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader title="Standard" description="Quiet resting card." />
              <CardBody>
                <p className="text-[13px] text-[var(--ds-text-2)] leading-relaxed">
                  Default surface. No hover. Used for content that lives on a page.
                </p>
              </CardBody>
            </Card>
            <Card interactive>
              <CardHeader
                title="Interactive"
                description="Hover raises the contrast."
                actions={
                  <Badge tone="accent" dot>
                    Live
                  </Badge>
                }
              />
              <CardBody>
                <p className="text-[13px] text-[var(--ds-text-2)] leading-relaxed">
                  Used when the card is a clickable unit — job cards, tracker entries.
                </p>
              </CardBody>
            </Card>
            <Card elevated>
              <CardHeader title="Elevated" description="Raised shadow for modal-adjacent surfaces." />
              <CardBody>
                <div className="flex items-center gap-2">
                  <Tag>$160k</Tag>
                  <Tag>Remote</Tag>
                </div>
              </CardBody>
            </Card>
          </div>
        </Section>

        {/* Empty / Loading / Error */}
        <Section
          eyebrow="06 · States"
          title="Empty, loading, and error"
          description="The invisible 80% of polish. Every page must feel intentional even when there's nothing to show yet."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <EmptyState
                icon={<Inbox size={20} strokeWidth={1.75} />}
                title="Nothing in your inbox yet"
                description="Hit Scan to pull fresh roles from your lanes."
                primaryAction={{
                  label: "Scan for new roles",
                  icon: <Radar size={14} strokeWidth={2} />,
                  onClick: () => {},
                }}
                secondaryAction={{ label: "Add manually", onClick: () => {} }}
              />
            </Card>
            <Card>
              <CardBody>
                <LoadingState label="Loading tracker" />
                <div className="mt-5 space-y-2">
                  <Skeleton widthPct={90} height={20} />
                  <Skeleton widthPct={72} height={14} />
                  <Skeleton widthPct={54} height={14} />
                </div>
              </CardBody>
            </Card>
            <Card>
              <ErrorState
                title="Couldn't load jobs"
                description="The fetch failed. It's probably a blip — try again in a minute."
                retry={() => {}}
              />
            </Card>
          </div>
        </Section>

        {/* Dialog and sheet */}
        <Section
          eyebrow="07 · Overlays"
          title="Dialog and sheet"
          description="Dialog: focused decisions (create, confirm). Sheet: parked context on the side (desktop) or bottom (mobile). On mobile, both slide from the bottom."
        >
          <Card>
            <CardBody>
              <Row label="Triggers">
                <Button variant="secondary" onClick={() => setDialogOpen(true)}>
                  Open dialog
                </Button>
                <Button variant="secondary" onClick={() => setSheetOpen(true)}>
                  Open sheet
                </Button>
              </Row>
            </CardBody>
          </Card>
        </Section>

        {/* Example composition */}
        <Section
          eyebrow="08 · Composition"
          title="A job card, sketched"
          description="Not the final Inbox card — just a sanity check that the primitives compose into something that reads on both viewports."
        >
          <Card interactive>
            <CardBody>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[17px] font-semibold text-[var(--ds-text-0)] tracking-[-0.01em] leading-tight">
                    Staff Platform Engineer
                  </h3>
                  <p className="mt-0.5 text-[13px] text-[var(--ds-text-2)]">Ramp · New York, NY or Remote</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="font-[family-name:var(--font-ds-mono)] text-[12px] text-[var(--ds-text-2)]">
                    3d
                  </span>
                  <StatusPill status="prospect" />
                </div>
              </div>
              <p className="mt-3 text-[13px] text-[var(--ds-text-1)] leading-relaxed max-w-[70ch]">
                Own the foundation of Ramp's developer experience — from CI to service scaffolds. Partner with
                leads across product to cut iteration time.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Tag>$220k – $280k</Tag>
                <Tag>NYC / Remote US</Tag>
                <Tag>Platform · Infra</Tag>
                <Badge tone="signal" dot>
                  S-tier fit
                </Badge>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button variant="primary" size="sm">
                  Promote to Tracker
                </Button>
                <Button variant="ghost" size="sm">
                  Dismiss
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ExternalLink size={12} strokeWidth={2} />}
                  iconPosition="right"
                >
                  View listing
                </Button>
              </div>
            </CardBody>
          </Card>
        </Section>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Add a job manually"
        description="Paste the URL or enter the basics. You can enrich later."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setDialogOpen(false)}>
              Add to Tracker
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="URL" placeholder="https://jobs.ashbyhq.com/…" icon={<Search size={14} strokeWidth={2} />} />
          <Field label="Title" placeholder="Staff Platform Engineer" />
          <Field label="Company" placeholder="Ramp" />
        </div>
      </Dialog>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter your sygnals"
        description="Narrow the inbox to a lane, salary band, or source."
        placement="right"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSheetOpen(false)}>
              Reset
            </Button>
            <Button variant="primary" onClick={() => setSheetOpen(false)}>
              Apply filters
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Lane" placeholder="Any" />
          <Field label="Min salary" placeholder="$120k" />
          <Field label="Source" placeholder="Any" />
        </div>
      </Sheet>
    </div>
  );
}

function SpecLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-[family-name:var(--font-ds-mono)] text-[11px] uppercase tracking-[0.14em] text-[var(--ds-text-3)]">
      {children}
    </p>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3 md:items-center">
      <SpecLabel>{label}</SpecLabel>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Swatch({ label, value, bgVar }: { label: string; value: string; bgVar: string }) {
  return (
    <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-1)] overflow-hidden bg-[var(--ds-bg-1)]">
      <div className="h-20" style={{ backgroundColor: `var(${bgVar})` }} />
      <div className="p-3">
        <p className="text-[12px] font-medium text-[var(--ds-text-0)]">{label}</p>
        <p className="mt-0.5 font-[family-name:var(--font-ds-mono)] text-[11px] text-[var(--ds-text-2)]">
          {value}
        </p>
      </div>
    </div>
  );
}

function Field({ label, placeholder, icon }: { label: string; placeholder?: string; icon?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-[var(--ds-text-2)] mb-1.5">{label}</span>
      <div className="relative">
        {icon ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]">{icon}</span>
        ) : null}
        <input
          type="text"
          placeholder={placeholder}
          className={[
            "w-full rounded-[var(--ds-radius-md)] border bg-[var(--ds-bg-2)] border-[var(--ds-border-2)]",
            "py-2 pr-3 text-[14px] text-[var(--ds-text-0)] placeholder-[var(--ds-text-3)]",
            icon ? "pl-9" : "pl-3",
            "outline-none focus:border-[var(--ds-accent)]",
            "font-[family-name:var(--font-ds-sans)]",
            "transition-colors duration-[var(--ds-duration-fast)]",
          ].join(" ")}
        />
      </div>
    </label>
  );
}
