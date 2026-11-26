# MS Tracker

A personal symptom tracker for iPhone and iPad (installable web app).
Entries are stored on the device. Optional sync between devices encrypts every record
on the device with your passphrase before upload (Firebase Auth + Firestore, free plan).

Open the site in Safari, tap Share, then Add to Home Screen.

`index.html` is the complete app (built from `app.js`). The Firebase web configuration in `app.js`
is public by design; data access is controlled by sign-in, Firestore rules and the encryption passphrase.
Do not upload backups or exports to this repository.
