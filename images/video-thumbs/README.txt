CUSTOM VIDEO THUMBNAILS
========================

Drop your thumbnail images into THIS folder, named after the YouTube video ID.

NAMING FORMAT:
  {videoId}.jpg   or   {videoId}.png   or   {videoId}.webp

EXAMPLES:
  H5OsS61noaI.jpg      ← Ola S1 X 2 kWh video
  RNJsNBbN9JM.jpg      ← Ola S1 Pro 4 kWh video
  wm7eqTbCheI.jpg      ← Ather Rizta Z video

HOW TO USE:
  After placing the file here, in videos-db.js add   customThumb: true
  to the matching video entry.

  Example:
    { videoId: 'H5OsS61noaI', customThumb: true, creator: '...', ... }

WITHOUT customThumb:
  The site automatically uses the official YouTube thumbnail from:
  https://img.youtube.com/vi/{videoId}/maxresdefault.jpg

THUMBNAIL GUIDE: Upload as ZIP
  You can zip all your thumbnail images into one file named:
  ScooterWale_Thumbnails.zip
  Then I can extract them and activate customThumb for each one.
