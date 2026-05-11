## Session 7 — Real-bug debugging and pause-aware state

**Render functions should not own user-controlled state.**
The popup's `render` ran every second and re-synced duration inputs from state. Worked when state was the source of truth. Broke the moment the user started typing — the next render overwrote their input. The right pattern: state seeds the input *once* on popup open, then the user owns it until they submit (click Start). Render only touches inputs to enable/disable them.

**The `document.activeElement` check is fragile in popups.**
Initial attempt: only overwrite the input if it didn't have focus. Failed because clicking elsewhere in the popup (even on another input) flipped `activeElement` to `BODY` between renders, allowing the overwrite to happen. Real-world focus behavior in popups is more chaotic than expected. The robust fix is to remove the auto-sync entirely, not to be cleverer about focus detection.

**Off-by-one errors in time labels are often round-trip latency.**
"You have 2 minutes" said "1 minute" because the override granted at `now + 120000` was queried back from the block page ~500ms later — long enough for `Math.floor((expiresAt - now) / 60000)` to drop to 1. `Math.ceil` is the right tool for "round up to the nearest user-visible unit." Same lesson as the countdown display itself.

**Wall-clock-based timers don't compose with pause.**
The override's `expiresAt` is a fixed timestamp. Pause has no effect on it — the wall clock keeps moving. So a 2-minute override paused for 30 seconds expired 1:30 after resume, not 2:00. The fix: when pausing, convert each active override from `{host, expiresAt}` to `{host, pausedRemainingMs}`. When resuming, convert back: `{host, expiresAt: now + pausedRemainingMs}`. Same shape as the main timer's pause logic, applied to each override.

**Schema migrations via shape discrimination.**
Overrides now have two possible shapes — active (`expiresAt`) and paused (`pausedRemainingMs`). The discriminator is which field is present (`o.pausedRemainingMs != null`). Every consumer (`hasActiveOverride`, `pruneOverrides`, `updateBadge`, `renderOverrides`, the tick logic) had to learn the new shape. This is the cost of polymorphic state — it spreads. For larger systems, a `type: "active" | "paused"` tag field would be cleaner. For this size, the discriminator pattern is fine.

**Direct state inspection beats UI testing for verifying data-layer fixes.**
Asking "wait 60 seconds and watch the badge" works but is slow and noisy. Asking `chrome.storage.local.get("state", ...)` after each action shows the actual data transitions in milliseconds. For "did the fix change the data shape correctly?" the storage query is the ground truth. UI verification follows.

**Debugging via real use surfaces bugs that planning doesn't.**
All three session 7 bugs were caught by Jake testing the running extension — the time-picker revert (focus interaction), the "1 minute" label (latency timing), the override drain on pause (semantic gap between wall-clock and timer-clock). None would have come from reading the spec or the code. This is the value of "stop and use the tool" — the tool tells you what's wrong.

**Commit hygiene: one logical change per commit.**
Bundled commits ("fix and docs and small refactor") collapse the history into mush. `git revert` becomes harder, `git bisect` becomes ambiguous, code review becomes noisy. Discipline: separate code commits from docs commits, separate unrelated fixes from each other, even when the temptation to bundle is strong. The cost is one extra `git commit` invocation; the benefit is a readable history six months later.

## Session 8-9 — Symmetry, prompts, and bounded sessions

**Subdomain matching is bidirectional in user intent.**
The initial `hasActiveOverride` only matched `host.endsWith("." + override.host)` — subdomain inside override. But real-world hosts like `www.claude.ai` and `claude.ai` are "the same site" in user intent. Fix: check both directions, plus equality. Now `hostsMatch(a, b)` is symmetric.

**Polymorphic override state requires merging-on-write to stay clean.**
After bidirectional matching, you could have two overrides covering each other (one for `www.claude.ai`, one for `claude.ai`) — functionally redundant, visually confusing. Fix: on every `requestOverride`, collapse related entries into one canonical entry using the more general (shorter) host. Pattern: filter related, narrow `canonicalHost` across iterations, append single entry.

**Related tabs need releasing on override, not just navigations.**
The webNavigation interceptor handles future navigations. But existing tabs sitting on block pages for related hosts don't auto-clear when you override. Fix: `releaseRelatedBlockPages(host)` scans block-page tabs, parses original URL, releases any whose host is related.

**`chrome.runtime.onStartup` only fires on cold Chrome start.**
Not on extension reload, not on service worker wake. Testing the natural flow requires actually quitting Chrome and reopening. For development, expose the function in dev-tools console for direct invocation.

**Notifications fail silently if macOS permissions aren't granted.**
`chrome.notifications.create` returns successfully and logs no error, but nothing appears on screen. First debugging step for "notification not showing": System Settings → Notifications → Google Chrome.

**Recency gating prevents notification fatigue.**
Cold-start notifications fire on every Chrome restart. That's 5-10x per day on a normal Mac. To stay useful and not become spam, gate on a minimum interval (`lastPromptedAt` field in state, 5-hour minimum). Trade-off: miss prompts if you actually need them; benefit: tool stays welcome long-term.

**Bounded sessions are a different state machine than infinite cycling.**
Adding `rounds` and `currentRound` to state chan