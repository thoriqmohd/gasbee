# Development Mode texts in English

Convert all Malay wording around the App Status / Development Mode feature to English.

## Admin Settings page
- Section description: "When enabled, a notice is shown to users every time they open the app."
- Toggle status text: "Active — notice is shown" / "Inactive"
- Field labels: "Notice title", "Notice message", "Button text"
- Default values stored for the notice:
  - Title: "Mobile App is in trial period"
  - Message: "The app is currently under redevelopment. No deliveries will be made during this period."
  - Button: "Got it"

## User notice dialog
- Update fallback title/message/button in the dev-mode notice component to the same English defaults.

## Checkout warning
- Update the dev-mode warning shown after "Confirm & place order" to English wording (reuses the same title/message settings, so only any hardcoded Malay text there changes).

## Notes
Existing values already saved in the database keep showing until an admin saves the new English text; the plan only changes defaults and UI labels.
