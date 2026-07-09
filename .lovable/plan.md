## Goal
Bila paparan live rider map muncul dalam page order detail, tunjukkan juga stepper status penghantaran (Pending → Confirmed → Preparing → On the way → Delivered) di atas map — sama seperti card "Order Tracking" yang ada di bahagian atas page.

## Change
File: `src/pages/user/UserOrderDetail.tsx`

1. Extract markup stepper "Order Tracking" (lines 81–129) menjadi satu helper JSX kecil (dalam component yang sama) supaya boleh digunakan dua kali tanpa duplikasi.
2. Render helper tersebut:
   - Di tempat asal (di atas page) — kekal.
   - Di dalam Card live rider tracking (lines 184–205), tepat di bawah header phaseLabel/ETA dan sebelum `<MapPicker />`. Ini bermakna waktu map keluar, user nampak status stepper terkini + map dalam satu card.
3. Tiada perubahan pada logic status, data fetching, real-time subscription, atau map component.

## Notes
- Hanya perubahan presentasi (UI). Tiada perubahan DB, RLS, atau business logic.
- Stepper akan sync automatik dengan `o.status` sedia ada, jadi status di atas map sentiasa reflect status terkini.
