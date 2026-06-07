// Shared mapping from a GeolocationPositionError to an actionable hint,
// used by both the mobile pill and the desktop controls so the copy can't
// drift between them.
//
// An *instant* failure with no permission prompt is PERMISSION_DENIED from a
// pre-existing denial — on iOS that's Location Services off globally, Safari
// Websites set to "Never", or a remembered per-site "Don't Allow". All of
// them are indistinguishable client-side and none can be re-prompted from
// the page, so the denied copy has to point at the settings instead.
// (Some Apple configurations report a global Location Services toggle as
// POSITION_UNAVAILABLE, hence that copy also mentions Location Services.)

const IOS_RE = /iPad|iPhone/;

export function geolocationErrorHint(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return IOS_RE.test(navigator.userAgent)
        ? "Location is blocked for this site. Allow it in Safari’s aA menu or in Settings > Privacy > Location Services — or enter a postcode."
        : "Location is blocked for this site. Allow it in your browser’s site settings, or enter a postcode.";
    case error.POSITION_UNAVAILABLE:
      return "We couldn’t pinpoint you just now. Check Location Services is on, or enter a postcode.";
    case error.TIMEOUT:
      return "Finding your location took too long. Try again, or enter a postcode.";
    default:
      return "We couldn’t get your location. Enter a postcode instead.";
  }
}
