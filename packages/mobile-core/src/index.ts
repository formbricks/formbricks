// Entry point for the mobile core bundle ("the brain"). Built as UMD with the
// global name `formbricksMobileCore`; the native SDK shells (iOS JavaScriptCore,
// Android/Flutter WebView engines) evaluate the bundle and then call
// `globalThis.formbricksMobileCore.selectSurvey(payload)`.
//
// Contract with the shells:
// - `protocolVersion` must equal the shell's bridge protocol version, or the
//   shell discards the bundle and falls back to its built-in logic.
// - `selectSurvey` is pure decision logic: state in, decision out. Anything
//   requiring platform capabilities (storage, networking, presenting UI)
//   stays on the native side.
export { PROTOCOL_VERSION as protocolVersion, selectSurvey } from "@/lib/select-survey";
