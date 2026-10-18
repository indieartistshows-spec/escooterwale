/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  EScooterwale — Video Database                               ║
 * ║  Real YouTube video IDs — thumbnails auto-fetched from YT  ║
 * ║                                                             ║
 * ║  CUSTOM THUMBNAILS (optional):                              ║
 * ║  Upload a ZIP with files named {videoId}.jpg or .png        ║
 * ║  Place them in images/video-thumbs/{videoId}.jpg            ║
 * ║  The site checks that path first, falls back to YouTube CDN ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 *  videoId: null         → slot hidden
 *  videoId: "ABC123"     → real thumbnail + exact YouTube link
 *  customThumb: true     → uses images/video-thumbs/{videoId}.jpg
 */

var VIDEOS_DB = {

  /* ── OLA ELECTRIC ─────────────────────────────────────────── */
  'ola-electric-s1-x-2-kwh': [
    { videoId: 'H5OsS61noaI', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#ff0000', type: 'review' }
  ],
  'ola-electric-s1-x-3-kwh': [
    { videoId: 'KT8lOLV4VP4', customThumb: true, creator: 'Review 1', avatar: 'YT', avatarColor: '#ff0000', type: 'review'    },
    { videoId: 'jKBbxaLFD6w', customThumb: true, creator: 'Review 2', avatar: 'YT', avatarColor: '#ff0000', type: 'comparison'}
  ],
  'ola-electric-s1-xplus-4-kwh': [
    { videoId: 'KT8lOLV4VP4', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#ff0000', type: 'review' }
  ],
  'ola-electric-s1-pro-3-kwh': [
    { videoId: 'Un2pzJ5_j00', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#ff0000', type: 'review' }
  ],
  'ola-electric-s1-pro-4-kwh': [
    { videoId: 'RNJsNBbN9JM', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#ff0000', type: 'review' }
  ],
  'ola-electric-s1-proplus-5point2-kwh': [
    { videoId: 'yOckT0G47nU', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#ff0000', type: 'review' }
  ],

  /* ── ATHER ENERGY ─────────────────────────────────────────── */
  'ather-energy-rizta-z-3point7-kwh': [
    { videoId: 'wm7eqTbCheI', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#2563eb', type: 'review' }
  ],
  'ather-energy-450x-3point7-kwh': [
    { videoId: '3O_tl6jcF7Y', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#2563eb', type: 'review' }
  ],
  'ather-energy-450-apex-3point7-kwh': [
    { videoId: 'PYviRhBaKww', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#2563eb', type: 'review' }
  ],

  /* ── TVS MOTOR ────────────────────────────────────────────── */
  'tvs-motor-iqube-2point2-kwh': [
    { videoId: 'EKb75QfDGT8', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#f59e0b', type: 'review' }
  ],
  'tvs-motor-iqube-s-3point5-kwh': [
    { videoId: 'CuoVikxZBwU', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#f59e0b', type: 'review' }
  ],
  'tvs-motor-iqube-st-5point3-kwh': [
    { videoId: 'CuoVikxZBwU', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#f59e0b', type: 'review' }
  ],

  /* ── BAJAJ CHETAK ─────────────────────────────────────────── */
  'bajaj-chetak-chetak-c2501-2point5-kwh': [
    { videoId: 'JshY05nDuVo', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#7c3aed', type: 'review' }
  ],
  'bajaj-chetak-chetak-3501-3point5-kwh': [
    { videoId: '__Iv6F4pQqE', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#7c3aed', type: 'review' }
  ],
  'bajaj-chetak-chetak-3502-3point5-kwh': [
    { videoId: '9Z9uRVDzOlk', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#7c3aed', type: 'review' }
  ],

  /* ── HERO VIDA ────────────────────────────────────────────── */
  'hero-vida-vx2-plus-3point4-kwh': [
    { videoId: 'RlsnvWUv-0Y', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#dc2626', type: 'review' }
  ],
  'hero-vida-v2-pro-3point94-kwh': [
    { videoId: 'RlsnvWUv-0Y', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#dc2626', type: 'review' }
  ],

  /* ── AMPERE ───────────────────────────────────────────────── */
  'ampere-reo-1point3-kwh': [
    { videoId: 'fD0vtr4xx9A', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#f97316', type: 'review' }
  ],
  'ampere-magnus-neo-2point3-kwh': [
    { videoId: 'ogc6HRBahUw', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#f97316', type: 'review' }
  ],
  'ampere-magnus-g-max-3point0-kwh': [
    { videoId: 'XmjD9m5_ibo', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#f97316', type: 'review' }
  ],
  'ampere-nexus-ex-3-kwh': [
    { videoId: 'PjyvRFnLr80', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#f97316', type: 'review' }
  ],

  /* ── OKINAWA ──────────────────────────────────────────────── */
  'okinawa-r30-0point8-kwh': [
    { videoId: 'ATwTwWYSa9I', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#0ea5e9', type: 'review' }
  ],
  'okinawa-lite-1point2-kwh': [
    { videoId: 'eyzvFbNSGrY', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#0ea5e9', type: 'review' }
  ],
  'okinawa-ipraiseplus-2point2-kwh': [
    { videoId: 'a767XY4EBF8', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#0ea5e9', type: 'review' }
  ],
  'okinawa-ridgeplus-2point8-kwh': [
    { videoId: '01yUlw5JGwE', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#0ea5e9', type: 'review' }
  ],

  /* ── PURE EV ──────────────────────────────────────────────── */
  'pure-ev-epluto-7g-2point0-kwh': [
    { videoId: 'ZmrVD-F32vc', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#10b981', type: 'review' }
  ],
  'pure-ev-etranceplus-4point5-kwh': [
    { videoId: 'eKd0KLqz1vU', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#10b981', type: 'review' }
  ],

  /* ── BOUNCE INFINITY ──────────────────────────────────────── */
  'bounce-infinity-infinity-e1-2point0-kwh': [
    { videoId: 'ym2L3mHTAZQ', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#f59e0b', type: 'review' }
  ],
  'bounce-infinity-infinity-e1-plus-2point5-kwh': [
    { videoId: 'Cg6F6mPGVbw', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#f59e0b', type: 'review' }
  ],

  /* ── BGAUSS ───────────────────────────────────────────────── */
  'bgauss-c12i-2point0-kwh': [
    { videoId: 'psM4NZDnPbM', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#1e40af', type: 'review' }
  ],
  'bgauss-ruv-350i-3point0-kwh': [
    { videoId: '-DOLO7znqjQ', customThumb: true, creator: 'Review',   avatar: 'YT', avatarColor: '#1e40af', type: 'review' }
  ]
};

/* ── Resolution helpers ─────────────────────────────────────── */

/**
 * Resolve thumbnail for a video.
 * Priority: custom file in images/video-thumbs/ → YouTube CDN maxresdefault → hqdefault fallback
 */
function getThumb(videoId, customThumb) {
  if (customThumb) return '/images/video-thumbs/' + videoId + '.jpg';
  return 'https://img.youtube.com/vi/' + videoId + '/maxresdefault.jpg';
}

/**
 * Get resolved videos for a specific scooter.
 * Returns only entries with a real videoId.
 */
function getVideosFor(scooterId) {
  var entries = VIDEOS_DB[scooterId] || [];
  return entries
    .filter(function(v) { return !!v.videoId; })
    .map(function(v) {
      return {
        videoId:    v.videoId,
        creator:    v.creator,
        avatar:     v.avatar,
        avatarColor:v.avatarColor,
        type:       v.type,
        url:        'https://www.youtube.com/watch?v=' + v.videoId,
        thumb:      getThumb(v.videoId, v.customThumb)
      };
    });
}

/**
 * Get all videos across every scooter (for the Trending page).
 */
function getAllVideos() {
  var result = [];
  Object.keys(VIDEOS_DB).forEach(function(scooterId) {
    (VIDEOS_DB[scooterId] || []).forEach(function(v) {
      if (v.videoId) {
        result.push({
          scooterId:  scooterId,
          videoId:    v.videoId,
          creator:    v.creator,
          avatar:     v.avatar,
          avatarColor:v.avatarColor,
          type:       v.type,
          url:        'https://www.youtube.com/watch?v=' + v.videoId,
          thumb:      getThumb(v.videoId, v.customThumb)
        });
      }
    });
  });
  return result;
}
