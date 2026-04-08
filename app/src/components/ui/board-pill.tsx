import { detectBoard } from "@/lib/board-detection";

/** Shows the original job board (LinkedIn, Indeed, etc.) derived from the URL,
 *  falling back to the raw source name when the board can't be detected. */
export function BoardPill({ url, source }: { url: string | null; source: string | null }) {
  const board = detectBoard(url);
  const label = board?.name ?? source ?? "";
  if (!label) return null;

  const style = board
    ? {
        backgroundColor: `${board.color}15`,
        color: board.color,
        borderColor: `${board.color}30`,
      }
    : undefined;

  return (
    <span
      className={`inline-flex h-[24px] items-center rounded-full border px-2.5 text-[0.6875rem] font-medium ${
        board ? "" : "border-[#9CA3AF]/15 bg-[#9CA3AF]/5 text-[#9CA3AF]/70"
      }`}
      style={style}
    >
      {label}
    </span>
  );
}
