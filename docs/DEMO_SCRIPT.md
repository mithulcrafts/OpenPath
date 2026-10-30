# OpenPath three-minute demo script

1. Build with `npm run build`, start with `npm start`, and open `http://127.0.0.1:4173/`. For rehearsals, use `OPENPATH_AI_ENABLED=false`. For sponsor evidence, open the already-recorded live audits from History; reading them spends no credits.
2. Open the broken-storefront report. Point out the bounded crawl, four check groups, page evidence and the interaction finding for the unnamed add-to-cart control.
3. Open Developer fixes and Evidence. Expand an evidence record to show the selector and captured snippet, then download the Markdown fix kit.
4. Open the saved fixed-storefront report, or use **Audit fixed demo** during an offline rehearsal. Show the server's check-by-check comparison, scope match and explicit predefined-variant disclosure.
5. Choose a recorded attempt under **Saved trials**. Show the step timeline, screenshots, independent cart assertion and actual outcome. For a new paired attempt, select the baseline under **Compare task with**. The server rejects mismatched settings.
6. Expand the recorded model calls to show real NVIDIA/Nebius provider metadata. Both original live tasks succeeded, so show **unchanged** task outcome and the improved static control-name check. Do not invent a failure or claim a measured speed/reliability gain from one pair. See `LIVE_VERIFICATION.md` for the captured proof and spending limits.

The demo makes three claims that can be verified on screen: the scanner found a concrete accessibility issue, the fixed variant exposes a named control, and the controlled task passed an independent server-owned cart assertion. The offline simulator is clearly labelled and should not be presented as NVIDIA inference.
