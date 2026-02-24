# Fix Summary: Custom Script Error Handling (FORMBRICKS-P5)

## Problem
User-provided custom scripts injected via `customHeadScripts` were calling deprecated MetaMask internal APIs (`window.ethereum._handleChainChanged`), causing unhandled TypeErrors that:
- Were reported to Sentry as production errors
- Could potentially break the survey experience for users
- Occurred when the survey page loaded with certain browser extensions (MetaMask)

## Root Cause
The `CustomScriptsInjector` component was correctly injecting user-provided scripts, but had no protection against runtime errors that occurred *after* the scripts were executed. The existing try-catch block only caught errors during the injection process itself, not runtime errors from the injected code.

## Solution
Enhanced error handling in the `CustomScriptsInjector` component to wrap all user-provided scripts in defensive error handling:

### Changes Made
1. **Inline Script Wrapping** (lines 64-72): 
   - All inline script content is now wrapped in try-catch blocks
   - Runtime errors are caught and logged to console with `[Formbricks]` prefix
   - Errors don't break the survey or propagate to error tracking

2. **External Script Error Handling** (lines 75-77):
   - Added `onerror` event handlers to all external scripts loaded via `src` attribute
   - Loading errors are logged to console but don't break functionality

3. **Documentation**:
   - Updated JSDoc to clearly state that user scripts are error-isolated
   - Added inline comments explaining the defensive programming approach

## Benefits
- ✅ Prevents third-party script errors from breaking surveys
- ✅ Reduces noise in error tracking (Sentry)
- ✅ Maintains debuggability via console warnings
- ✅ No breaking changes to existing functionality
- ✅ Works for both inline and external scripts

## Testing Considerations
- User scripts with errors will execute up to the point of failure, then stop gracefully
- Error messages are visible in browser console for debugging by self-hosted admins
- Survey functionality remains intact even if custom scripts fail completely

## Example
**Before**: User script calling `window.ethereum._handleChainChanged()` would throw an unhandled TypeError

**After**: The error is caught, logged to console as a warning, and the survey continues to function normally

## Files Modified
- `apps/web/modules/survey/link/components/custom-scripts-injector.tsx`

## Commit
- `fix: wrap custom scripts in try-catch to prevent runtime errors` (Fixes FORMBRICKS-P5)
