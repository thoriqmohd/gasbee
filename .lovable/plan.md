# Fill dummy licence data for Minhas Gas riders

Three Minhas Gas riders have a plate number but no licence number, expiry date or licence photo, so they can't accept jobs:
- Muhammad Armin Shafiq Bin Ahmad Azmi (BFU7912)
- Muhammad Shah Rezat Bin Ismail (WPY9044)
- Muhammad Nazir Azizi Bin Mohd Zubaidi (BJJ9814)

## What will be done
- Fill each rider with placeholder details: licence number `DUMMY-<plate>`, expiry date 31 Dec 2027, a placeholder licence photo, and vehicle type "Motorcycle" if empty.
- Existing plate numbers are kept. Riders from other shops are not touched.
- Confirm afterwards that all three pass the licence check and can accept orders.

## Note
These are fake details. The merchant should replace them with each rider's real licence before the expiry date or when available.
