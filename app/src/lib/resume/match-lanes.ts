import { getServiceClient } from "@/lib/api-helpers";

interface RoleTrack {
  label: string;
  roleKeywords: string[];
  priorityWeight: number;
}

interface LaneControl {
  laneKey: string;
  laneLabel: string;
  enabled: boolean;
  roles: string[];
}

interface LaneBankRow {
  id: string;
  lane_key: string;
  role_name: string;
  aliases: string[] | null;
}

/**
 * Match parsed role_tracks against lane_role_bank.
 * - If a role track matches an existing lane (by substring on role_name or aliases), include it.
 * - If no match, auto-create a new lane with status 'pending'.
 * Returns suggested lane_controls for the profile.
 */
export async function matchLanes(
  roleTracks: RoleTrack[],
): Promise<LaneControl[]> {
  if (!roleTracks.length) return [];

  const service = getServiceClient();
  const { data: bankRows } = await service
    .from("lane_role_bank")
    .select("id, lane_key, role_name, aliases")
    .eq("is_active", true);

  const bank: LaneBankRow[] = bankRows ?? [];
  const laneControls: LaneControl[] = [];
  const seenKeys = new Set<string>();

  for (const track of roleTracks) {
    const trackLabel = track.label.toLowerCase();
    let matched = false;

    for (const lane of bank) {
      const roleName = lane.role_name.toLowerCase();
      const aliases = (lane.aliases ?? []).map((a) => a.toLowerCase());

      // Substring match: does the track label contain the lane name (or vice versa)?
      // Also check aliases.
      const isMatch =
        trackLabel.includes(roleName) ||
        roleName.includes(trackLabel) ||
        aliases.some((a) => trackLabel.includes(a) || a.includes(trackLabel));

      if (isMatch && !seenKeys.has(lane.lane_key)) {
        seenKeys.add(lane.lane_key);
        laneControls.push({
          laneKey: lane.lane_key,
          laneLabel: lane.role_name,
          enabled: true,
          roles: [track.label],
        });
        matched = true;
        break;
      }

      // If already seen this lane, just add the role track to its roles list
      if (isMatch && seenKeys.has(lane.lane_key)) {
        const existing = laneControls.find((lc) => lc.laneKey === lane.lane_key);
        if (existing && !existing.roles.includes(track.label)) {
          existing.roles.push(track.label);
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Auto-create lane with status 'pending'
      const laneKey = track.label.toLowerCase().replace(/\s+/g, "_");
      if (seenKeys.has(laneKey)) continue;

      await service.from("lane_role_bank").insert({
        lane_key: laneKey,
        role_name: track.label,
        aliases: track.roleKeywords ?? [],
        source: "resume_auto",
        status: "pending",
      });

      seenKeys.add(laneKey);
      laneControls.push({
        laneKey,
        laneLabel: track.label,
        enabled: true,
        roles: [track.label],
      });
    }
  }

  return laneControls;
}
