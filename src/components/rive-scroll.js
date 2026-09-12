/*
Component: rive-scroll
Triggered by the data-play-on-scroll attribute — see components.js for why.

Plays a Webflow Rive element when it scrolls into view, and only that one.

WHY THIS EXISTS
IX3 has no per-element trigger target for Rive, so a scroll interaction wired
to one Rive fires every Rive on the page at once. This gates each one on its
own visibility instead.

IT DOES NOT LOAD RIVE
Webflow already ships the Rive runtime and instantiates one Rive per
[data-animation-type="rive"] element, so bundling @rive-app/canvas here would
mean two runtimes and two WASM downloads for the same animation. This component
reaches for the instance Webflow already built:

  Webflow.require('rive').getInstance(container).rive

which is the real Rive object, with play() and stateMachineInputs() on it.

That accessor is internal, undocumented Webflow API. The surface used here is
deliberately tiny — one getter and one event name — and every failure path
below ends in "the animation does not play" rather than a thrown error, so a
future Webflow change degrades to the paused first frame.

THE LOAD RACE
Webflow fetches the .riv asynchronously, so at init the instance usually does
not exist yet. It dispatches a w-rive-load event on the container when it does.
That event does NOT bubble — it is constructed as a plain Event — so the
listener has to sit on the container itself, not on the document.

Both orders are handled: if the wrapper already reports a successful load we
arm immediately, otherwise we arm on the event.

REDUCED MOTION IS NOT HONOURED
Deliberate, and the one place this component differs from smooth-scroll and
light-block. These are hero-level visuals whose paused first frame can read as
a broken or empty canvas, so the animation plays regardless. Revert by
returning early on a prefers-reduced-motion match.
*/

/*
Webflow's module registry. Read lazily on every call rather than cached at
init: Webflow.require exists long before the rive module has registered
itself, so a value captured at init can be stale.
*/
function riveModule() {
  return window.Webflow?.require?.('rive')
}

function instanceFor(element) {
  return riveModule()?.getInstance?.(element)
}

/*
Three shapes of .riv file need three different starts. See the doc for how each
one was diagnosed.

- data-rive-animation names a linear timeline. Webflow always instantiates with
  a state machine, so this path has to evict it first — see below.
- data-rive-trigger names a state machine input. The machine is already running,
  parked in an idle state, waiting to be fired; play() would do nothing.
- Neither: the machine runs from an entry state, so play() resumes what autoplay
  off left paused.
*/
function start(element) {
  const rive = instanceFor(element)?.rive
  if (!rive) return

  const animation = element.dataset.riveAnimation

  if (animation) {
    /*
    stop() rather than pause(), and this is the whole trick.

    Webflow's Rive element makes you pick a state machine in the Designer, and
    a file authored as plain timelines gets bound to whatever empty default
    Rive created — "State Machine 1" with no states and no inputs. An idle
    machine still applies itself to the artboard every frame, holding it at its
    rest pose, so a timeline played alongside it is overwritten before it can
    be drawn. The animation runs; nothing moves.

    pause() does not help: it freezes the machine but leaves it instanced and
    still bound. stop() removes the instances outright, which is what frees the
    artboard. play(name) then instantiates the named timeline on its own.

    Replaying is a real restart for the same reason — stop() drops the timeline
    instance, so the next play() begins at zero rather than resuming.
    */
    rive.stop()
    rive.play(animation)
    return
  }

  const trigger = element.dataset.riveTrigger

  if (!trigger) {
    rive.play()
    return
  }

  /*
  The state machine name is read off Webflow's own attribute rather than a new
  one — it is already on the element, and the input has to be looked up on the
  same machine Webflow instantiated.
  */
  const machine = element.getAttribute('data-rive-state-machine')
  if (!machine) return

  const input = rive
    .stateMachineInputs(machine)
    ?.find((candidate) => candidate.name === trigger)

  input?.fire?.()
}

export default function (elements) {
  elements.forEach((element) => {
    /*
    A threshold rather than bare intersection, so a visual that is only a
    sliver into the viewport does not burn its one play before anyone can see
    it. Clamped because IntersectionObserver throws on a value outside 0-1.
    */
    const parsed = parseFloat(element.dataset.playOnScrollThreshold)
    const threshold = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 0), 1)
      : 0.25

    const repeat = element.dataset.playOnScroll === 'repeat'

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          start(element)
          if (!repeat) observer.disconnect()
        })
      },
      { threshold }
    )

    /*
    Observing is deferred until the instance exists. Doing it earlier breaks an
    element already on screen at load: the observer fires straight away,
    start() finds no instance, and with repeat off it disconnects having
    played nothing.
    */
    const arm = () => observer.observe(element)

    if (instanceFor(element)?.riveInstanceSuccessLoaded) arm()
    else element.addEventListener('w-rive-load', arm, { once: true })
  })

  /*
  No lifecycle hooks: IntersectionObserver re-evaluates against the current
  viewport on its own, so there is nothing for resize or breakpoint to do.
  */
}
