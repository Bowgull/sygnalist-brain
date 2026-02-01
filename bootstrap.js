function getProfileBootstrap_(profileId) {
  const profile = getProfileByIdOrThrow_(profileId);
  assertProfileActiveOrThrow_(profile);

  // DTO only (no internals beyond what UI needs)
  return {
    ok: true,
    version: Sygnalist_VERSION,
    profile: {
      profileId: profile.profileId,
      displayName: profile.displayName,
      status: profile.status,
      statusReason: profile.statusReason || "",
      isAdmin: !!profile.isAdmin
    }
  };
}
