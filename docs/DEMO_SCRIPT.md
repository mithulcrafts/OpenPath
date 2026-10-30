# OpenPath three-minute demo script

1. Start the app with `npm run dev` and open `http://127.0.0.1:4173/`.
2. Run the default audit against the controlled broken storefront. Point out the bounded crawl, page evidence and the interaction finding for the unnamed add-to-cart control.
3. Open Developer fixes and Evidence. Expand an evidence record to show the selector and captured snippet, then download the Markdown fix kit.
4. Open Advanced options, set the URL to `/demo/fixed/`, select the previous audit in Compare with, and run the audit. Show the before/after comparison and the explicit fixed-variant banner.
5. Run the controlled task trial. Show the step timeline, screenshots, independent cart assertion, `completed` outcome and the explicit `openpath-demo-simulator` disclosure.
6. For the sponsor proof, configure `NEBIUS_API_KEY` and run `npm run verify:live`; repeat one audit and one live task trial so the UI and fix kit contain actual model/provider metadata.

The demo makes three claims that can be verified on screen: the scanner found a concrete accessibility issue, the fixed variant exposes a named control, and the controlled task passed an independent server-owned cart assertion. The offline simulator is clearly labelled and should not be presented as NVIDIA inference.
