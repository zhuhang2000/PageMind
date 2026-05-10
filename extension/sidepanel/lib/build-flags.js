export const RELEASE_MODES = Object.freeze({
  LOCAL_TEST: "local-test",
  OFFICIAL_RELEASE: "official-release",
});

export const RELEASE_MODE = RELEASE_MODES.OFFICIAL_RELEASE;

export const FEATURE_FLAGS = Object.freeze({
  googleDocsExport: RELEASE_MODE === RELEASE_MODES.LOCAL_TEST,
});
