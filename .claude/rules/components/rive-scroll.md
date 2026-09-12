# rive-scroll

## Purpose

Plays a Webflow Rive element when it scrolls into view, and only that one.

IX3 has no per-element trigger target for Rive, so a scroll interaction wired to
one Rive fires **every** Rive on the page at once. This gates each one on its own
visibility instead.

### It does not load Rive

Webflow already ships the Rive runtime and instantiates one Rive per
`[data-animation-type="rive"]` element, so bundling `@rive-app/canvas` here would
mean two runtimes and two WASM downloads for the same animation. The component
reaches for the instance Webflow already built.

Webflow registers its Rive module the same way it registers `ix2`:

```js
Webflow.define('rive', {
  rive, createInstance, destroyInstance, getInstance, setLoadHandler, init, destroy, ready
})
```

so `Webflow.require('rive').getInstance(container)` returns the wrapper for that
one element, carrying `.rive` — the real Rive object, with `play()` and
`stateMachineInputs()` on it — and `.riveInstanceSuccessLoaded`.

**That accessor is internal, undocumented Webflow API.** The surface used is
deliberately tiny — one getter and one event name — and every failure path ends
in "the animation does not play" rather than a thrown error, so a future Webflow
change degrades to the paused first frame. `Webflow.require('rive')` is also read
lazily on every call rather than captured at init, because `Webflow.require`
exists long before the rive module has registered itself.

### The load race

Webflow fetches the `.riv` asynchronously, so at init the instance usually does
not exist yet. It dispatches a **`w-rive-load`** event on the container when it
does. That event does **not bubble** — Webflow constructs it as a plain `Event`
— so the listener has to sit on the container itself, not on the document.

Both orders are handled: if the wrapper already reports a successful load the
observer is attached immediately, otherwise it is attached on the event.
Observing is deferred until then on purpose. Attaching earlier breaks an element
that is already on screen at load: the observer fires straight away, finds no
instance to play, and — with replay off — disconnects having played nothing.

### Reduced motion is not honoured

Deliberate, and the one place this component differs from `smooth-scroll` and
`light-block`. These are hero-level visuals whose paused first frame can read as
a broken or empty canvas, so the animation plays regardless. Revert by returning
early on a `prefers-reduced-motion` match.

## Webflow Setup

No `data-component` attribute. Triggered by `data-play-on-scroll`, which is both
the opt-in and the config — same reasoning as `bg-grid`, `pillars` and `slider`.

On each Rive element you want gated:

1. **Turn autoplay off** in the Rive element's settings. Webflow reads it as
   `autoplay: "true" === el.getAttribute('data-rive-autoplay')`, so anything
   other than `"true"` starts the file paused.
2. Add `data-play-on-scroll="true"`.
3. Delete the IX3 interaction that was doing this.

Everything else stays as Webflow authored it — the Rive is still a native
element, still previews in the Designer, still lives in the asset manager.

| Attribute | Default | Meaning |
| --- | --- | --- |
| `data-play-on-scroll` | — | the opt-in. `"true"` plays once; `"repeat"` replays on every entry |
| `data-play-on-scroll-threshold` | `0.25` | fraction of the element that must be visible. Clamped to 0–1, since `IntersectionObserver` throws outside that |
| `data-rive-animation` | — | play a named linear timeline instead of the state machine |
| `data-rive-trigger` | — | fire a named state-machine trigger input instead of `play()` |

### Three shapes of `.riv` file

Which attribute you need depends on how the file was authored, and the three
cases are not interchangeable.

**Plain timelines — `data-rive-animation`.** This is what every Rive on
`/technology` turned out to be, and it is the case that does not work at all
without help. The Webflow Rive element *requires* you to pick a state machine,
so a file authored as timelines gets bound to whatever empty default Rive
created — here `State Machine 1`, with no states and no inputs:

```
animations  ['Loop', 'Main Animation']
machines    [{ name: 'State Machine 1', inputs: [] }]
```

An idle state machine still applies itself to the artboard every frame, holding
it at its rest pose, so a timeline played alongside it is overwritten before it
can be drawn. The animation genuinely runs — `isPlaying` reports `true` — and
nothing moves.

`pause()` does not fix it: the machine stays instanced and still bound.
**`stop()` does**, because it removes the instances outright and frees the
artboard. The component therefore does `stop()` then `play(name)`.

The name cannot be inferred. These files list `Loop` first and `Main Animation`
second, and the second is the one you want — so the attribute is required
rather than defaulted.

**Trigger input — `data-rive-trigger`.** The machine is already running, parked
in an idle state, waiting to be fired. `play()` does nothing visible. The
machine the input is looked up on is read from Webflow's own
`data-rive-state-machine` attribute rather than a new one — it is already on the
element, and the input has to be found on the machine Webflow instantiated.

**Entry state — neither attribute.** The machine runs on its own, so `play()`
resumes what autoplay-off left paused.

### Replay

`"repeat"` behaves differently per shape. A named animation restarts properly,
because `stop()` drops the timeline instance and the next `play()` begins at
zero. Firing a trigger again genuinely re-runs it. But bare `play()` only
*resumes*, so a state machine that has already settled will not restart — on
that shape `"repeat"` is only meaningful if the machine loops.

## Behavior

- **Init**: Per element, builds an `IntersectionObserver` at the configured
  threshold, then attaches it once the Rive instance exists (see the load race
  above). On first intersection, plays the named timeline, fires the named
  trigger, or resumes the state machine — whichever the attributes ask for;
  disconnects afterwards unless the element asked to repeat.
- **Resize**: Not used — `IntersectionObserver` re-evaluates against the current
  viewport on its own.
- **Breakpoint**: Not used

## Dependencies

None in the bundle. Depends at runtime on Webflow's own Rive module, which is
present on any page carrying a Rive element.

## DOM Expectations

Elements matching `[data-play-on-scroll]`. Each must be a Webflow Rive element —
the attribute belongs on the same element that carries
`data-animation-type="rive"`, since that is the container Webflow keys its
instance map on.

`.light-block_scroll_rive` on the homepage is driven by an IX3 interaction
(it carries a `data-wf-target`) and is deliberately **not** opted in.
