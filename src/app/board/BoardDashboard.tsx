"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Database,
  ExternalLink,
  FileSearch,
  FileStack,
  FolderOpen,
  LayoutPanelLeft,
  MessageSquareText,
  Search,
  Sparkles,
} from "lucide-react";

import type { ImportedMeeting, ImportedMeetingDetail } from "@/lib/importer-data";

type BoardDashboardProps = {
  meetings: ImportedMeeting[];
  initialMeeting: ImportedMeetingDetail | null;
  initialItemId: string | null;
};

type SearchResult = {
  kind: "agenda" | "attachment";
  meetingId: string;
  itemId: string;
  title: string;
  itemTitle: string;
  snippet: string;
  fileName?: string;
  localPath?: string;
  sourceUrl?: string;
  score: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: SearchResult[];
};

function formatDateLabel(value: string | null) {
  if (!value) return "Date unavailable";
  const normalized = value.replace(" - ", " ");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function paragraphsFromText(text: string) {
  return text
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function BoardDashboard({ meetings, initialMeeting, initialItemId }: BoardDashboardProps) {
  const router = useRouter();
  const [selectedMeetingId, setSelectedMeetingId] = useState(initialMeeting?.meetingId ?? meetings[0]?.meetingId ?? "");
  const [selectedItemId, setSelectedItemId] = useState(initialItemId ?? initialMeeting?.items[0]?.itemId ?? "");
  const [query, setQuery] = useState("");
  const [searchScope, setSearchScope] = useState<"current" | "all">("current");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [chatScope, setChatScope] = useState<"current" | "all">("current");
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setSelectedMeetingId(initialMeeting?.meetingId ?? meetings[0]?.meetingId ?? "");
    setSelectedItemId(initialItemId ?? initialMeeting?.items[0]?.itemId ?? "");
  }, [initialMeeting, initialItemId, meetings]);

  const meeting = initialMeeting;

  const visibleItems = useMemo(() => {
    if (!meeting) return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return meeting.items;
    return meeting.items.filter((item) => {
      const haystack = `${item.title} ${item.plainText} ${item.path.join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [meeting, query]);

  const selectedItem =
    visibleItems.find((item) => item.itemId === selectedItemId) ??
    meeting?.items.find((item) => item.itemId === selectedItemId) ??
    visibleItems[0] ??
    meeting?.items[0] ??
    null;

  const textParagraphs = selectedItem ? paragraphsFromText(selectedItem.plainText) : [];

  function selectMeeting(meetingId: string) {
    setSelectedMeetingId(meetingId);
    setSelectedItemId("");
    router.push(`/board?meetingId=${encodeURIComponent(meetingId)}`);
  }

  function openResult(result: SearchResult) {
    if (result.meetingId !== selectedMeetingId) {
      router.push(`/board?meetingId=${encodeURIComponent(result.meetingId)}&itemId=${encodeURIComponent(result.itemId)}`);
      return;
    }
    setSelectedItemId(result.itemId);
  }

  async function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      setSearchResults([]);
      setSearchError("");
      return;
    }
    setSearchLoading(true);
    setSearchError("");
    try {
      const params = new URLSearchParams({ q: normalizedQuery });
      if (searchScope === "current" && selectedMeetingId) {
        params.set("meetingId", selectedMeetingId);
      }
      const response = await fetch(`/api/board/search?${params.toString()}`);
      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!response.ok) {
        throw new Error(data.error ?? "Search failed.");
      }
      setSearchResults(data.results ?? []);
    } catch (error) {
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function sendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message) return;

    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", content: message }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/board/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          meetingId: chatScope === "current" ? selectedMeetingId || undefined : undefined,
          history: nextMessages.slice(-6).map((entry) => ({
            role: entry.role,
            content: entry.content,
          })),
        }),
      });
      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!response.ok) {
        throw new Error(data.error ?? "Chat request failed.");
      }
      setChatMessages((current) => [
        ...current,
        { role: "assistant", content: data.answer ?? "I could not generate an answer.", citations: data.citations ?? [] },
      ]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Chat request failed.",
          citations: [],
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4f8ff_0%,#eef4fb_42%,#f7faf8_100%)] pb-8">
      <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-3 py-4 sm:px-5 lg:px-6">
        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,#13344f_0%,#21516c_48%,#d5e5bb_148%)] text-white shadow-[0_20px_70px_rgba(17,53,84,0.2)]">
          <div className="grid gap-6 px-5 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-white/88">
                <Sparkles className="h-3.5 w-3.5" />
                Board Briefing Desk
              </div>
              <div>
                <h1 className="max-w-4xl font-serif text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                  Miller Creek School District board meeting briefing desk
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/78 sm:text-base">
                  Review agendas, supporting files, and meeting context in one place, with retrieval tools designed for fast trustee prep across individual meetings or the full archive.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="rounded-3xl border border-white/18 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-white/65">Meetings</p>
                <p className="mt-2 text-3xl font-semibold">{meetings.length}</p>
              </div>
              <div className="rounded-3xl border border-white/18 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-white/65">Agenda Items</p>
                <p className="mt-2 text-3xl font-semibold">{meeting?.itemCount ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-white/18 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-white/65">Attachments</p>
                <p className="mt-2 text-3xl font-semibold">{meeting?.attachmentCount ?? 0}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 2xl:grid-cols-[290px_330px_minmax(0,1fr)_360px] xl:grid-cols-[280px_320px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-slate-200/70 bg-white/92 p-4 shadow-[0_18px_50px_rgba(28,48,89,0.08)]">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Database className="h-4 w-4 text-sky-600" />
              Imported Meetings
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setSearchScope("all");
                  setChatScope("all");
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700"
              >
                All meetings
              </button>
              {meetings.map((entry) => {
                const isActive = entry.meetingId === selectedMeetingId;
                return (
                  <button
                    key={entry.meetingId}
                    type="button"
                    onClick={() => selectMeeting(entry.meetingId)}
                    className={`block w-full rounded-3xl border p-4 text-left transition ${
                      isActive
                        ? "border-sky-300 bg-sky-50 shadow-[0_12px_25px_rgba(2,132,199,0.12)]"
                        : "border-slate-200/80 bg-slate-50/65 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <p className="line-clamp-2 text-sm font-semibold text-slate-900">{entry.meetingTitle}</p>
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5 text-sky-600" />
                        {formatDateLabel(entry.meetingDateLabel)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{entry.itemCount} items</span>
                        <span>{entry.attachmentCount} files</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <aside className="rounded-[28px] border border-slate-200/70 bg-white/94 p-4 shadow-[0_18px_50px_rgba(28,48,89,0.08)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <LayoutPanelLeft className="h-4 w-4 text-emerald-600" />
                Agenda
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {visibleItems.length} visible
              </span>
            </div>
            <label className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter agenda items"
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </label>
            <div className="max-h-[72vh] space-y-2 overflow-y-auto pr-1">
              {visibleItems.map((item) => {
                const isSelected = selectedItem?.itemId === item.itemId;
                return (
                  <button
                    key={item.itemId}
                    type="button"
                    onClick={() => setSelectedItemId(item.itemId)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-emerald-300 bg-emerald-50 shadow-[0_10px_22px_rgba(5,150,105,0.11)]"
                        : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    style={{ marginLeft: `${item.level * 10}px`, width: `calc(100% - ${item.level * 10}px)` }}
                  >
                    <p className="text-sm font-semibold leading-5 text-slate-900">{item.title}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>Level {item.level}</span>
                      <span>{item.attachments.length} files</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-[30px] border border-slate-200/80 bg-white/96 p-5 shadow-[0_22px_60px_rgba(28,48,89,0.1)]">
            {!meeting || !selectedItem ? (
              <div className="flex min-h-[500px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 text-center">
                <div>
                  <p className="text-base font-semibold text-slate-800">No imported meeting selected.</p>
                  <p className="mt-2 text-sm text-slate-500">Choose a meeting from the left to inspect its agenda and supporting documents.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-[28px] bg-[linear-gradient(135deg,#fffef7_0%,#f6fbff_55%,#eef7f1_100%)] p-5">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Selected Item</p>
                      <h2 className="max-w-4xl font-serif text-3xl font-semibold leading-tight text-slate-950">{selectedItem.title}</h2>
                      <p className="max-w-3xl text-sm text-slate-600">{meeting.meetingTitle}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-1">
                      <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Meeting Date</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateLabel(meeting.meetingDateLabel)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {selectedItem.path.map((segment) => (
                      <span key={`${selectedItem.itemId}-${segment}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {segment}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                  <article className="rounded-[26px] border border-slate-200/80 bg-slate-50/65 p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Content</p>
                        <p className="mt-1 text-sm text-slate-600">Meeting narrative and field-level detail captured from the imported item.</p>
                      </div>
                      <a href={meeting.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300">
                        Open Source
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <div className="space-y-4">
                      {textParagraphs.length > 0 ? (
                        textParagraphs.map((paragraph, index) => (
                          <p key={`${selectedItem.itemId}-${index}`} className="text-[15px] leading-7 text-slate-700">{paragraph}</p>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No text was captured for this item.</p>
                      )}
                    </div>
                  </article>

                  <aside className="space-y-4">
                    <div className="rounded-[26px] border border-slate-200/80 bg-white p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <FileStack className="h-4 w-4 text-amber-600" />
                        Supporting Documents
                      </div>
                      <div className="mt-4 space-y-3">
                        {selectedItem.attachments.length > 0 ? (
                          selectedItem.attachments.map((attachment) => (
                            <div key={attachment.attachmentKey} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                              <p className="text-sm font-semibold text-slate-900">{attachment.fileName}</p>
                              <p className="mt-1 text-xs text-slate-500">{attachment.mimeType} · {formatBytes(attachment.sizeBytes)}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <a href={`file://${attachment.localPath}`} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                                  <FolderOpen className="h-3.5 w-3.5" />
                                  Open File
                                </a>
                                <a href={attachment.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                                  Source
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No supporting documents were attached to this item.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Archive Notes</p>
                      <div className="mt-3 space-y-3 text-sm text-slate-600">
                        <p>Meeting ID: <span className="font-semibold text-slate-800">{meeting.meetingId}</span></p>
                        <p>Agenda tab: <span className="font-semibold text-slate-800">{meeting.agendaTabLabel ?? "Agenda"}</span></p>
                        <p>Current item order: <span className="font-semibold text-slate-800">{selectedItem.orderIndex + 1}</span></p>
                        <p>Updated in SQLite: <span className="font-semibold text-slate-800">{formatTimestamp(selectedItem.updatedAt)}</span></p>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            )}
          </section>

          <aside className="grid gap-4 xl:col-span-3 2xl:col-span-1">
            <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_50px_rgba(28,48,89,0.08)]">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <FileSearch className="h-4 w-4 text-sky-600" />
                Search Archive
              </div>
              <div className="mb-3 flex gap-2">
                <button type="button" onClick={() => setSearchScope("current")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${searchScope === "current" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>This meeting</button>
                <button type="button" onClick={() => setSearchScope("all")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${searchScope === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>All meetings</button>
              </div>
              <form onSubmit={runSearch} className="flex gap-3">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search agenda and file text" className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
                </label>
                <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={searchLoading}>
                  {searchLoading ? "Searching..." : "Search"}
                </button>
              </form>
              <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Results</div>
                <div className="max-h-[290px] space-y-3 overflow-y-auto pr-1">
                  {searchError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                      {searchError}
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((result, index) => (
                      <button key={`${result.kind}-${index}-${result.itemId}`} type="button" onClick={() => openResult(result)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300 hover:bg-slate-50">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{result.kind === "attachment" ? "Attachment Match" : "Agenda Match"}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{result.kind === "attachment" ? result.fileName : result.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{result.itemTitle} · Meeting {result.meetingId}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{result.snippet || "No preview available."}</p>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No search results yet.</div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_50px_rgba(28,48,89,0.08)]">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <MessageSquareText className="h-4 w-4 text-emerald-600" />
                Ask The Archive
              </div>
              <div className="mb-3 flex gap-2">
                <button type="button" onClick={() => setChatScope("current")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${chatScope === "current" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>This meeting</button>
                <button type="button" onClick={() => setChatScope("all")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${chatScope === "all" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>All meetings</button>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Conversation</div>
                <div className="max-h-[340px] space-y-4 overflow-y-auto pr-1">
                  {chatMessages.length > 0 ? (
                    chatMessages.map((message, index) => (
                      <div key={`${message.role}-${index}`} className={`rounded-3xl px-4 py-3 ${message.role === "user" ? "ml-8 bg-slate-900 text-white" : "mr-8 border border-slate-200 bg-white text-slate-800"}`}>
                        <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                        {message.role === "assistant" && message.citations && message.citations.length > 0 ? (
                          <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                            {message.citations.slice(0, 3).map((citation, citationIndex) => (
                              <button key={`${citation.kind}-${citationIndex}-${citation.itemId}`} type="button" onClick={() => openResult(citation)} className="block w-full rounded-2xl bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100">
                                <span className="font-semibold text-slate-800">{citation.kind === "attachment" ? citation.fileName : citation.title}</span>
                                <span className="ml-1">· {citation.itemTitle}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No chat yet.</div>
                  )}
                </div>
              </div>
              <form onSubmit={sendChatMessage} className="mt-4 flex gap-3">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <MessageSquareText className="h-4 w-4 text-slate-400" />
                  <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ask about contracts, votes, finances, or attachments" className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
                </label>
                <button type="submit" className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={chatLoading}>
                  {chatLoading ? "Thinking..." : "Ask"}
                </button>
              </form>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
