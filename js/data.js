/* Book content + per-chapter theme (accent colour, particle style, ambience bed). */
(function () {
  'use strict';
  const RCB = (window.RCB = window.RCB || {});

  const coverVariants = [
    { id: 1, tag: 'VAR 1', title: "שער א': The Epic Hero Odyssey", src: 'assets/web/cover_01.webp', thumb: 'assets/web/thumb_cover_01.webp' },
    { id: 2, tag: 'VAR 2', title: "שער ב': Grand Vista — Great Wall Overlook", src: 'assets/web/cover_02.webp', thumb: 'assets/web/thumb_cover_02.webp' },
    { id: 3, tag: 'VAR 3', title: "שער ג': Between Dynasties and Neon", src: 'assets/web/cover_03.webp', thumb: 'assets/web/thumb_cover_03.webp' }
  ];

  const pad = (n) => String(n).padStart(2, '0');
  const page = (num, title, loc, synopsis, theme) => ({
    num,
    title,
    loc,
    synopsis,
    src: `assets/web/page_${pad(num)}.webp`,
    thumb: `assets/web/thumb_${pad(num)}.webp`,
    theme
  });

  const pages = [
    {
      num: 0,
      isCover: true,
      title: "Roy's China Adventure — Graphic Novel",
      loc: "Special Collector's Edition Cover (Google Flow)",
      synopsis: 'עמוד השער הרשמי של הרומן הגרפי (הופק ב-Google Flow). בכל פתיחה של הספר נבחר שער אקראי מתוך 3 גרסאות אספנים נבחרות! לחץ על כפתור השער 🎲 כדי להחליף בין הגרסאות בכל רגע.',
      theme: { accent: '#f5a524', fx: 'lanterns', bed: 'theme', music: 'asia' }
    },
    page(1, 'Chapter 1: The High Horizon', 'Beijing CBD — Atmosphere Bar (80th Floor)',
      "רואי, ג'ין ומאי חוגגים את הלילה הראשון בבייג'ינג בבר Atmosphere בקומה ה-80. כוסיות מורמות לחיים אל מול כבישי הטבעת המוארים ומגדל CCTV העתידני, כשמאי מתעדת את הרגע בצילום ראשון למזכרת.",
      { accent: '#f5a524', fx: 'bokeh', bed: 'city', music: 'asia' }),
    page(2, 'Chapter 2: Imperial to Avant-Garde', 'Forbidden City (Meridian Gate) & 798 Art District',
      'רואי ולאו פנג מתפעמים מגדולתו של שער מרידיאן בעיר האסורה בת 600 השנים, ומשם צוללים ישירות לתוך האנרגיה התעשייתית והאוונגרדית של רובע האמנות 798 יחד עם ג\'ין ומאי.',
      { accent: '#f43f5e', fx: 'dust', bed: 'theme', music: 'asia' }),
    page(3, 'Chapter 3: The Dragon’s Crest', 'Mutianyu Great Wall & Downhill Toboggan',
      'טרק במעלה החומה הגדולה במוטיאניו בין מגדלי שמירה מושלגים והרהור שקט של לאו פנג על האבנים העתיקות, שמסתיים במגלשת טובוגן אלפינית מהירה וסוערת במורד ההר!',
      { accent: '#7dd3fc', fx: 'snow', bed: 'wind', music: 'sunrise' }),
    page(4, 'Chapter 4: Sanctuary in the Capital', 'Chaoyang District — Candlelit Shabbat',
      'כשדמדומי שישי יורדים על בייג\'ינג הקפואה, אור נרות זהוב, חלות קלועות וגביע קידוש של כסף מכניסים את השבת בשלום ובחמימות. אלפי קילומטרים מהבית — שולחן שבת הופך כל מקום למשפחה.',
      { accent: '#fbbf24', fx: 'embers', bed: 'candle', music: 'asia' }),
    page(5, 'Chapter 5: Velocity of Steel', "CR400 Fuxing G-Train (Beijing to Xi'an)",
      'טסים על פסי הפלדה ב-350 קמ"ש ברכבת הקליע Fuxing G-Train. רואי ומאי נהנים מתא הנוסעים המודרני בעוד המישורים הצפוניים חולפים ביעף, עד להגעה לתחנת שיאן צפון המפוארת.',
      { accent: '#22d3ee', fx: 'streaks', bed: 'train', music: 'sunrise' }),
    page(6, 'Chapter 6: Sunset Ramparts', "Xi'an 14km Ancient Ming City Wall",
      'רכיבה על אופניים atop חומות האבן המסיביות של שיאן באורך 14 ק"מ בשעת השקיעה המוזהבת, כשפנסי נייר אדומים נדלקים בזה אחר זה אל מול מגדלי הפעמון והתוף העתיקים.',
      { accent: '#fb923c', fx: 'lanterns', bed: 'wind', music: 'asia' }),
    page(7, 'Chapter 7: The Silent Legion & Night Alleyways', 'Terracotta Army Pit 1 & Muslim Quarter',
      'עמידה נפעמת בבור 1 מול אלפי לוחמי הטראקוטה הדוממים בני אלפיים שנה עם לאו פנג, ולאחריה צלילה לטעמים, ללהבות הווקים ולאטריות הביאנג-ביאנג בסמטאות הסוערות של הרובע המוסלמי.',
      { accent: '#f97316', fx: 'embers', bed: 'candle', music: 'asia' }),
    page(8, 'Chapter 8: The Sky Elevator', 'Zhangjiajie — Bailong Glass Elevator',
      'זינוק אנכי של 326 מטרים בתוך 80 שניות במעלית הזכוכית ביילונג, המטפסת על צוק אבן חול זקוף ובוקעת מתוך העננים ישירות אל נוף עמודי הקארסט המיסטיים של ז\'אנגג\'יאג\'יה.',
      { accent: '#34d399', fx: 'mist', bed: 'mist', music: 'sunrise' }),
    page(9, 'Chapter 9: The Floating Monoliths', 'Zhangjiajie — Avatar Hallelujah Mountain',
      'עמודי האבן הענקיים של הר הללויה מתנשאים אלף מטר מעל ים של ערפל ירוק-עד. לאו פנג משתף בזיכרון הגיאולוגי העתיק של כדור הארץ בעוד רואי חוצה את הגשר הטבעי שבין השמיים לארץ.',
      { accent: '#10b981', fx: 'mist', bed: 'mist', music: 'sunrise' }),
    page(10, 'Chapter 10: Heaven’s Gate & 999 Stairs', 'Tianmen Mountain — Natural Rock Arch',
      'קשת סלע טבעית כבירה שנחצבה במרומי הר טיאנמן. רואי וג\'ין כובשים את 999 המדרגות התלולות במעלה העננים, ומניפים ידיים בניצחון בפסגת שער השמיים.',
      { accent: '#a5b4fc', fx: 'mist', bed: 'wind', music: 'sunrise' }),
    page(11, 'Chapter 11: Jazz on the Bund', 'Shanghai — Fairmont Peace Hotel & Bund',
      'צלילי ג\'אז קלאסיים משנות ה-20 במלון Peace Hotel האגדי, ומעבר לילי אל טיילת הבונד מול קו הרקיע הניאוני והעתידני של פודונג ומגדל הפנינה המשתקפים בנהר החואנגפו.',
      { accent: '#e879f9', fx: 'neon', bed: 'jazz', music: 'asia' }),
    page(12, 'Chapter 12: Speed of Light & The Keepsake', 'Shanghai Maglev Train & Pudong Airport (Finale)',
      'ריחוף במהירות 431 קמ"ש ברכבת המגלב לעבר נמל התעופה. מאי מעניקה לרואי את אלבום התמונות המודפס המנציח כל צעד במסע. מטוס ממריא בשקיעה: \'עד להרפתקה הבאה\' — THE END.',
      { accent: '#fde047', fx: 'streaks', bed: 'theme', music: 'sunrise' })
  ];

  RCB.data = { coverVariants, pages, LAST: pages.length - 1, TOTAL_PAGES: pages.length - 1 };
})();
