#!/usr/bin/env node
/**
 * One-shot VAPID-Keypair-Generator für Web-Push (Issue #36).
 *
 * Aufruf: `node scripts/generate-vapid.mjs`
 *
 * Schreibt die Werte als `VAPID_PUBLIC_KEY=…` / `VAPID_PRIVATE_KEY=…` auf
 * stdout — der Output ist so formatiert, dass man ihn direkt an die `.env`
 * (lokal) bzw. an `vercel env` (Produktion) hängen kann.
 *
 * Wichtig:
 *   - Privatschlüssel ist Geheimnis. Nicht ins Repo committen.
 *   - Beim Wechsel der Schlüssel müssen alle bestehenden Subscriptions
 *     gelöscht werden — sie sind an den Public Key gebunden.
 */
import webPush from "web-push";

const { publicKey, privateKey } = webPush.generateVAPIDKeys();

console.log("# Neue VAPID-Schlüssel — in .env eintragen:");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=mailto:hajo@porthun.de`);
